import OpenAI from "openai";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type {
  ResponseCreateParamsNonStreaming,
} from "openai/resources/responses/responses";

import { env } from "@/env";
import {
  type GroupStatsExtended,
  type PreferenceSummary,
} from "@/server/agents/advisor-pipeline";

const openaiClient =
  env.OPENAI_API_KEY && env.OPENAI_API_KEY.length > 0
    ? new OpenAI({ apiKey: env.OPENAI_API_KEY })
    : null;

const questionSchema = z.object({
  id: z.string(),
  prompt: z.string(),
  type: z.enum(["scale", "choice", "binary", "text"]),
  signalKey: z.string(),
  options: z.array(z.string()).optional(),
  suggestedResponse: z.string().optional(),
  reason: z.string().optional(),
});

const moodAgentResponseSchema = z.object({
  questions: z.array(questionSchema).min(1).max(3),
  followUp: z.string().optional(),
  debugNotes: z.array(z.string()).optional(),
});

export type MoodQuestion = z.infer<typeof questionSchema>;
export type MoodAgentResponse = z.infer<typeof moodAgentResponseSchema>;
type JsonSchema = Record<string, unknown>;

const zodToJsonSchemaTyped = zodToJsonSchema as (
  schema: z.ZodTypeAny,
  options?: { name?: string; target?: string },
) => JsonSchema;

function resolveRef(
  ref: string,
  defs: Record<string, JsonSchema> | undefined,
): JsonSchema | null {
  if (!defs || !ref.startsWith("#/$defs/")) {
    return null;
  }
  const defName = ref.replace("#/$defs/", "");
  return defs[defName] ?? null;
}

function sanitizeSchemaForOpenAI(
  schema: JsonSchema,
  defs?: Record<string, JsonSchema>,
): JsonSchema {
  // OpenAI API requirements for Structured Outputs:
  // 1. Root must have type: "object" (not $ref)
  // 2. additionalProperties: false must be set on all objects
  // 3. All properties must be in required array
  // 4. Cannot have $ref with type keyword
  // 5. "uri" format is not valid, remove it
  
  // If schema has $ref at root, resolve it
  if (schema.$ref && !schema.properties) {
    const resolved = resolveRef(schema.$ref as string, defs ?? schema.$defs as Record<string, JsonSchema> | undefined);
    if (resolved) {
      return sanitizeSchemaForOpenAI(resolved, defs ?? schema.$defs as Record<string, JsonSchema> | undefined);
    }
    // If we can't resolve, create a basic object schema
    return {
      type: "object",
      properties: {},
      required: [],
      additionalProperties: false,
    };
  }
  
  // Extract $defs if present for reference resolution
  const schemaDefs = (schema.$defs as Record<string, JsonSchema> | undefined) ?? defs;
  
  // Recursively sanitize nested schemas first
  const sanitized = { ...schema };
  
  // Remove "uri" format (OpenAI doesn't accept it)
  if (sanitized.format === "uri") {
    delete sanitized.format;
  }
  
  // Handle objects
  if (sanitized.type === "object" || sanitized.properties) {
    // Always set type to object if properties exist
    sanitized.type = "object";
    
    // OpenAI requires additionalProperties: false
    sanitized.additionalProperties = false;
    
    // Recursively process properties
    if (sanitized.properties && typeof sanitized.properties === "object") {
      const props = sanitized.properties as Record<string, JsonSchema>;
      sanitized.properties = Object.fromEntries(
        Object.entries(props).map(([key, value]) => {
          // Resolve $ref if present
          if (value.$ref && typeof value.$ref === "string") {
            const resolved = resolveRef(value.$ref, schemaDefs);
            if (resolved) {
              value = sanitizeSchemaForOpenAI(resolved, schemaDefs);
            }
          }
          return [key, sanitizeSchemaForOpenAI(value, schemaDefs)];
        }),
      );
      
      // Ensure all properties are in required array
      if (!sanitized.required || !Array.isArray(sanitized.required)) {
        sanitized.required = Object.keys(props);
      } else {
        // Merge existing required with all property keys
        const existingRequired = sanitized.required as string[];
        const allKeys = new Set([
          ...existingRequired,
          ...Object.keys(props),
        ]);
        sanitized.required = Array.from(allKeys);
      }
    }
  }
  
  // Handle arrays
  if (sanitized.type === "array" || sanitized.items) {
    sanitized.type = "array";
    
    // Recursively process items
    if (sanitized.items && typeof sanitized.items === "object") {
      const items = sanitized.items as JsonSchema;
      // Resolve $ref if present
      if (items.$ref && typeof items.$ref === "string") {
        const resolved = resolveRef(items.$ref, schemaDefs);
        if (resolved) {
          sanitized.items = sanitizeSchemaForOpenAI(resolved, schemaDefs);
        } else {
          sanitized.items = sanitizeSchemaForOpenAI(items, schemaDefs);
        }
      } else {
        sanitized.items = sanitizeSchemaForOpenAI(items, schemaDefs);
      }
    }
  }
  
  // Remove $ref if it exists alongside other properties (invalid)
  if (sanitized.$ref && sanitized.type) {
    delete sanitized.$ref;
  }
  
  // Remove $defs since we've resolved all references
  delete sanitized.$defs;
  
  // Always ensure root has type: "object" if it has properties
  if (sanitized.properties && !sanitized.type) {
    sanitized.type = "object";
  }
  
  return sanitized;
}

// Generate schema without name to avoid $ref at root
const rawMoodSchema = zodToJsonSchemaTyped(moodAgentResponseSchema);
const moodJsonSchema = sanitizeSchemaForOpenAI(rawMoodSchema);

export type MoodAgentInput = {
  participantName?: string;
  summary: PreferenceSummary;
  stats: GroupStatsExtended;
  answeredSignals?: Record<string, unknown>;
  timeOfDayLabel?: string;
};

export async function runMoodCheckAgent(
  input: MoodAgentInput,
): Promise<MoodAgentResponse> {
  if (!openaiClient || !env.OPENAI_MODEL) {
    return {
      questions: buildFallbackQuestions(input),
      followUp: undefined,
      debugNotes: ["fallback-mode"],
    };
  }

  const client = openaiClient;

  try {
    const request: ResponseCreateParamsNonStreaming = {
      model: env.OPENAI_MODEL,
      temperature: 0.5,
      text: {
        format: {
          type: "json_schema",
          name: "mood_agent_output",
          schema: moodJsonSchema,
          strict: true,
        },
      },
      input: [
        {
          role: "system",
          content:
            "You are Wolt Advisor's Mood Agent. Ask up to 3 concise questions to capture the group's current vibe. Prefer slider, emoji, or short-choice formats. Only ask what is still uncertain.",
        },
        {
          role: "user",
          content: JSON.stringify(buildPromptPayload(input)),
        },
      ],
    };

    const responsesApi = client.responses;
    const response = await responsesApi.create(request);

    const raw = response.output_text;

    if (!raw) {
      throw new Error("Missing mood-agent payload");
    }

    const moodPayload: unknown = JSON.parse(raw);
    const parsed = moodAgentResponseSchema.parse(moodPayload);

    return parsed;
  } catch (error) {
    console.warn("[MoodAgent] Failed, using fallback", error);
    return {
      questions: buildFallbackQuestions(input),
      followUp: undefined,
      debugNotes: ["mood-agent-fallback"],
    };
  }
}

function buildPromptPayload(input: MoodAgentInput) {
  const { stats, summary } = input;
  return {
    participantName: input.participantName,
    summary,
    stats: {
      participantCount: stats.participantCount,
      avgActivityLevel: stats.avgActivityLevel,
      energyLabel: stats.energyLabel,
      popularMoneyPreference: stats.popularMoneyPreference,
    },
    answeredSignals: input.answeredSignals ?? {},
    timeOfDayLabel: input.timeOfDayLabel ?? deriveTimeOfDayLabel(),
    request: {
      missingSignals: determineMissingSignals(input),
      instructions: [
        "Keep tone playful and short.",
        "Return 1-3 questions targeting the missing signals.",
        "If confidence is already high for a signal, skip asking about it.",
      ],
    },
  };
}

function determineMissingSignals(input: MoodAgentInput) {
  const missing: string[] = [];
  const answered = input.answeredSignals ?? {};
  if (!answered.currentEnergy) missing.push("currentEnergy");
  if (!answered.timeAvailable) missing.push("timeAvailable");
  if (!answered.hungerLevel) missing.push("hungerLevel");
  if (!answered.indoorOutdoorPreference) missing.push("indoorOutdoorPreference");

  if (missing.length === 0) {
    missing.push("wildcardPreference");
  }

  return missing;
}

function deriveTimeOfDayLabel(date = new Date()) {
  const hour = date.getHours();
  if (hour < 11) return "morning";
  if (hour < 16) return "afternoon";
  if (hour < 21) return "evening";
  return "late-night";
}

function buildFallbackQuestions(input: MoodAgentInput): MoodQuestion[] {
  const questions: MoodQuestion[] = [];

  questions.push({
    id: "currentEnergy",
    prompt: "What's your energy level right now? 🔋",
    type: "scale",
    signalKey: "currentEnergy",
    options: ["Chill", "Balanced", "Hype"],
    suggestedResponse:
      input.stats.energyLabel === "high"
        ? "Hype"
        : input.stats.energyLabel === "low"
          ? "Chill"
          : "Balanced",
    reason: "Need live energy reading to match venue pacing.",
  });

  questions.push({
    id: "timeAvailable",
    prompt: "How much time do you want to spend tonight?",
    type: "choice",
    signalKey: "timeAvailable",
    options: ["<1h", "1-2h", "2h+"],
    reason: "Helps filter availability slots.",
  });

  questions.push({
    id: "hungerLevel",
    prompt: "Hunger check? 🍽️",
    type: "choice",
    signalKey: "hungerLevel",
    options: ["Snacks", "Proper meal", "Stuffed already"],
    suggestedResponse:
      summaryMatchesFoodFocus(input.summary) ? "Proper meal" : "Snacks",
    reason: "Decides if we pair dining with the plan.",
  });

  return questions;
}

function summaryMatchesFoodFocus(summary: PreferenceSummary) {
  return summary.vibeKeywords.some((keyword) =>
    ["food", "dinner", "restaurant"].some((needle) =>
      keyword.toLowerCase().includes(needle),
    ),
  );
}


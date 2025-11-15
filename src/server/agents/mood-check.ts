import OpenAI from "openai";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type {
  ResponseCreateParamsNonStreaming,
  Responses as ResponsesApi,
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
  options: { name: string },
) => JsonSchema;

const moodJsonSchema = zodToJsonSchemaTyped(moodAgentResponseSchema, {
  name: "MoodAgentOutput",
});

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


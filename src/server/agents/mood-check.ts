import OpenAI from "openai";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { ResponseCreateParamsNonStreaming } from "openai/resources/responses/responses";

import { env } from "@/env";
import {
  type GroupStatsExtended,
  type PreferenceSummary,
} from "@/server/agents/advisor-pipeline";
import type { FilteredVenue } from "@/server/agents/venue-filter";
import { moodQuestionsCache } from "@/lib/cache";
import { createHash } from "crypto";

const openaiClient =
  env.OPENAI_API_KEY && env.OPENAI_API_KEY.length > 0
    ? new OpenAI({ apiKey: env.OPENAI_API_KEY })
    : null;

const questionSchema = z.object({
  id: z.string(),
  prompt: z.string(),
  type: z.enum(["scale", "choice"]),
  signalKey: z.string(),
  options: z.array(z.string()).max(3).optional(),
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
    const resolved = resolveRef(
      schema.$ref as string,
      defs ?? (schema.$defs as Record<string, JsonSchema> | undefined),
    );
    if (resolved) {
      return sanitizeSchemaForOpenAI(
        resolved,
        defs ?? (schema.$defs as Record<string, JsonSchema> | undefined),
      );
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
  const schemaDefs =
    (schema.$defs as Record<string, JsonSchema> | undefined) ?? defs;

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
        const allKeys = new Set([...existingRequired, ...Object.keys(props)]);
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
  filteredVenues?: FilteredVenue[]; // Venues to narrow down with questions
};

/**
 * Generate a cache key from the input
 */
function generateCacheKey(input: MoodAgentInput): string {
  // Create a hash from:
  // 1. Venue IDs (sorted for consistency)
  // 2. Stats (participant count, energy, budget)
  // 3. Summary keywords

  const venueIds = input.filteredVenues
    ? input.filteredVenues
        .map((v) => v.id)
        .sort()
        .join(",")
    : "no-venues";

  const statsKey = `${input.stats.participantCount}-${input.stats.energyLabel}-${input.stats.popularMoneyPreference}`;
  const keywordsKey = input.summary.vibeKeywords.slice(0, 4).sort().join(",");

  const keyString = `${venueIds}|${statsKey}|${keywordsKey}`;

  // Create SHA-256 hash for shorter, consistent key
  return createHash("sha256").update(keyString).digest("hex").slice(0, 16);
}

export async function runMoodCheckAgent(
  input: MoodAgentInput,
): Promise<MoodAgentResponse> {
  // Check cache first
  const cacheKey = generateCacheKey(input);
  const cached = moodQuestionsCache.get(cacheKey);

  if (cached) {
    return {
      questions: cached.questions as MoodQuestion[],
      followUp: cached.followUp,
      debugNotes: cached.debugNotes ?? ["cached"],
    };
  }

  if (!openaiClient || !env.OPENAI_MODEL) {
    const fallback = {
      questions: buildFallbackQuestions(input),
      followUp: undefined,
      debugNotes: ["fallback-mode"],
    };

    // Cache fallback too
    moodQuestionsCache.set(cacheKey, fallback);

    return fallback;
  }

  const client = openaiClient;

  try {
    const request: ResponseCreateParamsNonStreaming = {
      model: env.OPENAI_MODEL,
      temperature: 0.3, // Lower temperature for faster, more deterministic responses
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
            "Wolt Advisor Mood Agent. Generate 1-3 concise questions to match groups to venues. ALL questions MUST be multiple choice - use 'choice' or 'scale' types ONLY. NEVER use 'text' or 'binary' types. Provide options array for all questions with a MAXIMUM of 3 options per question. For preference questions (e.g., 'active or laid-back'), use 'choice' type with descriptive options like ['More active', 'Laid-back']. Use slider/emoji/short-choice formats. Analyze venue differences and create natural questions. NEVER mention venue names/types. CRITICAL: Each question must cover a COMPLETELY DIFFERENT dimension/aspect. Avoid asking multiple preference questions in a row. Instead, cover diverse aspects like: activity intensity (active vs relaxed), time constraints (quick vs leisurely), social dynamics (group interaction level), setting type (indoor vs outdoor), budget sensitivity, hunger level, or specific activity interests. Use varied question structures - mix 'how much', 'what type', 'when', 'where' formats. Never repeat similar phrasing like 'What kind of X' or 'What type of Y' multiple times.",
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

    // Safety check: Ensure all questions have options and limit to max 3
    const validatedQuestions = parsed.questions.map((q) => {
      // Ensure scale and choice questions have options
      if (
        (q.type === "scale" || q.type === "choice") &&
        (!q.options || q.options.length === 0)
      ) {
        // If no options provided, add default options based on type
        if (q.type === "scale") {
          q.options = ["Low", "Medium", "High"];
        } else {
          q.options = ["Option 1", "Option 2"];
        }
      }
      // Limit options to maximum of 3
      if (q.options && q.options.length > 3) {
        q.options = q.options.slice(0, 3);
      }
      return q;
    });

    const result = {
      ...parsed,
      questions: validatedQuestions,
    };

    // Cache the result
    moodQuestionsCache.set(cacheKey, {
      questions: result.questions,
      followUp: result.followUp,
      debugNotes: result.debugNotes,
    });

    return result;
  } catch (error) {
    console.warn("[MoodAgent] Failed, using fallback", error);
    const fallback = {
      questions: buildFallbackQuestions(input),
      followUp: undefined,
      debugNotes: ["mood-agent-fallback"],
    };

    // Cache fallback too
    moodQuestionsCache.set(cacheKey, fallback);

    return fallback;
  }
}

function buildPromptPayload(input: MoodAgentInput) {
  const { stats, summary } = input;

  // Build venue context and analyze venue characteristics
  let venueContext:
    | Array<{
        name: string;
        type: string;
        description: string;
        distanceKm?: string;
      }>
    | undefined;

  let venueAnalysis:
    | {
        venueTypes: string[];
        keyCharacteristics: string[];
        differentiatingFactors: string[];
      }
    | undefined;

  if (input.filteredVenues && input.filteredVenues.length > 0) {
    // Limit to top 12 venues to reduce context size and speed up processing
    const topVenues = input.filteredVenues.slice(0, 12);

    venueContext = topVenues.map((venue) => ({
      name: venue.name,
      type: venue.type,
      // Truncate description to first 100 chars to reduce token count
      description: venue.description ? venue.description.slice(0, 100) : "",
      distanceKm: venue.distanceMeters
        ? (venue.distanceMeters / 1000).toFixed(1)
        : undefined,
    }));

    // Analyze venue characteristics to help generate better questions
    const venueTypes = new Set<string>();
    const characteristics = new Set<string>();
    const keywords = new Set<string>();

    for (const venue of topVenues) {
      // Extract venue type (normalize)
      const normalizedType = venue.type
        .replace(/_/g, " ")
        .replace(/\b\w/g, (l) => l.toUpperCase());
      venueTypes.add(normalizedType);

      // Extract keywords from description
      if (venue.description) {
        const desc = venue.description.toLowerCase();

        // Look for activity-related keywords
        const activityKeywords = [
          "active",
          "competitive",
          "sport",
          "game",
          "play",
          "challenge",
          "relax",
          "chill",
          "casual",
          "social",
          "party",
          "dance",
          "outdoor",
          "indoor",
          "adventure",
          "experience",
          "workshop",
          "class",
          "lesson",
          "tour",
          "walk",
          "hike",
          "bike",
        ];

        activityKeywords.forEach((keyword) => {
          if (desc.includes(keyword)) {
            keywords.add(keyword);
          }
        });

        // Look for atmosphere keywords
        const atmosphereKeywords = [
          "cozy",
          "intimate",
          "lively",
          "energetic",
          "quiet",
          "loud",
          "romantic",
          "family",
          "group",
          "solo",
          "date",
          "friends",
        ];

        atmosphereKeywords.forEach((keyword) => {
          if (desc.includes(keyword)) {
            characteristics.add(keyword);
          }
        });
      }
    }

    // Identify differentiating factors
    const differentiatingFactors: string[] = [];

    // Check if there's a mix of indoor/outdoor
    const hasIndoor = Array.from(keywords).some((k) =>
      ["indoor", "inside"].includes(k),
    );
    const hasOutdoor = Array.from(keywords).some((k) =>
      ["outdoor", "outside", "park", "nature"].includes(k),
    );
    if (hasIndoor && hasOutdoor) {
      differentiatingFactors.push("indoor vs outdoor preference");
    }

    // Check for activity level variety
    const hasActive = Array.from(keywords).some((k) =>
      ["active", "competitive", "sport", "challenge"].includes(k),
    );
    const hasRelaxed = Array.from(keywords).some((k) =>
      ["relax", "chill", "casual", "cozy"].includes(k),
    );
    if (hasActive && hasRelaxed) {
      differentiatingFactors.push("activity intensity preference");
    }

    // Check for social vs solo activities
    const hasSocial = Array.from(keywords).some((k) =>
      ["social", "party", "group", "friends"].includes(k),
    );
    const hasSolo = Array.from(keywords).some((k) =>
      ["solo", "quiet", "intimate"].includes(k),
    );
    if (hasSocial && hasSolo) {
      differentiatingFactors.push("social atmosphere preference");
    }

    // Check venue type diversity
    if (venueTypes.size > 3) {
      differentiatingFactors.push("venue type variety");
    }

    venueAnalysis = {
      venueTypes: Array.from(venueTypes).slice(0, 6), // Reduced from 10
      keyCharacteristics: Array.from(characteristics).slice(0, 5), // Reduced from 8
      differentiatingFactors: differentiatingFactors.slice(0, 3), // Limit to top 3
    };
  }

  return {
    participantName: input.participantName,
    // Simplified summary - only essential fields to reduce token count
    summary: {
      headline: summary.headline,
      summary: summary.summary.slice(0, 150), // Truncate summary text
      vibeKeywords: summary.vibeKeywords.slice(0, 4), // Limit keywords
      budgetTier: summary.budgetTier,
      energyLevel: summary.energyLevel,
      timeWindow: summary.timeWindow,
      hungerLevel: summary.hungerLevel,
      callToAction: summary.callToAction,
    },
    stats: {
      participantCount: stats.participantCount,
      energyLabel: stats.energyLabel,
      popularMoneyPreference: stats.popularMoneyPreference,
    },
    answeredSignals: input.answeredSignals ?? {},
    timeOfDayLabel: input.timeOfDayLabel ?? deriveTimeOfDayLabel(),
    availableVenues: venueContext?.slice(0, 10), // Limit to 10 venues in payload
    venueCount: input.filteredVenues?.length ?? 0,
    venueAnalysis,
    request: {
      answeredSignals: input.answeredSignals ?? {},
      instructions: [
        "Keep tone playful and short.",
        "Return 1-3 questions that help narrow down which venues would be best for this group.",
        "CRITICAL: ALL questions MUST be multiple choice. Use 'choice' or 'scale' types ONLY. NEVER use 'text' or 'binary' types. Always provide an options array with at least 2 choices and a MAXIMUM of 3 options per question. For preference questions (choosing between options), use 'choice' type with descriptive option labels, NOT binary yes/no.",
        "MANDATORY DIVERSITY: Each question must cover a UNIQUE dimension. DO NOT ask multiple questions about the same type of preference. Examples of distinct dimensions: (1) Activity intensity/energy level, (2) Time constraints/duration, (3) Social interaction style, (4) Setting preference (indoor/outdoor), (5) Budget sensitivity, (6) Hunger level, (7) Group size dynamics, (8) Specific activity interests. If you ask about 'vibe' in one question, the next question MUST cover something completely different like time constraints or budget, NOT another vibe-related preference.",
        "Question structure variety: Use DIFFERENT question formats across questions. Mix 'How much...', 'What type of...', 'When do you...', 'Where would you...', 'How do you feel about...' patterns. Never use the same question structure twice. Avoid asking 'What kind of X' followed by 'What type of Y' - these are too similar.",
        "Vocabulary and phrasing variety: If one question uses 'vibe' or 'mood', don't use those words again. If one uses 'prefer', use different phrasing in other questions. If one asks about 'setting', don't ask about 'space' or 'environment' in another - these overlap. Each question should feel like it's asking about a completely different aspect of the experience.",
        "BAD EXAMPLE (too similar): 'What kind of vibe are you in the mood for?' followed by 'What type of setting do you prefer?' - both are preference questions about atmosphere. GOOD EXAMPLE (diverse): 'How much time do you have?' (time constraint) followed by 'What's your energy level right now?' (intensity scale) followed by 'How important is budget?' (priority question).",
        venueAnalysis && venueAnalysis.differentiatingFactors.length > 0
          ? `Venues differ by: ${venueAnalysis.differentiatingFactors.slice(0, 3).join(", ")}. Types: ${venueAnalysis.venueTypes.slice(0, 4).join(", ")}. Create questions that distinguish between options. Each question must cover a DIFFERENT differentiating factor - don't ask about the same aspect twice.`
          : venueContext
            ? `Available venues: ${venueContext
                .slice(0, 8)
                .map((v) => `${v.name} (${v.type})`)
                .join(
                  ", ",
                )}. Create questions to match group to venues. Cover COMPLETELY DIFFERENT aspects - don't repeat similar preference questions.`
            : "Generate general mood questions covering COMPLETELY DIFFERENT aspects (time, energy, social, setting, budget, etc.).",
      ],
    },
  };
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

  // Analyze venues if available to generate better fallback questions
  const hasVenues = input.filteredVenues && input.filteredVenues.length > 0;
  let venueCharacteristics: {
    hasIndoor?: boolean;
    hasOutdoor?: boolean;
    hasActive?: boolean;
    hasRelaxed?: boolean;
    hasFood?: boolean;
  } = {};

  if (hasVenues && input.filteredVenues) {
    const topVenues = input.filteredVenues.slice(0, 10);
    const allDescriptions = topVenues
      .map((v) => v.description?.toLowerCase() ?? "")
      .join(" ");

    venueCharacteristics = {
      hasIndoor:
        allDescriptions.includes("indoor") ||
        allDescriptions.includes("inside"),
      hasOutdoor:
        allDescriptions.includes("outdoor") ||
        allDescriptions.includes("park") ||
        allDescriptions.includes("nature"),
      hasActive:
        allDescriptions.includes("active") ||
        allDescriptions.includes("competitive") ||
        allDescriptions.includes("sport"),
      hasRelaxed:
        allDescriptions.includes("relax") ||
        allDescriptions.includes("chill") ||
        allDescriptions.includes("cozy"),
      hasFood:
        allDescriptions.includes("restaurant") ||
        allDescriptions.includes("dining") ||
        allDescriptions.includes("food") ||
        allDescriptions.includes("cafe"),
    };
  }

  // Generate venue-aware questions with variety
  // First question: atmosphere/indoor-outdoor (if applicable)
  if (venueCharacteristics.hasIndoor && venueCharacteristics.hasOutdoor) {
    questions.push({
      id: "atmospherePreference",
      prompt: "What's the weather vibe you're feeling? 🌤️",
      type: "choice",
      signalKey: "indoorOutdoorPreference",
      options: ["Stay inside", "Get some air", "No preference"],
      reason: "Helps match indoor vs outdoor venues naturally.",
    });
  }

  // Second question: time commitment (always useful, different phrasing)
  questions.push({
    id: "timeAvailable",
    prompt: "How long are you thinking? ⏰",
    type: "scale",
    signalKey: "timeAvailable",
    options: ["Quick", "Moderate", "All evening"],
    reason: "Helps filter availability slots.",
  });

  // Third question: activity level OR food (whichever is more relevant, different structure)
  if (
    venueCharacteristics.hasActive &&
    venueCharacteristics.hasRelaxed &&
    !venueCharacteristics.hasFood
  ) {
    questions.push({
      id: "activityPace",
      prompt: "What's your move tonight? 🎯",
      type: "choice",
      signalKey: "activityPace",
      options: ["Low-key", "Mix it up", "Go all out"],
      reason: "Helps differentiate between active and relaxed venues.",
    });
  } else if (venueCharacteristics.hasFood) {
    questions.push({
      id: "hungerLevel",
      prompt: "Food situation? 🍽️",
      type: "choice",
      signalKey: "hungerLevel",
      options: ["Light bites", "Full meal", "Already ate"],
      suggestedResponse: summaryMatchesFoodFocus(input.summary)
        ? "Full meal"
        : "Light bites",
      reason: "Decides if we pair dining with the plan.",
    });
  } else {
    // Fallback: energy level with different phrasing
    questions.push({
      id: "currentEnergy",
      prompt: "What's the vibe? 🔋",
      type: "scale",
      signalKey: "currentEnergy",
      options: ["Mellow", "Moderate", "Pumped"],
      suggestedResponse:
        input.stats.energyLabel === "high"
          ? "Pumped"
          : input.stats.energyLabel === "low"
            ? "Mellow"
            : "Moderate",
      reason: "Need live energy reading to match venue pacing.",
    });
  }

  // Ensure we have at least 2 questions
  if (questions.length < 2) {
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
  }

  return questions.slice(0, 3); // Max 3 questions
}

function summaryMatchesFoodFocus(summary: PreferenceSummary) {
  return summary.vibeKeywords.some((keyword) =>
    ["food", "dinner", "restaurant"].some((needle) =>
      keyword.toLowerCase().includes(needle),
    ),
  );
}

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

// Question theme categories
type QuestionCategory = "preference" | "factual" | "constraint";

// Question theme definition
type QuestionTheme = {
  id: string;
  category: QuestionCategory;
  prompt: string;
  signalKey: string;
  description: string; // What this theme captures
};

// Predefined question themes based on venue data structure
const QUESTION_THEMES: QuestionTheme[] = [
  // FACTUAL/CONSTRAINT themes
  {
    id: "time-availability",
    category: "factual",
    prompt: "How much time do you have?",
    signalKey: "timeAvailability",
    description: "Time constraint - maps to timeSlotsMinutes",
  },
  {
    id: "budget-sensitivity",
    category: "constraint",
    prompt: "How important is staying within budget?",
    signalKey: "budgetSensitivity",
    description: "Budget constraint - maps to budgetTiers",
  },
  {
    id: "hunger-level",
    category: "factual",
    prompt: "How hungry are you right now?",
    signalKey: "hungerLevel",
    description: "Hunger level - maps to hungerLevels",
  },
  {
    id: "weather-dependency",
    category: "constraint",
    prompt: "How does weather affect your plans?",
    signalKey: "weatherDependency",
    description: "Weather constraint - maps to weatherFlex",
  },
  
  // PREFERENCE themes
  {
    id: "energy-level",
    category: "preference",
    prompt: "What's your energy level right now?",
    signalKey: "energyLevel",
    description: "Energy preference - maps to energyLevels",
  },
  {
    id: "adventure-novelty",
    category: "preference",
    prompt: "How adventurous are you feeling?",
    signalKey: "adventureLevel",
    description: "Novelty preference - maps to noveltyPreference",
  },
  {
    id: "experience-intensity",
    category: "preference",
    prompt: "What kind of experience are you looking for?",
    signalKey: "experienceIntensity",
    description: "Experience depth - maps to experienceIntensity",
  },
  {
    id: "social-vibe",
    category: "preference",
    prompt: "What kind of social vibe are you looking for?",
    signalKey: "socialDynamics",
    description: "Social atmosphere - maps to vibeTags",
  },
  {
    id: "activity-vs-dining",
    category: "preference",
    prompt: "What sounds more appealing?",
    signalKey: "activityFocus",
    description: "Activity vs dining focus - maps to category",
  },
  {
    id: "setting-preference",
    category: "preference",
    prompt: "Where would you rather be?",
    signalKey: "settingPreference",
    description: "Indoor vs outdoor - maps to weatherSuitability",
  },
];

/**
 * Select appropriate question themes based on venue context
 * Ensures diversity by mixing preference, factual, and constraint questions
 */
function selectQuestionThemes(
  input: MoodAgentInput,
  venueAnalysis?: {
    venueTypes: string[];
    keyCharacteristics: string[];
    differentiatingFactors: string[];
  },
): QuestionTheme[] {
  const answeredSignals = input.answeredSignals ?? {};
  const availableThemes = QUESTION_THEMES.filter(
    (theme) => !answeredSignals[theme.signalKey],
  );

  if (availableThemes.length === 0) {
    return QUESTION_THEMES.slice(0, 3);
  }

  // Analyze venue context to prioritize relevant themes
  const venueContext = venueAnalysis?.differentiatingFactors ?? [];
  const hasIndoorOutdoor = venueContext.some((f) =>
    f.toLowerCase().includes("indoor") || f.toLowerCase().includes("outdoor"),
  );
  const hasFood = venueAnalysis?.venueTypes.some((t) =>
    t.toLowerCase().includes("restaurant") ||
    t.toLowerCase().includes("cafe") ||
    t.toLowerCase().includes("dining"),
  );
  const hasActivityVariety = venueContext.some((f) =>
    f.toLowerCase().includes("activity"),
  );

  // Score themes based on relevance
  const scoredThemes = availableThemes.map((theme) => {
    let score = 0;

    // Boost themes relevant to venue context (but not too much)
    if (hasIndoorOutdoor && theme.id === "setting-preference") score += 3;
    if (hasFood && theme.id === "hunger-level") score += 3;
    if (hasActivityVariety && theme.id === "activity-vs-dining") score += 3;
    if (input.timeOfDayLabel && theme.id === "time-availability") score += 2;

    // Add significant randomization to ensure variety
    // This ensures different questions even with same venue context
    score += Math.random() * 10;

    return { theme, score };
  });

  // Shuffle first, then sort by score to break ties randomly
  // This adds more variety even when scores are similar
  for (let i = scoredThemes.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = scoredThemes[i];
    if (temp && scoredThemes[j]) {
      scoredThemes[i] = scoredThemes[j];
      scoredThemes[j] = temp;
    }
  }
  
  // Sort by score
  scoredThemes.sort((a, b) => b.score - a.score);

  // Select 1-3 themes ensuring diversity
  const selected: QuestionTheme[] = [];
  const selectedCategories = new Set<QuestionCategory>();
  const selectedIds = new Set<string>();

  // First pass: ensure diversity by mixing categories
  for (const { theme } of scoredThemes) {
    if (selected.length >= 3) break;
    if (selectedIds.has(theme.id)) continue;

    // Prefer mixing categories
    if (selected.length === 0) {
      // First question: any category
      selected.push(theme);
      selectedCategories.add(theme.category);
      selectedIds.add(theme.id);
    } else if (selected.length === 1) {
      // Second question: prefer different category
      const firstCategory = selected[0]?.category;
      if (theme.category !== firstCategory) {
        selected.push(theme);
        selectedCategories.add(theme.category);
        selectedIds.add(theme.id);
      }
    } else {
      // Third question: prefer different category from both previous
      const categories = Array.from(selectedCategories);
      if (!categories.includes(theme.category) || categories.length === 2) {
        selected.push(theme);
        selectedCategories.add(theme.category);
        selectedIds.add(theme.id);
      }
    }
  }

  // Fill remaining slots if we don't have 3 yet
  if (selected.length < 3) {
    for (const { theme } of scoredThemes) {
      if (selected.length >= 3) break;
      if (!selectedIds.has(theme.id)) {
        selected.push(theme);
        selectedIds.add(theme.id);
      }
    }
  }

  // Enforce diversity: if all selected are preference, replace one
  const allPreference = selected.every((t) => t.category === "preference");
  if (allPreference && selected.length > 1) {
    const nonPreference = scoredThemes.find(
      ({ theme }) =>
        theme.category !== "preference" && !selectedIds.has(theme.id),
    );
    if (nonPreference) {
      selected[selected.length - 1] = nonPreference.theme;
      selectedIds.delete(selected[selected.length - 1]?.id ?? "");
      selectedIds.add(nonPreference.theme.id);
    }
  }

  // Final shuffle to randomize order (so same themes don't always appear in same position)
  for (let i = selected.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = selected[i];
    if (temp && selected[j]) {
      selected[i] = selected[j];
      selected[j] = temp;
    }
  }

  return selected.slice(0, 3);
}

/**
 * Generate a cache key from the input
 */
function generateCacheKey(input: MoodAgentInput): string {
  // Create a hash from:
  // 1. Venue IDs (sorted for consistency)
  // 2. Answered signals (to ensure different questions after answers)
  // 3. Time of day (to vary by time)

  const venueIds = input.filteredVenues
    ? input.filteredVenues
        .map((v) => v.id)
        .sort()
        .join(",")
    : "no-venues";

  const answeredSignalsKey = input.answeredSignals
    ? Object.keys(input.answeredSignals)
        .sort()
        .join(",")
    : "none";
  
  const timeOfDay = input.timeOfDayLabel ?? "unknown";

  const keyString = `${venueIds}|${answeredSignalsKey}|${timeOfDay}`;

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
            "Select 1-3 question themes that best match the venue context. Mix preference themes with factual/constraint themes. Use the theme prompts as a guide but adapt naturally. IMPORTANT: Each question must have exactly 3 options. For scale questions, provide exactly 3 option strings. For choice questions, provide exactly 3 distinct choices.",
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

    // Safety check: Ensure all questions have exactly 3 options
    const validatedQuestions = parsed.questions.map((q) => {
      // Clean options: trim whitespace and remove surrounding quotes
      if (q.options && q.options.length > 0) {
        q.options = q.options
          .map((opt) => {
            if (typeof opt === "string") {
              return opt.trim().replace(/^["']+|["']+$/g, "");
            }
            return String(opt).trim();
          })
          .filter((opt) => opt.length > 0);
      }
      
      // Ensure scale and choice questions have exactly 3 options
      if (q.type === "scale" || q.type === "choice") {
        if (!q.options || q.options.length === 0) {
          // If no options provided, add default options
          if (q.type === "scale") {
            q.options = ["Low", "Medium", "High"];
          } else {
            q.options = ["Option 1", "Option 2", "Option 3"];
          }
        } else if (q.options.length < 3) {
          // If fewer than 3 options, pad with defaults
          const defaults = q.type === "scale" 
            ? ["Low", "Medium", "High"]
            : ["Option 1", "Option 2", "Option 3"];
          while (q.options.length < 3) {
            q.options.push(defaults[q.options.length] ?? `Option ${q.options.length + 1}`);
          }
        } else if (q.options.length > 3) {
          // If more than 3 options, take only the first 3
          q.options = q.options.slice(0, 3);
        }
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
  // Build venue analysis for theme selection
  let venueAnalysis:
    | {
        venueTypes: string[];
        keyCharacteristics: string[];
        differentiatingFactors: string[];
      }
    | undefined;

  if (input.filteredVenues && input.filteredVenues.length > 0) {
    // Take a random sample of venues (up to 12) to ensure variety in analysis
    // This prevents same venue set from always producing same questions
    const sampleSize = Math.min(12, input.filteredVenues.length);
    const shuffled = [...input.filteredVenues];
    // Shuffle to get random sample
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = shuffled[i];
      if (temp && shuffled[j]) {
        shuffled[i] = shuffled[j];
        shuffled[j] = temp;
      }
    }
    const topVenues = shuffled.slice(0, sampleSize);

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

  // Select themes based on venue context
  const selectedThemes = selectQuestionThemes(input, venueAnalysis);

  return {
    timeOfDay: input.timeOfDayLabel ?? deriveTimeOfDayLabel(),
    answeredSignals: input.answeredSignals ?? {},
    venueContext: venueAnalysis
      ? {
          differentiatingFactors: venueAnalysis.differentiatingFactors.slice(
            0,
            2,
          ),
        }
      : undefined,
    questionThemes: selectedThemes.map((theme) => ({
      id: theme.id,
      category: theme.category,
      prompt: theme.prompt,
      signalKey: theme.signalKey,
      description: theme.description,
    })),
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

import type { EventGroup, EventGroupPreference } from "@prisma/client";
import OpenAI from "openai";
import { zodToJsonSchema } from "zod-to-json-schema";
import type {
  ResponseCreateParamsNonStreaming,
} from "openai/resources/responses/responses";
import { z } from "zod";

import { env } from "@/env";
import {
  demoVenues,
  type DemoVenue,
  type DemoVenueAvailability,
} from "@/server/data/demo-venues";

const openaiClient =
  env.OPENAI_API_KEY && env.OPENAI_API_KEY.length > 0
    ? new OpenAI({ apiKey: env.OPENAI_API_KEY })
    : null;

export const MONEY_TIERS = ["budget", "moderate", "premium"] as const;
export type MoneyTier = (typeof MONEY_TIERS)[number];

export type MoodSignals = {
  currentEnergy?: string;
  timeAvailable?: string;
  hungerLevel?: string;
  indoorOutdoorPreference?: string;
  [key: string]: string | undefined;
};

function isMoneyTier(value: unknown): value is MoneyTier {
  return typeof value === "string" && MONEY_TIERS.includes(value as MoneyTier);
}

const summarySchema = z.object({
  headline: z.string(),
  summary: z.string(),
  vibeKeywords: z.array(z.string()).min(3).max(8),
  budgetTier: z.enum(MONEY_TIERS),
  energyLevel: z.enum(["low", "medium", "high"]),
  timeWindow: z.string(),
  hungerLevel: z.string(),
  callToAction: z.string(),
});

const ideaSchema = z.object({
  title: z.string(),
  description: z.string(),
  type: z.enum(["active", "relaxed", "balanced"]),
  priceLevel: z.enum(MONEY_TIERS),
  duration: z.string(),
  highlights: z.array(z.string()).min(2).max(6),
  venueSlugs: z.array(z.string()).min(1).max(2),
  bookingLink: z.string().url().optional(),
  qrPayload: z.string().optional(),
});

const plannerSchema = z.object({
  ideas: z.array(ideaSchema).min(3).max(4),
  debugNotes: z.array(z.string()).optional(),
});

export type PreferenceSummary = z.infer<typeof summarySchema>;
export type AdvisorIdea = z.infer<typeof ideaSchema>;

export type GroupStatsExtended = {
  participantCount: number;
  avgActivityLevel: number;
  popularMoneyPreference: MoneyTier;
  moneyPreferenceCounts: Record<MoneyTier, number>;
  energyLabel: "low" | "medium" | "high";
};

type PlaceholderAnswer = {
  id: string;
  question: string;
  answer: string;
  confidence: "high" | "medium" | "low";
};

type SummarySignals = {
  groupId: string;
  participantCount: number;
  organizerLabel: string;
  baseLocation: string;
  timeWindow: string;
  vibeHint: string;
  hungerLevel: string;
  stats: GroupStatsExtended;
  placeholderAnswers: PlaceholderAnswer[];
  moodSignals: MoodSignals;
};

type PlannerInput = {
  summary: PreferenceSummary;
  stats: GroupStatsExtended;
  venues: DemoVenue[];
  liveSignals?: MoodSignals;
};

export async function generateSummaryContext(
  eventGroup: EventGroup & { preferences: EventGroupPreference[] },
) {
  const stats = computeGroupStats(eventGroup.preferences);
  const signals = buildSummarySignals(eventGroup, stats);
  const summary = await runSummaryAgent(signals);

  return { summary, stats, moodSignals: signals.moodSignals };
}

export async function runAdvisorPipeline({
  eventGroup,
}: {
  eventGroup: EventGroup & { preferences: EventGroupPreference[] };
}) {
  const { summary, stats, moodSignals } = await generateSummaryContext(eventGroup);
  const plan = await runPlannerAgent({
    summary,
    stats,
    venues: demoVenues,
    liveSignals: moodSignals,
  });

  return {
    summary,
    ideas: plan.ideas,
    stats,
    debugNotes: plan.debugNotes ?? [],
  };
}

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
const rawSummarySchema = zodToJsonSchemaTyped(summarySchema);
const summaryJsonSchema = sanitizeSchemaForOpenAI(rawSummarySchema);

async function runSummaryAgent(
  signals: SummarySignals,
): Promise<PreferenceSummary> {
  if (!openaiClient || !env.OPENAI_MODEL) {
    return buildFallbackSummary(signals);
  }

  const client = openaiClient;

  try {
    const request: ResponseCreateParamsNonStreaming = {
      model: env.OPENAI_MODEL,
      temperature: 0.4,
      text: {
        format: {
          type: "json_schema",
          name: "preference_summary",
          schema: summaryJsonSchema,
          strict: true,
        },
      },
      input: [
        {
          role: "system",
          content:
            "You are Wolt Advisor's Preference Summarizer. Craft upbeat, concrete summaries that capture a friend group's energy.",
        },
        {
          role: "user",
          content: JSON.stringify({
            groupId: signals.groupId,
            participantCount: signals.participantCount,
            organizerLabel: signals.organizerLabel,
            baseLocation: signals.baseLocation,
            timeWindow: signals.timeWindow,
            vibeHint: signals.vibeHint,
            hungerLevel: signals.hungerLevel,
            stats: {
              avgActivityLevel: signals.stats.avgActivityLevel,
              energyLabel: signals.stats.energyLabel,
              moneyPreferenceCounts: signals.stats.moneyPreferenceCounts,
              dominantBudget: signals.stats.popularMoneyPreference,
            },
            placeholderAnswers: signals.placeholderAnswers,
            liveSignals: signals.moodSignals,
          }),
        },
      ],
    };

    const responsesApi = client.responses;
    const response = await responsesApi.create(request);

    const raw = response.output_text;

    if (!raw) {
      throw new Error("Missing summary payload");
    }

    const summaryPayload: unknown = JSON.parse(raw);
    const parsed = summarySchema.parse(summaryPayload);

    return parsed;
  } catch (error) {
    console.warn(
      "[AdvisorPipeline] Summary agent failed, using fallback",
      error,
    );
    return buildFallbackSummary(signals);
  }
}

// Generate schema without name to avoid $ref at root
const rawPlannerSchema = zodToJsonSchemaTyped(plannerSchema);
const plannerJsonSchema = sanitizeSchemaForOpenAI(rawPlannerSchema);

async function runPlannerAgent({
  summary,
  stats,
  venues,
  liveSignals,
}: PlannerInput): Promise<{ ideas: AdvisorIdea[]; debugNotes?: string[] }> {
  if (!openaiClient || !env.OPENAI_MODEL) {
    return {
      ideas: buildFallbackIdeas(summary, stats, venues, liveSignals),
      debugNotes: ["fallback-mode"],
    };
  }

  const client = openaiClient;

  const promptPayload = {
    summary,
    stats,
    liveSignals: liveSignals ?? {},
    requirements: {
      count: 3,
      city: "Espoo",
      anchor: "Hype Areena & Tapiola radius 2km",
      instructions: [
        "Use only the venues listed below.",
        "Each idea can pair up to two venues (e.g., activity + dining).",
        "Reference venues by slug, no made-up locations.",
        "Ensure priceLevel aligns with summary budgetTier or provide a good contrast.",
        "Surface concrete time slots or availability labels when provided.",
      ],
    },
    venues: buildVenueContext(venues),
  };

  try {
    const request: ResponseCreateParamsNonStreaming = {
      model: env.OPENAI_MODEL,
      temperature: 0.5,
      text: {
        format: {
          type: "json_schema",
          name: "planner_ideas",
          schema: plannerJsonSchema,
          strict: true,
        },
      },
      input: [
        {
          role: "system",
          content:
            "You are Wolt Advisor's Planning Agent. Combine local venues into 3 shippable event ideas with clear rationale.",
        },
        {
          role: "user",
          content: JSON.stringify(promptPayload),
        },
      ],
    };

    const responsesApi = client.responses;
    const response = await responsesApi.create(request);

    const raw = response.output_text;

    if (!raw) {
      throw new Error("Missing planner payload");
    }

    const plannerPayload: unknown = JSON.parse(raw);
    const parsed = plannerSchema.parse(plannerPayload);

    return {
      ideas: parsed.ideas,
      debugNotes: parsed.debugNotes,
    };
  } catch (error) {
    console.warn(
      "[AdvisorPipeline] Planner agent failed, using fallback",
      error,
    );
    return {
      ideas: buildFallbackIdeas(summary, stats, venues, liveSignals),
      debugNotes: ["planner-fallback"],
    };
  }
}

export function computeGroupStats(
  preferences: EventGroupPreference[],
): GroupStatsExtended {
  const participantCount = preferences.length;
  const totalActivity = preferences.reduce(
    (sum, pref) => sum + pref.activityLevel,
    0,
  );
  const avgActivityLevel =
    participantCount > 0 ? totalActivity / participantCount : 3;
  const moneyPreferenceCounts: Record<MoneyTier, number> = {
    budget: 0,
    moderate: 0,
    premium: 0,
  };

  for (const pref of preferences) {
    const preference = pref.moneyPreference;
    if (isMoneyTier(preference)) {
      moneyPreferenceCounts[preference] += 1;
    }
  }

  const popularMoneyPreference =
    (Object.entries(moneyPreferenceCounts).sort(
      (a, b) => b[1] - a[1],
    )[0]?.[0] as MoneyTier | undefined) ?? "moderate";

  const energyLabel = deriveEnergyLabel(avgActivityLevel);

  return {
    participantCount,
    avgActivityLevel,
    popularMoneyPreference,
    moneyPreferenceCounts,
    energyLabel,
  };
}

function deriveEnergyLabel(avg: number): "low" | "medium" | "high" {
  if (avg >= 4) return "high";
  if (avg >= 2.75) return "medium";
  return "low";
}

function buildSummarySignals(
  eventGroup: EventGroup & { preferences: EventGroupPreference[] },
  stats: GroupStatsExtended,
): SummarySignals {
  const moodSignals = extractMoodSignals(eventGroup.preferences);
  const baseLocation =
    eventGroup.preferredLocation ??
    eventGroup.city ??
    "Espoo · Hype Areena radius";
  const timeWindow = describeTimeWindow(
    eventGroup.targetTime,
    moodSignals.timeAvailable,
  );
  const vibeHint =
    deriveVibeHint(stats.energyLabel, moodSignals.currentEnergy) ??
    (stats.energyLabel === "high"
      ? "competitive-high energy hang"
      : stats.energyLabel === "medium"
        ? "balanced social adventure"
        : "cozy, conversation-first flow");

  const hungerLevel = describeHungerLevel(moodSignals.hungerLevel);

  const placeholderAnswers: PlaceholderAnswer[] = [];

  if (moodSignals.currentEnergy) {
    placeholderAnswers.push({
      id: "energy-live",
      question: "Live energy ping",
      answer: moodSignals.currentEnergy,
      confidence: "high",
    });
  }
  if (moodSignals.timeAvailable) {
    placeholderAnswers.push({
      id: "time-live",
      question: "Live time estimate",
      answer: moodSignals.timeAvailable,
      confidence: "high",
    });
  }
  if (moodSignals.hungerLevel) {
    placeholderAnswers.push({
      id: "hunger-live",
      question: "Live hunger check",
      answer: moodSignals.hungerLevel,
      confidence: "high",
    });
  }

  if (!moodSignals.currentEnergy) {
    placeholderAnswers.push({
      id: "energy",
      question: "What's the vibe / energy level?",
      answer: stats.energyLabel,
      confidence: "medium",
    });
  }

  if (!moodSignals.timeAvailable) {
    placeholderAnswers.push({
      id: "time",
      question: "How much time do you have?",
      answer: timeWindow,
      confidence: "low",
    });
  }

  if (!moodSignals.hungerLevel) {
    placeholderAnswers.push({
      id: "hunger",
      question: "How hungry is the group?",
      answer: hungerLevel,
      confidence: "low",
    });
  }

  placeholderAnswers.push({
    id: "budget",
    question: "How much are you willing to spend?",
    answer: stats.popularMoneyPreference,
    confidence: stats.participantCount > 1 ? "high" : "medium",
  });

  return {
    groupId: eventGroup.id,
    participantCount: stats.participantCount,
    organizerLabel: eventGroup.name ?? "Friend crew",
    baseLocation,
    timeWindow,
    vibeHint,
    hungerLevel,
    stats,
    placeholderAnswers,
    moodSignals,
  };
}

function buildVenueContext(venues: DemoVenue[]) {
  return venues.map((venue) => {
    const availability =
      venue.enriched?.availability?.slice(0, 2).map(normalizeSlot) ?? [];
    return {
      slug: venue.slug,
      name: venue.name,
      category: venue.enriched?.category ?? venue.type,
      subCategory: venue.enriched?.subCategory,
      budgetLevel: venue.enriched?.budgetLevel ?? "moderate",
      vibeTags: venue.enriched?.vibeTags ?? [],
      distanceToHypeKm: venue.enriched?.distanceHintsKm?.hypeAreena,
      groupSuitability: venue.enriched?.groupSuitability,
      availability,
      booking: venue.enriched?.booking,
      addOns: venue.enriched?.addOns ?? [],
      notes: venue.notes,
    };
  });
}

function normalizeSlot(slot: DemoVenueAvailability) {
  return {
    label: slot.label,
    pricePerPerson:
      slot.pricePerPerson ??
      (slot.priceTotal && slot.capacity
        ? Number((slot.priceTotal / slot.capacity).toFixed(2))
        : undefined),
    priceTotal: slot.priceTotal,
    currency: slot.currency ?? "EUR",
    bookingLink: slot.bookingLink,
  };
}

function buildFallbackSummary(signals: SummarySignals): PreferenceSummary {
  const { stats } = signals;
  const keywords = [
    signals.baseLocation,
    stats.popularMoneyPreference,
    stats.energyLabel,
    signals.vibeHint,
  ];

  return {
    headline: `${signals.participantCount || 3}-person ${signals.vibeHint}`,
    summary: `Crew leans ${stats.energyLabel} energy with ${
      stats.popularMoneyPreference
    } spend comfort. Staying close to ${signals.baseLocation} for ${
      signals.timeWindow
    }.`,
    vibeKeywords: keywords,
    budgetTier: stats.popularMoneyPreference,
    energyLevel: stats.energyLabel,
    timeWindow: signals.timeWindow,
    hungerLevel: signals.hungerLevel,
    callToAction: "Lock in one plan and send the Wolt link to confirm + split.",
  };
}

function buildFallbackIdeas(
  summary: PreferenceSummary,
  stats: GroupStatsExtended,
  venues: DemoVenue[],
  liveSignals?: MoodSignals,
): AdvisorIdea[] {
  const ranked = rankVenuesByBudget(summary.budgetTier, venues);
  const activity = ranked.activities[0];
  const dining = ranked.dining[0];
  const wildcard =
    ranked.wildcards[0] ?? ranked.activities[1] ?? ranked.dining[1];

  const energyPreference = resolveEnergyFromSignals(
    liveSignals,
    stats.energyLabel,
  );

  const ideas: AdvisorIdea[] = [];

  if (activity) {
    ideas.push(
      createIdeaFromVenue({
        venue: activity,
        type:
          energyPreference === "low"
            ? "relaxed"
            : energyPreference === "medium"
              ? "balanced"
              : "active",
        label: "Onsite play",
      }),
    );
  }

  if (dining) {
    ideas.push(
      createIdeaFromVenue({
        venue: dining,
        type: "balanced",
        label: "Shared bites",
      }),
    );
  }

  if (wildcard) {
    ideas.push(
      createIdeaFromVenue({
        venue: wildcard,
        type:
          energyPreference === "low"
            ? "relaxed"
            : energyPreference === "high"
              ? "active"
              : "balanced",
        label: "Wildcard",
      }),
    );
  }

  return ideas.slice(0, 3);
}

function rankVenuesByBudget(target: string, venues: DemoVenue[]) {
  const budgetRank: Record<string, number> = {
    budget: 1,
    moderate: 2,
    premium: 3,
  };
  const targetRank = budgetRank[target] ?? 2;

  const sorted = [...venues].sort((a, b) => {
    const aRank = budgetRank[a.enriched?.budgetLevel ?? "moderate"] ?? 2;
    const bRank = budgetRank[b.enriched?.budgetLevel ?? "moderate"] ?? 2;
    return Math.abs(aRank - targetRank) - Math.abs(bRank - targetRank);
  });

  const activities = sorted.filter(
    (venue) => venue.enriched?.category === "activity",
  );
  const dining = sorted.filter(
    (venue) =>
      venue.enriched?.category === "dining" ||
      venue.enriched?.category === "coffee",
  );
  const wildcards = sorted.filter(
    (venue) =>
      !activities.includes(venue) &&
      !dining.includes(venue) &&
      venue.enriched?.category !== undefined,
  );

  return { activities, dining, wildcards };
}

function createIdeaFromVenue({
  venue,
  type,
  label,
}: {
  venue: DemoVenue;
  type: "active" | "relaxed" | "balanced";
  label: string;
}): AdvisorIdea {
  const availabilityLabel = venue.enriched?.availability?.[0]?.label;
  const bookingLink =
    venue.enriched?.booking?.link ??
    venue.enriched?.availability?.[0]?.bookingLink;
  const pricePerPerson =
    venue.enriched?.availability?.[0]?.pricePerPerson ??
    (venue.enriched?.availability?.[0]?.priceTotal &&
    venue.enriched?.availability?.[0]?.capacity
      ? Number(
          (
            venue.enriched.availability[0].priceTotal /
            venue.enriched.availability[0].capacity
          ).toFixed(2),
        )
      : undefined);
  const highlights = [
    availabilityLabel
      ? `Slots: ${availabilityLabel}`
      : `Fits ${
          venue.enriched?.groupSuitability?.sweetSpot ??
          venue.enriched?.groupSuitability?.max ??
          6
        } ppl`,
    pricePerPerson
      ? `~€${pricePerPerson} per person`
      : `Budget: ${venue.enriched?.budgetLevel ?? "moderate"}`,
    venue.enriched?.booking?.supportsGroupPaymentSplit
      ? "Wolt split-pay ready"
      : "Shareable booking link",
  ];

  return {
    title: `${label}: ${venue.name}`,
    description:
      venue.description ??
      "Gather the crew for an easy win inside Hype Areena.",
    type,
    priceLevel:
      (venue.enriched?.budgetLevel as AdvisorIdea["priceLevel"]) ?? "moderate",
    duration: venue.enriched?.durationMinutes?.standard
      ? `${venue.enriched?.durationMinutes?.standard} min`
      : "Approx. 90 min",
    highlights,
    venueSlugs: [venue.slug],
    bookingLink,
    qrPayload: venue.enriched?.booking?.qrPayload,
  };
}

function extractMoodSignals(
  preferences: EventGroupPreference[],
): MoodSignals {
  const signals: MoodSignals = {};
  for (const pref of preferences) {
    const responses = (pref as {
      moodResponses?: Record<string, unknown>;
    }).moodResponses;
    if (!responses || typeof responses !== "object") continue;

    for (const key of Object.keys(responses)) {
      if (signals[key]) continue;
      const value = responses[key];
      if (typeof value === "string" && value.trim()) {
        signals[key] = value.trim();
      }
    }
  }
  return signals;
}

function describeTimeWindow(
  targetTime?: string | null,
  timeSignal?: string,
) {
  if (timeSignal) {
    switch (timeSignal) {
      case "<1h":
        return "Under an hour • sprint session";
      case "1-2h":
        return "About 1-2 hours • relaxed pace";
      case "2h+":
        return "2 hours or more • open evening";
      default:
        return `Group-mentioned time: ${timeSignal}`;
    }
  }

  if (targetTime) {
    return `Target time ${targetTime}`;
  }

  return "Weekend afternoon & evening blocks (16:00-23:00)";
}

function describeHungerLevel(hungerSignal?: string) {
  if (!hungerSignal) {
    return "Medium hunger - open to bites or a full meal";
  }

  const normalized = hungerSignal.toLowerCase();
  if (normalized.includes("snack")) return "Snacky - tasting portions";
  if (
    normalized.includes("proper") ||
    normalized.includes("meal") ||
    normalized.includes("hungry")
  ) {
    return "Ready for a proper meal";
  }
  if (normalized.includes("stuffed") || normalized.includes("full")) {
    return "Already full - focus on activities";
  }
  return hungerSignal;
}

function deriveVibeHint(
  energyLabel: "low" | "medium" | "high",
  energySignal?: string,
) {
  if (!energySignal) return undefined;
  const normalized = energySignal.toLowerCase();
  if (normalized.includes("chill") || normalized.includes("low")) {
    return "cozy, conversation-first flow";
  }
  if (
    normalized.includes("balanced") ||
    normalized.includes("medium") ||
    normalized.includes("normal")
  ) {
    return "balanced social adventure";
  }
  if (normalized.includes("hype") || normalized.includes("high")) {
    return "competitive-high energy hang";
  }
  return undefined;
}

function resolveEnergyFromSignals(
  liveSignals: MoodSignals | undefined,
  fallback: "low" | "medium" | "high",
): "low" | "medium" | "high" {
  if (!liveSignals?.currentEnergy) {
    return fallback;
  }
  const normalized = liveSignals.currentEnergy.toLowerCase();
  if (normalized.includes("chill") || normalized.includes("low")) {
    return "low";
  }
  if (
    normalized.includes("balanced") ||
    normalized.includes("medium") ||
    normalized.includes("normal")
  ) {
    return "medium";
  }
  if (normalized.includes("hype") || normalized.includes("high")) {
    return "high";
  }
  return fallback;
}


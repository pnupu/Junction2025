import type { EventGroup, EventGroupPreference } from "@prisma/client";
import OpenAI from "openai";
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

const MONEY_TIERS = ["budget", "moderate", "premium"] as const;
type MoneyTier = (typeof MONEY_TIERS)[number];

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

type GroupStatsExtended = {
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
};

type PlannerInput = {
  summary: PreferenceSummary;
  stats: GroupStatsExtended;
  venues: DemoVenue[];
};

export async function runAdvisorPipeline({
  eventGroup,
}: {
  eventGroup: EventGroup & { preferences: EventGroupPreference[] };
}) {
  const stats = computeGroupStats(eventGroup.preferences);
  const signals = buildSummarySignals(eventGroup, stats);
  const summary = await runSummaryAgent(signals);
  const plan = await runPlannerAgent({
    summary,
    stats,
    venues: demoVenues,
  });

  return {
    summary,
    ideas: plan.ideas,
    stats,
    debugNotes: plan.debugNotes ?? [],
  };
}

async function runSummaryAgent(
  signals: SummarySignals,
): Promise<PreferenceSummary> {
  if (!openaiClient || !env.OPENAI_MODEL) {
    return buildFallbackSummary(signals);
  }

  try {
    const response = await openaiClient.chat.completions.create({
      model: env.OPENAI_MODEL,
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are Wolt Advisor's Preference Summarizer. Craft upbeat, concrete summaries that capture a friend group's energy. Output JSON containing headline, summary, vibeKeywords, budgetTier, energyLevel, timeWindow, hungerLevel, callToAction.",
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
          }),
        },
      ],
    });

    const payload = response.choices[0]?.message?.content;
    if (!payload) {
      throw new Error("Missing summary payload");
    }

    const parsedJson: unknown = JSON.parse(payload);
    const parsed = summarySchema.safeParse(parsedJson);
    if (!parsed.success) {
      throw new Error(parsed.error.message);
    }
    return parsed.data;
  } catch (error) {
    console.warn(
      "[AdvisorPipeline] Summary agent failed, using fallback",
      error,
    );
    return buildFallbackSummary(signals);
  }
}

async function runPlannerAgent({
  summary,
  stats,
  venues,
}: PlannerInput): Promise<{ ideas: AdvisorIdea[]; debugNotes?: string[] }> {
  if (!openaiClient || !env.OPENAI_MODEL) {
    return {
      ideas: buildFallbackIdeas(summary, stats, venues),
      debugNotes: ["fallback-mode"],
    };
  }

  const promptPayload = {
    summary,
    stats,
    requirements: {
      count: 3,
      city: "Espoo",
      anchor: "Hype Areena & Tapiola radius 2km",
      instructions: [
        "Use only the venues listed below.",
        "Each idea can pair up to two venues (e.g., activity + dining).",
        "Reference venues by slug.",
        "Ensure priceLevel aligns with summary budgetTier or provide a good contrast.",
        "Surface concrete time slots or availability labels when provided.",
      ],
    },
    venues: buildVenueContext(venues),
  };

  try {
    const response = await openaiClient.chat.completions.create({
      model: env.OPENAI_MODEL,
      temperature: 0.5,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are Wolt Advisor's Planning Agent. Combine local venues into 3 shippable event ideas with clear rationale. Respond in JSON with `ideas` array.",
        },
        {
          role: "user",
          content: JSON.stringify(promptPayload),
        },
      ],
    });

    const payload = response.choices[0]?.message?.content;
    if (!payload) {
      throw new Error("Missing planner payload");
    }
    const parsedJson: unknown = JSON.parse(payload);
    const parsed = plannerSchema.safeParse(parsedJson);
    if (!parsed.success) {
      throw new Error(parsed.error.message);
    }

    return {
      ideas: parsed.data.ideas,
      debugNotes: parsed.data.debugNotes,
    };
  } catch (error) {
    console.warn(
      "[AdvisorPipeline] Planner agent failed, using fallback",
      error,
    );
    return {
      ideas: buildFallbackIdeas(summary, stats, venues),
      debugNotes: ["planner-fallback"],
    };
  }
}

function computeGroupStats(
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
  const baseLocation =
    eventGroup.preferredLocation ??
    eventGroup.city ??
    "Espoo · Hype Areena radius";
  const timeWindow =
    eventGroup.targetTime ?? "Weekend afternoon & evening blocks (16:00-23:00)";
  const vibeHint =
    stats.energyLabel === "high"
      ? "competitive-high energy hang"
      : stats.energyLabel === "medium"
        ? "balanced social adventure"
        : "cozy, conversation-first flow";

  const placeholderAnswers: PlaceholderAnswer[] = [
    {
      id: "budget",
      question: "How much are you willing to spend?",
      answer: stats.popularMoneyPreference,
      confidence: stats.participantCount > 1 ? "high" : "medium",
    },
    {
      id: "energy",
      question: "What's the vibe / energy level?",
      answer: stats.energyLabel,
      confidence: "medium",
    },
    {
      id: "time",
      question: "How much time do you have?",
      answer: timeWindow,
      confidence: "low",
    },
    {
      id: "hunger",
      question: "How hungry is the group?",
      answer: "Medium hunger - open to bites or a full meal",
      confidence: "low",
    },
  ];

  return {
    groupId: eventGroup.id,
    participantCount: stats.participantCount,
    organizerLabel: eventGroup.name ?? "Friend crew",
    baseLocation,
    timeWindow,
    vibeHint,
    hungerLevel: "Medium",
    stats,
    placeholderAnswers,
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
): AdvisorIdea[] {
  const ranked = rankVenuesByBudget(summary.budgetTier, venues);
  const activity = ranked.activities[0];
  const dining = ranked.dining[0];
  const wildcard =
    ranked.wildcards[0] ?? ranked.activities[1] ?? ranked.dining[1];

  const ideas: AdvisorIdea[] = [];

  if (activity) {
    ideas.push(
      createIdeaFromVenue({
        venue: activity,
        type: stats.energyLabel === "low" ? "balanced" : "active",
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
        type: stats.energyLabel === "low" ? "relaxed" : "balanced",
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

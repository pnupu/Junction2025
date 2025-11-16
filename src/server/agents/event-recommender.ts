import type { PrismaClient } from "@prisma/client";
import type { EventGroup, EventGroupPreference } from "@prisma/client";
import OpenAI from "openai";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { ResponseCreateParamsNonStreaming } from "openai/resources/responses/responses";
import { env } from "@/env";
import type { FilteredVenue } from "@/server/agents/venue-filter";
import {
  type GroupStatsExtended,
  type PreferenceSummary,
} from "@/server/agents/advisor-pipeline";

const openaiClient =
  env.OPENAI_API_KEY && env.OPENAI_API_KEY.length > 0
    ? new OpenAI({ apiKey: env.OPENAI_API_KEY })
    : null;

const recommendationSchema = z.object({
  venueId: z.string(),
  venueSlug: z.string(),
  matchScore: z.number().min(0).max(1),
  reasoning: z.string(),
  title: z.string(),
  description: z.string(),
  highlights: z.array(z.string()).min(1).max(5),
});

const recommendationsResponseSchema = z.object({
  recommendations: z.array(recommendationSchema).min(1).max(10),
  debugNotes: z.array(z.string()).optional(),
});

type JsonSchema = Record<string, unknown>;

const zodToJsonSchemaTyped = zodToJsonSchema as (
  schema: z.ZodTypeAny,
  options?: { name?: string; target?: string },
) => JsonSchema;

function sanitizeSchemaForOpenAI(schema: JsonSchema): JsonSchema {
  const sanitized = { ...schema };

  if (sanitized.type === "object" || sanitized.properties) {
    sanitized.type = "object";
    sanitized.additionalProperties = false;

    if (sanitized.properties && typeof sanitized.properties === "object") {
      const props = sanitized.properties as Record<string, JsonSchema>;
      sanitized.properties = Object.fromEntries(
        Object.entries(props).map(([key, value]) => [
          key,
          sanitizeSchemaForOpenAI(value),
        ]),
      );

      if (!sanitized.required || !Array.isArray(sanitized.required)) {
        sanitized.required = Object.keys(props);
      }
    }
  }

  if (sanitized.type === "array" || sanitized.items) {
    sanitized.type = "array";
    if (sanitized.items && typeof sanitized.items === "object") {
      sanitized.items = sanitizeSchemaForOpenAI(sanitized.items as JsonSchema);
    }
  }

  return sanitized;
}

const rawRecommendationsSchema = zodToJsonSchemaTyped(
  recommendationsResponseSchema,
);
const recommendationsJsonSchema = sanitizeSchemaForOpenAI(
  rawRecommendationsSchema,
);

export type EventRecommendationInput = {
  eventGroup: EventGroup & { preferences: EventGroupPreference[] };
  filteredVenues: FilteredVenue[];
  summary: PreferenceSummary;
  stats: GroupStatsExtended;
  moodResponses: Record<string, unknown>;
};

/**
 * Generate event recommendations from mood responses and filtered venues
 */
export async function generateEventRecommendations(
  db: PrismaClient,
  input: EventRecommendationInput,
): Promise<{
  recommendations: Array<{
    venueId: string;
    matchScore: number;
    reasoning: string;
    title: string;
    description: string;
    highlights: string[];
  }>;
  debugNotes?: string[];
}> {
  const { filteredVenues, summary, stats, moodResponses } = input;

  if (filteredVenues.length === 0) {
    return {
      recommendations: [],
      debugNotes: ["No filtered venues available"],
    };
  }

  // Build venue context for AI
  const venueContext = filteredVenues.slice(0, 30).map((venue) => ({
    id: venue.id,
    slug: venue.slug,
    name: venue.name,
    type: venue.type,
    description: venue.description ?? "",
    address: venue.address ?? "",
    distanceKm: venue.distanceMeters
      ? (venue.distanceMeters / 1000).toFixed(1)
      : undefined,
    woltPartnerTier: venue.woltPartnerTier,
  }));

  // Use AI to generate recommendations if available
  if (openaiClient && env.OPENAI_MODEL) {
    try {
      const prompt = {
        groupContext: {
          participantCount: stats.participantCount,
          energyLevel: stats.energyLabel,
          budgetTier: stats.popularMoneyPreference,
          avgActivityLevel: stats.avgActivityLevel,
        },
        preferences: {
          summary: summary.summary,
          vibeKeywords: summary.vibeKeywords,
          timeWindow: summary.timeWindow,
          hungerLevel: summary.hungerLevel,
        },
        moodResponses,
        availableVenues: venueContext,
        instructions: [
          "Select the best venues from the available list that match the group's preferences and mood.",
          "Generate 3-5 recommendations with match scores, reasoning, and highlights.",
          "Consider distance, venue type, and group preferences.",
        ],
      };

      const request: ResponseCreateParamsNonStreaming = {
        model: env.OPENAI_MODEL,
        temperature: 0.6,
        text: {
          format: {
            type: "json_schema",
            name: "event_recommendations",
            schema: recommendationsJsonSchema,
            strict: true,
          },
        },
        input: [
          {
            role: "system",
            content:
              "You are Wolt Advisor's Event Recommendation Agent. Generate personalized event recommendations based on group preferences, mood responses, and available venues. Match venues to the group's energy level, budget, and current mood.",
          },
          {
            role: "user",
            content: JSON.stringify(prompt),
          },
        ],
      };

      const responsesApi = openaiClient.responses;
      const response = await responsesApi.create(request);

      const raw = response.output_text;
      if (!raw) {
        throw new Error("Missing recommendations payload");
      }

      const payload: unknown = JSON.parse(raw);
      const parsed = recommendationsResponseSchema.parse(payload);

      return {
        recommendations: parsed.recommendations,
        debugNotes: parsed.debugNotes,
      };
    } catch (error) {
      console.warn(
        "[EventRecommender] AI generation failed, using fallback",
        error,
      );
    }
  }

  // Fallback: generate recommendations based on match scores
  return generateFallbackRecommendations(filteredVenues, stats, moodResponses);
}

function generateFallbackRecommendations(
  filteredVenues: FilteredVenue[],
  stats: GroupStatsExtended,
  _moodResponses: Record<string, unknown>,
): {
  recommendations: Array<{
    venueId: string;
    matchScore: number;
    reasoning: string;
    title: string;
    description: string;
    highlights: string[];
  }>;
  debugNotes: string[];
} {
  // Sort by match score and take top venues
  const sorted = [...filteredVenues]
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 5);

  const recommendations = sorted.map((venue) => {
    const distanceText = venue.distanceMeters
      ? `${(venue.distanceMeters / 1000).toFixed(1)}km away`
      : "Location available";

    const highlights: string[] = [venue.type, distanceText];

    if (venue.woltPartnerTier) {
      highlights.push(`Wolt ${venue.woltPartnerTier} partner`);
    }

    return {
      venueId: venue.id,
      matchScore: venue.matchScore,
      reasoning: `Matches group's ${stats.energyLabel} energy and ${stats.popularMoneyPreference} budget preference. ${venue.description ?? "Great option for the group."}`,
      title: venue.name,
      description:
        venue.description ?? `A ${venue.type} venue perfect for your group.`,
      highlights,
    };
  });

  return {
    recommendations,
    debugNotes: ["fallback-mode"],
  };
}

/**
 * Save recommendations to database as EventRecommendation records
 */
export async function saveEventRecommendations(
  db: PrismaClient,
  eventGroupId: string,
  recommendations: Array<{
    venueId: string;
    matchScore: number;
    reasoning: string;
    title: string;
    description: string;
    highlights: string[];
  }>,
): Promise<void> {
  // Create Event records for each recommendation if they don't exist
  // Then create EventRecommendation records linking to the group

  // Fetch all venues in parallel
  const venueIds = recommendations.map((rec) => rec.venueId);
  const venues = await db.infrastructureVenue.findMany({
    where: { id: { in: venueIds } },
  });
  const venueMap = new Map(venues.map((v) => [v.id, v]));

  // Process all recommendations in parallel
  await Promise.all(
    recommendations.map(async (rec) => {
      const venue = venueMap.get(rec.venueId);

      if (!venue) {
        console.warn(`Venue ${rec.venueId} not found, skipping recommendation`);
        return;
      }

      // Extract enriched data for price and duration
      const enrichedData = venue.enrichedData as
        | {
            budgetLevel?: "budget" | "moderate" | "premium" | string;
            durationMinutes?: {
              standard?: number;
              min?: number;
              max?: number;
            };
          }
        | null
        | undefined;

      // Map budgetLevel to priceRange
      const priceRange = (() => {
        if (enrichedData?.budgetLevel) {
          const level = enrichedData.budgetLevel.toLowerCase();
          if (level === "budget") return "low";
          if (level === "premium") return "high";
          return "medium";
        }
        return "medium"; // Default
      })();

      // Get duration from enriched data
      const duration = enrichedData?.durationMinutes?.standard ?? null;

      // Create Event (using cuid for ID)
      const event = await db.event.create({
        data: {
          title: rec.title,
          description: rec.description,
          venueId: null, // InfrastructureVenue is separate from Venue model
          customLocation: venue.address ?? undefined,
          tags: rec.highlights,
          priceRange,
          duration,
          isActive: true,
        },
      });

      // Create EventRecommendation
      await db.eventRecommendation.create({
        data: {
          eventId: event.id,
          groupId: eventGroupId,
          matchScore: rec.matchScore,
          reasoning: rec.reasoning,
          modelVersion: env.OPENAI_MODEL,
          features: {
            highlights: rec.highlights,
            venueId: rec.venueId,
          },
          status: "generated",
        },
      });
    }),
  );
}

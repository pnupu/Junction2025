import type { InfrastructureVenue, PrismaClient } from "@prisma/client";
import OpenAI from "openai";
import { z } from "zod";

import { env } from "@/env";

const recommendationSchema = z.object({
  recommendations: z
    .array(
      z.object({
        opportunitySlug: z.string(),
        title: z.string(),
        summary: z.string(),
        whyItWorks: z.string(),
        activationPlan: z.string(),
        matchScore: z.number().min(0).max(1).optional(),
      }),
    )
    .min(1)
    .max(4),
});

type RecommendationChoice = z.infer<
  typeof recommendationSchema
>["recommendations"][number];

export type OpportunityRecommendationInput = {
  city?: string;
  vibe?: string;
  focus?: string;
  dietarySignals?: string[];
};

const openaiClient =
  env.OPENAI_API_KEY && env.OPENAI_API_KEY.length > 0
    ? new OpenAI({ apiKey: env.OPENAI_API_KEY })
    : null;

export async function runOpportunityRecommendationAgent({
  db,
  input,
}: {
  db: PrismaClient;
  input: OpportunityRecommendationInput;
}) {
  const opportunities = await db.eventOpportunity.findMany({
    where: {
      status: { in: ["idea", "shortlisted"] },
      city: input.city
        ? {
            equals: input.city,
            mode: "insensitive",
          }
        : undefined,
    },
    orderBy: [{ priorityScore: "desc" }, { createdAt: "desc" }],
    include: {
      venues: {
        include: {
          venue: true,
        },
      },
    },
    take: 10,
  });

  if (opportunities.length === 0) {
    return {
      recommendations: [],
      meta: {
        source: "none" as const,
        model: env.OPENAI_MODEL,
        note: "No opportunities available yet. Run the scout agent first.",
      },
    };
  }

  const prompt = buildRecommendationPrompt(opportunities, input);
  const parsed: RecommendationChoice[] =
    openaiClient && env.OPENAI_MODEL
      ? await fetchRecommendations(prompt)
      : fallbackFromOpportunities(opportunities);

  const joined = await Promise.all(
    parsed.map(async (rec) => {
      const opportunity = opportunities.find(
        (opp) => opp.slug === rec.opportunitySlug,
      );

      if (!opportunity) return null;

      const record = await db.eventRecommendation.create({
        data: {
          opportunityId: opportunity.id,
          matchScore: rec.matchScore ?? 0.72,
          reasoning: rec.whyItWorks,
          modelVersion: env.OPENAI_MODEL,
          features: {
            vibe: input.vibe,
            focus: input.focus,
            dietary: input.dietarySignals,
          },
        },
        include: {
          opportunity: {
            include: {
              venues: {
                include: {
                  venue: true,
                },
              },
            },
          },
        },
      });

      return {
        recommendation: record,
        activationPlan: rec.activationPlan,
        summary: rec.summary,
        title: rec.title,
      };
    }),
  );

  const filtered = joined.filter((item): item is NonNullable<typeof item> =>
    Boolean(item),
  );

  return {
    recommendations: filtered,
    meta: {
      source: openaiClient ? "openai" : "fallback",
      model: env.OPENAI_MODEL,
    },
  };
}

async function fetchRecommendations(
  prompt: string,
): Promise<RecommendationChoice[]> {
  if (!openaiClient) return [];

  const response = await openaiClient.chat.completions.create({
    model: env.OPENAI_MODEL,
    temperature: 0.5,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You are Wolt's plan-matching agent. Pick the best stored opportunities for the crew profile provided.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  const payload = response.choices[0]?.message?.content;
  if (!payload) return [];

  const raw: unknown = JSON.parse(payload);
  const parsed = recommendationSchema.safeParse(raw);
  if (!parsed.success) {
    console.warn("[OpportunityRecommender] parse error", parsed.error.message);
    return [];
  }

  return parsed.data.recommendations;
}

function fallbackFromOpportunities(
  opportunities: {
    slug: string;
    title: string;
    summary: string;
    woltContribution: string;
    venues: { venue: { name: string; sourceName: string } }[];
  }[],
): RecommendationChoice[] {
  return opportunities.slice(0, 3).map((opp, index) => ({
    opportunitySlug: opp.slug,
    title: opp.title,
    summary: opp.summary,
    whyItWorks: `${opp.woltContribution} Grounded by ${opp.venues[0]?.venue.name ?? "local venue"} (${opp.venues[0]?.venue.sourceName ?? "city dataset"}).`,
    activationPlan:
      "Coordinate via internal host. Use Wolt courier drop + onsite lead.",
    matchScore: 0.65 + index * 0.05,
  }));
}

function buildRecommendationPrompt(
  opportunities: {
    slug: string;
    title: string;
    summary: string;
    woltContribution: string;
    locationType: string;
    locationDetails: string | null;
    keywords: string[];
    venues: { venue: InfrastructureVenue }[];
  }[],
  input: OpportunityRecommendationInput,
) {
  const profileLines = [
    input.city ? `City focus: ${input.city}` : undefined,
    input.vibe ? `Crew vibe: ${input.vibe}` : undefined,
    input.focus ? `Agenda focus: ${input.focus}` : undefined,
    input.dietarySignals?.length
      ? `Dietary signals: ${input.dietarySignals.join(", ")}`
      : undefined,
  ].filter(Boolean);

  const opportunityLines = opportunities.map((opp) => {
    const primaryVenue = opp.venues[0]?.venue;
    return `- slug:${opp.slug} | ${opp.title} | venue:${primaryVenue?.name ?? "unknown"} (${primaryVenue?.sourceName ?? "local source"}) | ${opp.locationType} @ ${opp.locationDetails ?? "flex"} | why:${opp.woltContribution} | tags:${opp.keywords.join(", ")}`;
  });

  return [
    "Available opportunities (use slug to reference):",
    ...opportunityLines,
    "",
    "Crew profile:",
    ...profileLines,
    "",
    'Select the top 3 opportunities and respond as JSON with shape {"recommendations":[{opportunitySlug,title,summary,whyItWorks,activationPlan,matchScore}]}',
  ].join("\n");
}

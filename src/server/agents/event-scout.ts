import type {
  EventOpportunity,
  InfrastructureVenue,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import OpenAI from "openai";
import { z } from "zod";

import { env } from "@/env";

const opportunityIdeaSchema = z.object({
  title: z.string(),
  summary: z.string(),
  locationType: z
    .enum(["existing-venue", "pop-up", "hybrid"])
    .default("existing-venue"),
  locationDetails: z.string().optional(),
  opportunityType: z.string(),
  woltContribution: z.string(),
  partnerVenues: z.array(z.string()).min(1),
  keywords: z.array(z.string()).min(1).max(10),
  estimatedBudget: z.string().optional(),
  idealUseCase: z.string().optional(),
  seasonality: z.string().optional(),
  priorityScore: z.number().min(0).max(1).optional(),
  venueSlug: z.string(),
  sourceUrl: z.string().url().optional(),
  sourceName: z.string().optional(),
});

const opportunityResponseSchema = z.object({
  opportunities: z.array(opportunityIdeaSchema).min(3).max(6),
});

type OpportunityIdea = z.infer<typeof opportunityIdeaSchema>;

export type EventScoutInput = {
  city: string;
  country?: string;
  focusAreas?: string[];
  includeExistingSpaces?: boolean;
  notes?: string;
};

const openaiClient =
  env.OPENAI_API_KEY && env.OPENAI_API_KEY.length > 0
    ? new OpenAI({ apiKey: env.OPENAI_API_KEY })
    : null;

export async function runEventScoutAgent({
  db,
  input,
}: {
  db: PrismaClient;
  input: EventScoutInput;
}) {
  const venues = await db.infrastructureVenue.findMany({
    where: {
      city: {
        equals: input.city,
        mode: "insensitive",
      },
    },
    orderBy: [{ woltPartnerTier: "desc" }, { updatedAt: "desc" }],
    take: 8,
  });

  if (!venues.length) {
    return {
      opportunities: [],
      meta: {
        total: 0,
        source: "missing-data",
        model: env.OPENAI_MODEL,
      },
    };
  }

  const prompt = buildScoutPrompt(input, venues);
  const ideasRaw =
    openaiClient && env.OPENAI_MODEL
      ? await fetchIdeasFromOpenAI(prompt)
      : buildFallbackIdeas(venues);

  const ideas = ideasRaw.filter((idea) =>
    venues.some((venue) => venue.slug === idea.venueSlug),
  );

  const saved = await Promise.all(
    ideas.map(async (idea, index) => {
      const venue = venues.find((v) => v.slug === idea.venueSlug);
      if (!venue) return null;

      const record = await upsertOpportunity(
        db,
        idea,
        {
          city: input.city,
          country: input.country,
          ordinal: index + 1,
        },
        venue,
      );

      await linkOpportunityToVenue(db, record.id, venue.id, idea.idealUseCase);
      return record;
    }),
  );

  return {
    opportunities: saved.filter((record): record is EventOpportunity =>
      Boolean(record),
    ),
    meta: {
      total: saved.length,
      source: openaiClient ? "openai" : "fallback",
      model: env.OPENAI_MODEL,
    },
  };
}

async function fetchIdeasFromOpenAI(
  prompt: string,
): Promise<OpportunityIdea[]> {
  if (!openaiClient) return [];

  const response = await openaiClient.chat.completions.create({
    model: env.OPENAI_MODEL,
    temperature: 0.6,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You are Wolt's Event Scout. Focus on concepts where Wolt brings premium food, tech, or logistics superpowers into existing venues like tennis courts, swimming halls, and beaches.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  const payload = response.choices[0]?.message?.content;
  if (!payload) {
    return [];
  }

  const raw: unknown = JSON.parse(payload);
  const parsed = opportunityResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.warn("[EventScout] Failed to parse response", parsed.error.message);
    return [];
  }

  return parsed.data.opportunities;
}

async function upsertOpportunity(
  db: PrismaClient,
  idea: OpportunityIdea,
  meta: { city: string; country?: string; ordinal: number },
  venue: InfrastructureVenue,
): Promise<EventOpportunity> {
  const slug = createSlug(`${meta.city}-${venue.slug}-${idea.title}`);
  const payload: Prisma.EventOpportunityUncheckedCreateInput = {
    slug,
    title: idea.title,
    summary: idea.summary,
    city: meta.city,
    country: meta.country,
    locationType: idea.locationType,
    locationDetails: idea.locationDetails ?? venue.address,
    opportunityType: idea.opportunityType,
    woltContribution: idea.woltContribution,
    partnerVenues: idea.partnerVenues.length
      ? idea.partnerVenues
      : [venue.name],
    keywords: Array.from(
      new Set([venue.type, venue.city, ...(idea.keywords ?? [])]),
    ).slice(0, 10),
    estimatedBudget: idea.estimatedBudget,
    idealUseCase: idea.idealUseCase,
    seasonality: idea.seasonality,
    priorityScore: idea.priorityScore ?? Math.max(0.5, 1 - meta.ordinal * 0.1),
    status: "idea",
    sourceModel: env.OPENAI_MODEL,
    rawPayload: idea,
  };

  return db.eventOpportunity.upsert({
    where: { slug },
    create: payload,
    update: {
      ...payload,
      priorityScore: payload.priorityScore,
      updatedAt: new Date(),
    },
  });
}

async function linkOpportunityToVenue(
  db: PrismaClient,
  opportunityId: string,
  venueId: string,
  usageNotes?: string,
) {
  await db.opportunityVenueRef.upsert({
    where: {
      opportunityId_venueId: {
        opportunityId,
        venueId,
      },
    },
    create: {
      opportunityId,
      venueId,
      usageNotes,
    },
    update: {
      usageNotes,
    },
  });
}

function buildFallbackIdeas(venues: InfrastructureVenue[]): OpportunityIdea[] {
  return venues.slice(0, 3).map((venue, index) => ({
    title: `${venue.name} takeover`,
    summary: `Activate ${venue.name} with a Wolt-powered ${venue.type.replace(/_/g, " ")} program.`,
    locationType: "existing-venue",
    locationDetails: venue.address ?? venue.description ?? venue.city,
    opportunityType: "wolt-playbook",
    woltContribution:
      "Chef kits, premium beverage drops, lighting, and concierge logistics handled by Wolt.",
    partnerVenues: [venue.name],
    keywords: [venue.type, venue.city.toLowerCase(), "wolt"],
    estimatedBudget: "€3-6k",
    idealUseCase: "30-80 person crews",
    seasonality: index % 2 === 0 ? "May-September" : "Year-round",
    priorityScore: 0.85 - index * 0.05,
    venueSlug: venue.slug,
    sourceUrl: venue.sourceUrl,
    sourceName: venue.sourceName,
  }));
}

function buildScoutPrompt(
  input: EventScoutInput,
  venues: InfrastructureVenue[],
) {
  const lines = [
    `City: ${input.city}`,
    input.country ? `Country: ${input.country}` : undefined,
    input.focusAreas?.length
      ? `Focus areas: ${input.focusAreas.join(", ")}`
      : undefined,
    input.includeExistingSpaces === false
      ? "Avoid existing venues; prioritize fresh pop-ups."
      : "Include clever uses of existing assets like tennis courts, pools, or beaches.",
    input.notes ? `Extra notes: ${input.notes}` : undefined,
    "",
    "You must only use the venues listed below. Reference them using the exact `slug` value in the `venueSlug` field. Include the venue in your partnerVenues array.",
    ...venues.map(
      (venue) =>
        `- ${venue.slug}: ${venue.name} (${venue.type}) · ${venue.description ?? "No description"} · Source ${venue.sourceName} (${venue.sourceUrl})`,
    ),
    "",
    "Return 3-6 JSON ideas under key `opportunities`. Each idea must include `venueSlug`, `partnerVenues`, and a clear Wolt contribution plan tied to that venue.",
  ].filter(Boolean);

  return lines.join("\n");
}

function createSlug(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 60);
}

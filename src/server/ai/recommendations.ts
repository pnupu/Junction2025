import OpenAI from "openai";
import { z } from "zod";

import { env } from "@/env";

type SelectionState = Record<string, string[]>;

export type RecommendationRequest = {
  name?: string;
  city?: string;
  selections: SelectionState;
};

const recommendationSchema = z.object({
  recommendations: z
    .array(
      z.object({
        title: z.string(),
        vibe: z.string(),
        location: z.string(),
        description: z.string(),
        highlights: z.array(z.string()).default([]),
        estimatedBudget: z.string().optional(),
        matchReason: z.string().optional(),
      }),
    )
    .min(3)
    .max(3),
});

export type RecommendationResponse = z.infer<typeof recommendationSchema>;
export type ExperienceRecommendation =
  RecommendationResponse["recommendations"][number];

const fallbackRecommendations: ExperienceRecommendation[] = [
  {
    title: "Neo-Nordic tasting flight",
    vibe: "Cozy · Foodie circuit",
    location: "Kamppi · €€",
    description:
      "Chef-led micro menu with paired natural wines. Includes post-dinner speakeasy route.",
    highlights: [
      "6-course tasting with foraged ingredients",
      "Pairing curated by Helsinki natural wine bar",
      "Ends with invite-only speakeasy lounge",
    ],
    estimatedBudget: "€65-85 per person",
  },
  {
    title: "After-hours design crawl",
    vibe: "Adventurous · Culture hit",
    location: "Design District · €",
    description:
      "Private gallery unlocks + AI-personalized AR guide. Ends with rooftop sauna.",
    highlights: [
      "3 boutique galleries unlocked after closing",
      "AR guide layers design lore on the street wander",
      "Rooftop sauna nightcap with local DJs",
    ],
    estimatedBudget: "€25-40 per person",
  },
  {
    title: "Sunset cold-plunge club",
    vibe: "Chill AF · Wellness",
    location: "Löyly · €€",
    description:
      "Reserved sea-deck, guided breathwork, and post-plunge feast curated via Wolt Market.",
    highlights: [
      "Private deck with towels + cold-plunge timing",
      "Guided breathwork + sauna rotations",
      "Chef-selected feast dropped by Wolt Market",
    ],
    estimatedBudget: "€55-70 per person",
  },
];

const systemPrompt = [
  "You are Wolt's city AI concierge.",
  "Blend food, social spaces, and cultural energy into pop-up itineraries.",
  "Keep ideas grounded in Helsinki-style Nordic urban life unless told otherwise.",
  "Each concept must feel premium yet doable this week.",
  "Return JSON only. Do not add commentary.",
].join(" ");

const openaiApiKey = env.OPENAI_API_KEY;

const openaiClient = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;

export async function generateRecommendations(
  input: RecommendationRequest,
): Promise<{
  experiences: ExperienceRecommendation[];
  meta: { source: "openai" | "fallback"; model: string; generatedAt: string };
}> {
  if (!openaiClient) {
    return {
      experiences: fallbackRecommendations,
      meta: {
        source: "fallback",
        model: env.OPENAI_MODEL,
        generatedAt: new Date().toISOString(),
      },
    };
  }

  const prompt = buildPrompt(input);

  try {
    const completion = await openaiClient.chat.completions.create({
      model: env.OPENAI_MODEL,
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `${systemPrompt} Always respond with JSON shaped like {"recommendations":[{"title":"","vibe":"","location":"","description":"","highlights":[""],"estimatedBudget":"","matchReason":""}]}`,
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const payload = completion.choices[0]?.message?.content;

    if (!payload) {
      throw new Error("OpenAI response did not include any content");
    }

    const parsedJson: unknown = JSON.parse(payload);
    const parsed = recommendationSchema.safeParse(parsedJson);

    if (!parsed.success) {
      throw new Error(parsed.error.message);
    }

    return {
      experiences: parsed.data.recommendations,
      meta: {
        source: "openai",
        model: env.OPENAI_MODEL,
        generatedAt: new Date().toISOString(),
      },
    };
  } catch (cause) {
    const reason =
      cause instanceof Error ? cause.message : "Unknown AI generation error";
    console.error("[AI] Failed to generate recommendations", reason);
    return {
      experiences: fallbackRecommendations,
      meta: {
        source: "fallback",
        model: env.OPENAI_MODEL,
        generatedAt: new Date().toISOString(),
      },
    };
  }
}

function buildPrompt({ name, city, selections }: RecommendationRequest) {
  const lines: string[] = [];

  if (name) {
    lines.push(`Primary organizer: ${name}`);
  }

  if (city) {
    lines.push(`Target city: ${city}`);
  }

  lines.push("Preference signals:");
  lines.push(
    Object.entries(selections)
      .map(([section, values]) => {
        const valueText =
          values && values.length > 0 ? values.join(", ") : "No selection yet";
        return `- ${section}: ${valueText}`;
      })
      .join("\n"),
  );

  lines.push(
    "Output 3 experience cards. Mix venues, pacing, and social energy. Include highlight bullets if relevant.",
  );

  return lines.join("\n");
}

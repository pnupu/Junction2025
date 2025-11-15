import { z } from "zod";

import { generateRecommendations } from "@/server/ai/recommendations";
import { runEventScoutAgent } from "@/server/agents/event-scout";
import { runOpportunityRecommendationAgent } from "@/server/agents/opportunity-recommender";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";

const selectionSchema = z
  .record(z.array(z.string().min(1)))
  .default({})
  .catch({});

export const aiRouter = createTRPCRouter({
  preview: publicProcedure
    .input(
      z.object({
        name: z.string().min(1).max(80).optional(),
        city: z.string().min(1).max(80).optional(),
        selections: selectionSchema,
      }),
    )
    .query(async ({ input }) => {
      const { experiences, meta } = await generateRecommendations({
        name: input.name,
        city: input.city,
        selections: input.selections,
      });

      return {
        recommendations: experiences,
        meta,
      };
    }),

  scoutOpportunities: publicProcedure
    .input(
      z.object({
        city: z.string().min(1),
        country: z.string().min(1).optional(),
        focusAreas: z.array(z.string().min(1)).optional(),
        includeExistingSpaces: z.boolean().optional(),
        notes: z.string().max(400).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return runEventScoutAgent({
        db: ctx.db,
        input: {
          city: input.city,
          country: input.country,
          focusAreas: input.focusAreas,
          includeExistingSpaces: input.includeExistingSpaces,
          notes: input.notes,
        },
      });
    }),

  recommendFromOpportunities: publicProcedure
    .input(
      z.object({
        city: z.string().min(1).optional(),
        vibe: z.string().min(1).optional(),
        focus: z.string().min(1).optional(),
        dietarySignals: z.array(z.string().min(1)).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return runOpportunityRecommendationAgent({
        db: ctx.db,
        input: {
          city: input.city,
          vibe: input.vibe,
          focus: input.focus,
          dietarySignals: input.dietarySignals,
        },
      });
    }),
});


import { z } from "zod";

import { generateRecommendations } from "@/server/ai/recommendations";
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
});


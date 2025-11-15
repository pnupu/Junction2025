import { z } from "zod";
import { runAdvisorPipeline } from "@/server/agents/advisor-pipeline";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { generateShortCode } from "@/lib/generate-short-code";

export const eventRouter = createTRPCRouter({
  // Create a new event group (no input needed - auto-creates)
  create: publicProcedure.mutation(async ({ ctx }) => {
    // Generate a unique short code
    let inviteCode: string;
    let isUnique = false;
    
    while (!isUnique) {
      inviteCode = generateShortCode(6); // 6-character code
      const existing = await ctx.db.eventGroup.findUnique({
        where: { inviteCode },
      });
      if (!existing) {
        isUnique = true;
      }
    }

    const eventGroup = await ctx.db.eventGroup.create({
      data: {
        status: "collecting_preferences",
        inviteCode: inviteCode!,
      },
    });

    return {
      id: eventGroup.id,
      inviteCode: eventGroup.inviteCode,
    };
  }),

  // Get event group by ID or invite code
  get: publicProcedure
    .input(
      z.object({
        id: z.string().optional(),
        inviteCode: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (!input.id && !input.inviteCode) {
        throw new Error("Either id or inviteCode is required");
      }

      const eventGroup = await ctx.db.eventGroup.findFirst({
        where: input.inviteCode
          ? { inviteCode: input.inviteCode }
          : { id: input.id },
        include: {
          preferences: {
            orderBy: {
              createdAt: "asc",
            },
          },
        },
      });

      if (!eventGroup) {
        throw new Error("Event not found");
      }

      return eventGroup;
    }),

  // Add or update preferences for an event
  addPreferences: publicProcedure
    .input(
      z.object({
        groupId: z.string(),
        sessionId: z.string(),
        userName: z.string().optional(),
        userIcon: z.string(),
        moneyPreference: z.enum(["budget", "moderate", "premium"]),
        activityLevel: z.number().min(1).max(5),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const preference = await ctx.db.eventGroupPreference.upsert({
        where: {
          groupId_sessionId: {
            groupId: input.groupId,
            sessionId: input.sessionId,
          },
        },
        create: {
          groupId: input.groupId,
          sessionId: input.sessionId,
          userName: input.userName,
          userIcon: input.userIcon,
          moneyPreference: input.moneyPreference,
          activityLevel: input.activityLevel,
        },
        update: {
          userName: input.userName,
          userIcon: input.userIcon,
          moneyPreference: input.moneyPreference,
          activityLevel: input.activityLevel,
        },
      });

      return preference;
    }),

  // Mark event as ready to generate
  markReadyToGenerate: publicProcedure
    .input(
      z.object({
        groupId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const eventGroup = await ctx.db.eventGroup.update({
        where: { id: input.groupId },
        data: {
          status: "ready_to_generate",
        },
      });

      return eventGroup;
    }),

  // Generate mock recommendations (will be replaced with AI later)
  generateRecommendations: publicProcedure
    .input(
      z.object({
        groupId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const eventGroup = await ctx.db.eventGroup.findUnique({
        where: { id: input.groupId },
        include: {
          preferences: true,
        },
      });

      if (!eventGroup) {
        throw new Error("Event not found");
      }

      const { summary, ideas, stats } = await runAdvisorPipeline({
        eventGroup,
      });

      // Update event group status
      await ctx.db.eventGroup.update({
        where: { id: input.groupId },
        data: {
          status: "generated",
          isGenerated: true,
        },
      });

      return {
        recommendations: ideas,
        groupStats: {
          participantCount: stats.participantCount,
          avgActivityLevel: Math.round(stats.avgActivityLevel * 10) / 10,
          popularMoneyPreference: stats.popularMoneyPreference,
          energyLabel: stats.energyLabel,
        },
        summary,
      };
    }),
});

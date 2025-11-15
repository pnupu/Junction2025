import type { Prisma } from "@prisma/client";
import { z } from "zod";
import {
  runAdvisorPipeline,
  computeGroupStats,
  type PreferenceSummary,
} from "@/server/agents/advisor-pipeline";
import { runMoodCheckAgent } from "@/server/agents/mood-check";
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

  getMoodQuestions: publicProcedure
    .input(
      z.object({
        groupId: z.string(),
        sessionId: z.string(),
        participantName: z.string().optional(),
        answeredSignals: z.record(z.unknown()).optional(),
        timeOfDayLabel: z.string().optional(),
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

      const preference = eventGroup.preferences.find(
        (pref) => pref.sessionId === input.sessionId,
      );

      if (!preference) {
        throw new Error("Preference not found for this session");
      }

      // For mood questions, we only need stats, not the full AI-generated summary
      // This avoids expensive AI calls on every question fetch
      const stats = computeGroupStats(eventGroup.preferences);
      const existingResponses =
        (
          preference as { moodResponses?: Record<string, unknown> | undefined }
        ).moodResponses ?? {};

      // Build a lightweight summary from stats for the mood agent
      // This avoids the expensive AI call to generateSummaryContext
      const lightweightSummary: PreferenceSummary = {
        headline: `${stats.participantCount}-person group`,
        summary: `Group with ${stats.energyLabel} energy and ${stats.popularMoneyPreference} budget preference.`,
        vibeKeywords: [
          stats.energyLabel,
          stats.popularMoneyPreference,
          "social",
          "fun",
        ],
        budgetTier: stats.popularMoneyPreference,
        energyLevel: stats.energyLabel,
        timeWindow: "Flexible",
        hungerLevel: "Medium",
        callToAction: "Let's find the perfect plan!",
      };

      const mood = await runMoodCheckAgent({
        participantName: input.participantName ?? preference.userName ?? undefined,
        summary: lightweightSummary,
        stats,
        answeredSignals:
          input.answeredSignals ?? existingResponses,
        timeOfDayLabel: input.timeOfDayLabel,
      });

      const moodQuestionsData =
        {
          moodQuestions: mood.questions as Prisma.JsonValue,
        } as Prisma.EventGroupPreferenceUpdateInput;

      await ctx.db.eventGroupPreference.update({
        where: { id: preference.id },
        data: moodQuestionsData,
      });

      return mood;
    }),

  saveMoodResponses: publicProcedure
    .input(
      z.object({
        groupId: z.string(),
        sessionId: z.string(),
        responses: z
          .record(z.union([z.string(), z.number(), z.boolean()]))
          .default({}),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const preference = await ctx.db.eventGroupPreference.findUnique({
        where: {
          groupId_sessionId: {
            groupId: input.groupId,
            sessionId: input.sessionId,
          },
        },
      });

      if (!preference) {
        throw new Error("Preference not found for this session");
      }

      const existing =
        (
          preference as { moodResponses?: Record<string, unknown> | undefined }
        ).moodResponses ?? {};

      const mergedResponses = {
        ...existing,
        ...input.responses,
      };

      // Update activityLevel based on currentEnergy from mood responses
      let updatedActivityLevel = preference.activityLevel;
      const currentEnergy = mergedResponses.currentEnergy;
      if (currentEnergy && typeof currentEnergy === "string") {
        const energyLower = currentEnergy.toLowerCase();
        if (energyLower.includes("high") || energyLower.includes("hype") || energyLower.includes("😃")) {
          updatedActivityLevel = 5;
        } else if (energyLower.includes("medium") || energyLower.includes("balanced") || energyLower.includes("😐")) {
          updatedActivityLevel = 3;
        } else if (energyLower.includes("low") || energyLower.includes("chill") || energyLower.includes("😴")) {
          updatedActivityLevel = 1;
        }
      }

      const moodResponsesData =
        {
          moodResponses: mergedResponses as Prisma.JsonValue,
          activityLevel: updatedActivityLevel,
        } as Prisma.EventGroupPreferenceUpdateInput;

      await ctx.db.eventGroupPreference.update({
        where: { id: preference.id },
        data: moodResponsesData,
      });

      return { success: true };
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
        latitude: z.number().optional(),
        longitude: z.number().optional(),
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
          latitude: input.latitude,
          longitude: input.longitude,
        },
        update: {
          userName: input.userName,
          userIcon: input.userIcon,
          moneyPreference: input.moneyPreference,
          activityLevel: input.activityLevel,
          latitude: input.latitude,
          longitude: input.longitude,
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

      // Set status to "generating" before starting generation
      // This allows other participants to see that generation has started
      await ctx.db.eventGroup.update({
        where: { id: input.groupId },
        data: {
          status: "generating",
        },
      });

      const { summary, ideas, stats } = await runAdvisorPipeline({
        eventGroup,
      });

      // Update event group status to "generated" after completion
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

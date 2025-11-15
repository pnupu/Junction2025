import type { Prisma } from "@prisma/client";
import { z } from "zod";
import {
  generateSummaryContext,
  runAdvisorPipeline,
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

      const { summary, stats } = await generateSummaryContext(eventGroup);
      const existingResponses =
        (
          preference as { moodResponses?: Record<string, unknown> | undefined }
        ).moodResponses ?? {};

      const mood = await runMoodCheckAgent({
        participantName: input.participantName ?? preference.userName ?? undefined,
        summary,
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

      const moodResponsesData =
        {
          moodResponses: mergedResponses as Prisma.JsonValue,
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

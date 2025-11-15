import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";

export const eventRouter = createTRPCRouter({
  // Create a new event group (no input needed - auto-creates)
  create: publicProcedure.mutation(async ({ ctx }) => {
    const eventGroup = await ctx.db.eventGroup.create({
      data: {
        status: "collecting_preferences",
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

      // Calculate average activity level and most common money preference
      const avgActivityLevel =
        eventGroup.preferences.reduce((sum, p) => sum + p.activityLevel, 0) /
        eventGroup.preferences.length;

      const moneyPreferenceCounts = eventGroup.preferences.reduce(
        (acc, p) => {
          acc[p.moneyPreference] = (acc[p.moneyPreference] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );

      const popularMoneyPreference = Object.entries(moneyPreferenceCounts).sort(
        ([, a], [, b]) => b - a,
      )[0]?.[0] || "moderate";

      // Mock recommendations based on preferences
      const mockRecommendations = [
        {
          title: avgActivityLevel > 3 ? "Adventure City Tour" : "Relaxed Food Walk",
          description:
            avgActivityLevel > 3
              ? "High-energy exploration of the city's hidden gems"
              : "Leisurely stroll through the best local eateries",
          type: avgActivityLevel > 3 ? "active" : "relaxed",
          priceLevel: popularMoneyPreference,
          duration: avgActivityLevel > 3 ? "4 hours" : "2 hours",
          highlights: [
            "Perfect for your group's vibe",
            `${eventGroup.preferences.length} preferences matched`,
            `${popularMoneyPreference} budget`,
          ],
        },
        {
          title: "Cultural Experience",
          description: "Blend of local culture, food, and activities",
          type: "balanced",
          priceLevel: popularMoneyPreference,
          duration: "3 hours",
          highlights: [
            "Balanced activity level",
            "Cultural immersion",
            "Great for groups",
          ],
        },
        {
          title:
            avgActivityLevel < 3
              ? "Cozy Evening Hangout"
              : "City Adventure Challenge",
          description:
            avgActivityLevel < 3
              ? "Perfect spots for conversation and connection"
              : "Fun challenges and active exploration",
          type: avgActivityLevel < 3 ? "relaxed" : "active",
          priceLevel: popularMoneyPreference,
          duration: avgActivityLevel < 3 ? "Evening" : "Half day",
          highlights: [
            "Tailored to your group",
            "Memorable experiences",
            "Easy to organize",
          ],
        },
      ];

      // Update event group status
      await ctx.db.eventGroup.update({
        where: { id: input.groupId },
        data: {
          status: "generated",
          isGenerated: true,
        },
      });

      return {
        recommendations: mockRecommendations,
        groupStats: {
          participantCount: eventGroup.preferences.length,
          avgActivityLevel: Math.round(avgActivityLevel * 10) / 10,
          popularMoneyPreference,
        },
      };
    }),
});

import type { Prisma } from "@prisma/client";
import { z } from "zod";
import {
  generateSummaryContext,
  computeGroupStats,
  type PreferenceSummary,
} from "@/server/agents/advisor-pipeline";
import { runMoodCheckAgent } from "@/server/agents/mood-check";
import { filterInfrastructureVenues } from "@/server/agents/venue-filter";
import {
  generateEventRecommendations,
  saveEventRecommendations,
} from "@/server/agents/event-recommender";
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
    .query(async ({ ctx, input }) => {
      const eventGroup = await ctx.db.eventGroup.findUnique({
        where: { id: input.groupId },
        include: {
          preferences: true,
        },
      });

      if (!eventGroup) {
        throw new Error("Event not found");
      }

      let preference = eventGroup.preferences.find(
        (pref) => pref.sessionId === input.sessionId,
      );

      // If preference doesn't exist, create it with default values using upsert
      if (!preference) {
        preference = await ctx.db.eventGroupPreference.upsert({
          where: {
            groupId_sessionId: {
              groupId: input.groupId,
              sessionId: input.sessionId,
            },
          },
          create: {
            groupId: input.groupId,
            sessionId: input.sessionId,
            userName: input.participantName,
            userIcon: "👤",
            moneyPreference: "moderate",
            activityLevel: 3,
          },
          update: {},
        });
        
        // Refresh eventGroup to include the new preference
        const refreshedEventGroup = await ctx.db.eventGroup.findUnique({
          where: { id: input.groupId },
          include: {
            preferences: true,
          },
        });
        
        if (refreshedEventGroup) {
          eventGroup.preferences = refreshedEventGroup.preferences;
        }
      }

      // Step 1: Filter InfrastructureVenue based on location and preferences
      // Get user preferences if available (for logged-in users) - parallelize with venue filtering
      const userId = preference.userId;

      // Run venue filtering and user preferences fetch in parallel
      const [userPreferences, filteredVenues] = await Promise.all([
        userId
          ? ctx.db.userPreference.findUnique({
              where: { userId },
            })
          : Promise.resolve(null),
        filterInfrastructureVenues(ctx.db, {
          preferences: eventGroup.preferences,
          userPreferences: null, // Will be used in filtering logic if needed
          maxDistanceMeters: 10000, // 10km default
          city: eventGroup.city ?? undefined,
        }),
      ]);

      // Re-filter venues with user preferences if available (for better matching)
      const finalFilteredVenues = userPreferences
        ? await filterInfrastructureVenues(ctx.db, {
            preferences: eventGroup.preferences,
            userPreferences,
            maxDistanceMeters: 10000,
            city: eventGroup.city ?? undefined,
          })
        : filteredVenues;

      // For mood questions, we only need stats, not the full AI-generated summary
      // This avoids expensive AI calls on every question fetch
      const stats = computeGroupStats(eventGroup.preferences);
      const existingResponses =
        (preference as { moodResponses?: Record<string, unknown> | undefined })
          .moodResponses ?? {};

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

      // Step 2: Generate mood questions with filtered venues context
      const mood = await runMoodCheckAgent({
        participantName:
          input.participantName ?? preference.userName ?? undefined,
        summary: lightweightSummary,
        stats,
        answeredSignals: input.answeredSignals ?? existingResponses,
        timeOfDayLabel: input.timeOfDayLabel,
        filteredVenues:
          finalFilteredVenues.length > 0 ? finalFilteredVenues : undefined,
      });

      const moodQuestionsData = {
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
      // Use upsert to create preference if it doesn't exist
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
          userName: undefined,
          userIcon: "👤",
          moneyPreference: "moderate",
          activityLevel: 3,
        },
        update: {},
      });

      const existing =
        (preference as { moodResponses?: Record<string, unknown> | undefined })
          .moodResponses ?? {};

      const mergedResponses = {
        ...existing,
        ...input.responses,
      };

      // Update activityLevel based on currentEnergy from mood responses
      let updatedActivityLevel = preference.activityLevel;
      const currentEnergy = mergedResponses.currentEnergy;
      if (currentEnergy && typeof currentEnergy === "string") {
        const energyLower = currentEnergy.toLowerCase();
        if (
          energyLower.includes("high") ||
          energyLower.includes("hype") ||
          energyLower.includes("😃")
        ) {
          updatedActivityLevel = 5;
        } else if (
          energyLower.includes("medium") ||
          energyLower.includes("balanced") ||
          energyLower.includes("😐")
        ) {
          updatedActivityLevel = 3;
        } else if (
          energyLower.includes("low") ||
          energyLower.includes("chill") ||
          energyLower.includes("😴")
        ) {
          updatedActivityLevel = 1;
        }
      }

      const moodResponsesData = {
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

  // Get recommendations for an event group
  getRecommendations: publicProcedure
    .input(
      z.object({
        groupId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Fetch recommendations and event group in parallel
      const [recommendations, eventGroup] = await Promise.all([
        ctx.db.eventRecommendation.findMany({
          where: {
            groupId: input.groupId,
            status: "generated",
          },
          include: {
            event: true,
          },
          orderBy: {
            matchScore: "desc",
          },
        }),
        ctx.db.eventGroup.findUnique({
          where: { id: input.groupId },
          include: {
            preferences: true,
          },
        }),
      ]);

      if (!eventGroup) {
        throw new Error("Event group not found");
      }

      // Fetch votes for all events in parallel
      const eventIds = recommendations
        .filter((rec) => rec.event)
        .map((rec) => rec.event!.id);

      const votes =
        eventIds.length > 0
          ? await ctx.db.eventGroupEvent.findMany({
              where: {
                groupId: input.groupId,
                eventId: { in: eventIds },
                status: "voted",
              },
            })
          : [];

      // Create a map of eventId -> vote count
      const voteCounts = new Map<string, number>();
      for (const vote of votes) {
        voteCounts.set(vote.eventId, (voteCounts.get(vote.eventId) ?? 0) + 1);
      }

      // Fetch venue data for location information
      const venueIds = recommendations
        .filter((rec) => {
          const features = rec.features as {
            highlights?: string[];
            venueId?: string;
          } | null;
          return features?.venueId;
        })
        .map((rec) => {
          const features = rec.features as {
            highlights?: string[];
            venueId?: string;
          } | null;
          return features?.venueId;
        })
        .filter((id): id is string => !!id);

      const venues =
        venueIds.length > 0
          ? await ctx.db.infrastructureVenue.findMany({
              where: { id: { in: venueIds } },
            })
          : [];

      const venueMap = new Map(venues.map((v) => [v.id, v]));

      // Transform to match the format expected by the frontend
      const transformed = recommendations
        .filter((rec) => rec.event)
        .map((rec) => {
          const features = rec.features as {
            highlights?: string[];
            venueId?: string;
          } | null;
          const venue = features?.venueId
            ? venueMap.get(features.venueId)
            : undefined;

          // Extract booking/CTA data from enrichedData
          const enrichedData = venue?.enrichedData as
            | {
                booking?: {
                  provider?: string;
                  link?: string;
                  qrPayload?: string;
                  leadTimeMinutes?: number;
                  supportsGroupPaymentSplit?: boolean;
                };
                availability?: Array<{
                  label?: string;
                  start?: string;
                  end?: string;
                  priceTotal?: number;
                  pricePerPerson?: number;
                  currency?: string;
                  capacity?: number;
                  status?: string;
                  bookingLink?: string;
                }>;
                addOns?: string[];
                budgetLevel?: "budget" | "moderate" | "premium";
                durationMinutes?: {
                  standard?: number;
                  min?: number;
                  max?: number;
                };
              }
            | null
            | undefined;

          // Determine price level from enriched data or event data
          const priceLevel = (() => {
            if (enrichedData?.budgetLevel) {
              const level = enrichedData.budgetLevel.toLowerCase();
              if (level === "budget") return "budget" as const;
              if (level === "premium") return "premium" as const;
              return "moderate" as const;
            }
            const eventPriceRange = rec.event!.priceRange?.toLowerCase();
            if (eventPriceRange === "low" || eventPriceRange === "budget") return "budget" as const;
            if (eventPriceRange === "high" || eventPriceRange === "premium") return "premium" as const;
            return "moderate" as const;
          })();

          // Determine duration from enriched data or event data
          const duration = (() => {
            if (enrichedData?.durationMinutes?.standard) {
              const minutes = enrichedData.durationMinutes.standard;
              if (minutes < 60) return `${minutes} min`;
              const hours = Math.floor(minutes / 60);
              const remainingMinutes = minutes % 60;
              if (remainingMinutes === 0) {
                return `${hours}${hours === 1 ? "h" : "h"}`;
              }
              return `${hours}h ${remainingMinutes}min`;
            }
            if (rec.event!.duration) {
              const minutes = rec.event!.duration;
              if (minutes < 60) return `${minutes} min`;
              const hours = Math.floor(minutes / 60);
              const remainingMinutes = minutes % 60;
              if (remainingMinutes === 0) {
                return `${hours}${hours === 1 ? "h" : "h"}`;
              }
              return `${hours}h ${remainingMinutes}min`;
            }
            return "90 min"; // Fallback
          })();

          return {
            eventId: rec.event!.id,
            title: rec.event!.title,
            description: rec.event!.description ?? "",
            highlights: features?.highlights ?? rec.event!.tags ?? [],
            matchScore: rec.matchScore,
            reasoning: rec.reasoning ?? "",
            type: "balanced" as const, // Could be derived from event data
            priceLevel,
            duration,
            voteCount: voteCounts.get(rec.event!.id) ?? 0,
            venueId: features?.venueId,
            latitude: venue?.latitude,
            longitude: venue?.longitude,
            address: venue?.address ?? rec.event!.customLocation,
            // Booking/CTA data
            booking: enrichedData?.booking,
            availability: enrichedData?.availability,
            addOns: enrichedData?.addOns,
          };
        });

      const stats = computeGroupStats(eventGroup.preferences);

      return {
        recommendations: transformed,
        groupStats: {
          participantCount: stats.participantCount,
          avgActivityLevel: Math.round(stats.avgActivityLevel * 10) / 10,
          popularMoneyPreference: stats.popularMoneyPreference,
          energyLabel: stats.energyLabel,
        },
      };
    }),

  // Vote for an event
  vote: publicProcedure
    .input(
      z.object({
        groupId: z.string(),
        eventId: z.string(),
        sessionId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Check if user already voted for this event
      // We need to check all votes and parse JSON to find matching sessionId
      const allVotes = await ctx.db.eventGroupEvent.findMany({
        where: {
          groupId: input.groupId,
          eventId: input.eventId,
          status: "voted",
        },
      });

      // Find vote with matching sessionId
      const existingVote = allVotes.find((vote) => {
        if (!vote.notes) return false;
        try {
          const parsed = JSON.parse(vote.notes) as { sessionId?: string };
          return parsed.sessionId === input.sessionId;
        } catch {
          // Fallback to string contains if JSON parsing fails
          return vote.notes.includes(input.sessionId);
        }
      });

      if (existingVote) {
        // User already voted, remove vote (toggle off)
        await ctx.db.eventGroupEvent.delete({
          where: { id: existingVote.id },
        });

        // Get updated vote count
        const voteCount = await ctx.db.eventGroupEvent.count({
          where: {
            groupId: input.groupId,
            eventId: input.eventId,
            status: "voted",
          },
        });

        return { voted: false, voteCount };
      }

      // Create new vote
      await ctx.db.eventGroupEvent.create({
        data: {
          groupId: input.groupId,
          eventId: input.eventId,
          status: "voted",
          notes: JSON.stringify({ sessionId: input.sessionId }),
        },
      });

      // Get updated vote count
      const voteCount = await ctx.db.eventGroupEvent.count({
        where: {
          groupId: input.groupId,
          eventId: input.eventId,
          status: "voted",
        },
      });

      return { voted: true, voteCount };
    }),

  // Get user's votes for a group
  getMyVotes: publicProcedure
    .input(
      z.object({
        groupId: z.string(),
        sessionId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const allVotes = await ctx.db.eventGroupEvent.findMany({
        where: {
          groupId: input.groupId,
          status: "voted",
        },
      });

      // Filter votes by sessionId by parsing JSON
      const myVotes = allVotes
        .filter((vote) => {
          if (!vote.notes) return false;
          try {
            const parsed = JSON.parse(vote.notes) as { sessionId?: string };
            return parsed.sessionId === input.sessionId;
          } catch {
            // Fallback to string contains if JSON parsing fails
            return vote.notes.includes(input.sessionId);
          }
        })
        .map((vote) => vote.eventId);

      return myVotes;
    }),

  // Close voting for an event group
  closeVoting: publicProcedure
    .input(
      z.object({
        groupId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Update event group status to "completed" to indicate voting is closed
      const eventGroup = await ctx.db.eventGroup.update({
        where: { id: input.groupId },
        data: {
          status: "completed",
        },
      });

      return { success: true, status: eventGroup.status };
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

  // Generate recommendations based on filtered venues and mood responses
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
      await ctx.db.eventGroup.update({
        where: { id: input.groupId },
        data: {
          status: "generating",
        },
      });

      // Step 1: Parallelize independent operations
      const userIds = eventGroup.preferences
        .map((p) => p.userId)
        .filter((id): id is string => id != null);

      // Get user preferences and compute stats in parallel (both are independent)
      const [userPreferencesList, stats] = await Promise.all([
        userIds.length > 0
          ? ctx.db.userPreference.findMany({
              where: { userId: { in: userIds } },
            })
          : Promise.resolve([]),
        Promise.resolve(computeGroupStats(eventGroup.preferences)),
      ]);

      // Use the first user's preferences as primary (could be enhanced to aggregate)
      const primaryUserPreferences = userPreferencesList[0] ?? null;

      // Step 2: Filter venues (mood responses extraction is synchronous, so do it here)
      // Get mood responses from all participants
      const allMoodResponses: Record<string, unknown> = {};
      for (const pref of eventGroup.preferences) {
        const responses = (
          pref as {
            moodResponses?: Record<string, unknown>;
          }
        ).moodResponses;
        if (responses && typeof responses === "object") {
          // Merge responses (later responses override earlier ones)
          Object.assign(allMoodResponses, responses);
        }
      }

      const filteredVenues = await filterInfrastructureVenues(ctx.db, {
        preferences: eventGroup.preferences,
        userPreferences: primaryUserPreferences,
        maxDistanceMeters: 10000,
        city: eventGroup.city ?? undefined,
      });

      // Step 3: Generate summary (this requires stats, so it must come after)
      const { summary } = await generateSummaryContext(eventGroup);

      // Step 4: Generate event recommendations
      const { recommendations, debugNotes } =
        await generateEventRecommendations(ctx.db, {
          eventGroup,
          filteredVenues,
          summary,
          stats,
          moodResponses: allMoodResponses,
        });

      // Step 5: Save recommendations to database
      await saveEventRecommendations(ctx.db, input.groupId, recommendations);

      // Update event group status to "generated" after completion
      await ctx.db.eventGroup.update({
        where: { id: input.groupId },
        data: {
          status: "generated",
          isGenerated: true,
        },
      });

      return {
        recommendations: recommendations.map((rec) => ({
          title: rec.title,
          description: rec.description,
          highlights: rec.highlights,
          matchScore: rec.matchScore,
          reasoning: rec.reasoning,
        })),
        groupStats: {
          participantCount: stats.participantCount,
          avgActivityLevel: Math.round(stats.avgActivityLevel * 10) / 10,
          popularMoneyPreference: stats.popularMoneyPreference,
          energyLabel: stats.energyLabel,
        },
        summary,
        debugNotes,
      };
    }),
});

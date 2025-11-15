import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { generateShortCode } from "@/lib/generate-short-code";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { Prisma } from "../../../../generated/prisma";

const selectionSchema = z.record(z.array(z.string().min(1))).default({});

const defaultPreferenceArrays = {
  allergies: [] as string[],
  cuisinePreferences: [] as string[],
  preferredLocations: [] as string[],
};

const normalizeSelections = (selections: Record<string, string[]>) => {
  const get = (key: string) => selections[key] ?? [];

  return {
    vibe: get("vibe"),
    focus: get("focus"),
    diet: get("diet"),
    budget: get("budget"),
  };
};

const mapSelectionsToPreferences = (selections: Record<string, string[]>) => {
  const { vibe, focus, diet, budget } = normalizeSelections(selections);

  return {
    dietaryRestrictions: diet,
    allergies: defaultPreferenceArrays.allergies,
    cuisinePreferences: defaultPreferenceArrays.cuisinePreferences,
    activityTypes: focus,
    preferredTime: null,
    preferredDay: null,
    budgetRange: budget[0] ?? null,
    groupSizePreference: null,
    socialPreference: null,
    preferredLocations: defaultPreferenceArrays.preferredLocations,
    maxTravelDistance: null,
    experienceIntensity: vibe[0] ?? null,
    interests: vibe,
  };
};

const parseSelectionSnapshot = (snapshot: unknown): Record<string, string[]> => {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return {};
  }

  return Object.entries(snapshot as Record<string, Prisma.JsonValue>).reduce<
    Record<string, string[]>
  >((acc, [key, value]) => {
    if (
      Array.isArray(value) &&
      value.every((entry): entry is string => typeof entry === "string" && entry.length > 0)
    ) {
      acc[key] = value;
    }
    return acc;
  }, {});
};

const groupWithParticipantsInclude = Prisma.validator<Prisma.EventGroupInclude>()({
  participants: {
    include: {
      user: true,
    },
  },
  createdBy: true,
});

type GroupWithParticipants = Prisma.EventGroupGetPayload<{
  include: typeof groupWithParticipantsInclude;
}>;

export const onboardingRouter = createTRPCRouter({
  createCrew: publicProcedure
    .input(
      z.object({
        name: z.string().min(1).max(80).optional(),
        selections: selectionSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const displayName = input.name?.trim() ?? "City Explorer";
      const firstName = displayName.split(" ")[0] ?? "Crew";
      const normalizedSelections = Object.entries(input.selections ?? {}).reduce<
        Record<string, string[]>
      >((acc, [key, value]) => {
        if (Array.isArray(value)) {
          acc[key] = value.filter(
            (entry): entry is string => typeof entry === "string" && entry.length > 0,
          );
        } else {
          acc[key] = [];
        }
        return acc;
      }, {});

      const user = await ctx.db.user.create({
        data: {
          name: displayName,
        },
      });

      const preferencePayload = mapSelectionsToPreferences(normalizedSelections);

      await ctx.db.userPreference.create({
        data: {
          userId: user.id,
          dietaryRestrictions: preferencePayload.dietaryRestrictions,
          allergies: preferencePayload.allergies,
          cuisinePreferences: preferencePayload.cuisinePreferences,
          activityTypes: preferencePayload.activityTypes,
          preferredTime: preferencePayload.preferredTime,
          preferredDay: preferencePayload.preferredDay,
          budgetRange: preferencePayload.budgetRange,
          groupSizePreference: preferencePayload.groupSizePreference,
          socialPreference: preferencePayload.socialPreference,
          preferredLocations: preferencePayload.preferredLocations,
          maxTravelDistance: preferencePayload.maxTravelDistance,
          experienceIntensity: preferencePayload.experienceIntensity,
          interests: preferencePayload.interests,
        },
      });

      let joinCode: string | null = null;
      for (let attempt = 0; attempt < 15; attempt++) {
        const candidate = generateShortCode(3);
        const existing = await ctx.db.eventGroup.findUnique({
          where: { joinCode: candidate },
        });
        if (!existing) {
          joinCode = candidate;
          break;
        }
      }

      if (!joinCode) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Unable to allocate a unique join code. Try again.",
        });
      }

      const group = await ctx.db.eventGroup.create({
        data: {
          name: `${firstName}'s City Crew`,
          joinCode,
          selectionSnapshot: normalizedSelections,
          createdById: user.id,
          participants: {
            create: {
              userId: user.id,
              role: "organizer",
              status: "accepted",
            },
          },
        },
      });

      return {
        groupId: group.id,
        groupName: group.name ?? `${firstName}'s City Crew`,
        userId: user.id,
        joinCode,
        joinPath: `/join/${joinCode.toLowerCase()}`,
        selectionSnapshot: normalizedSelections,
      };
    }),

  resolveInvite: publicProcedure
    .input(
      z.object({
        code: z.string().min(3).max(8),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const joinCode = input.code.toUpperCase();
      const group: GroupWithParticipants | null = await ctx.db.eventGroup.findUnique({
        where: { joinCode },
        include: groupWithParticipantsInclude,
      });

      if (!group) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invite not found. Double-check the code.",
        });
      }

      const organizerParticipant:
        | GroupWithParticipants["participants"][number]
        | undefined = group.participants.find(
        (participant) => participant.role === "organizer",
      );
      const createdByName: string | null = group.createdBy?.name ?? null;
      const hostName: string =
        createdByName ?? organizerParticipant?.user?.name ?? "Host";

      const selectionSnapshot = parseSelectionSnapshot(group.selectionSnapshot);
      const memberCount: number = group.participants.length;

      return {
        groupId: group.id,
        joinCode: group.joinCode,
        groupName: group.name ?? "City Crew",
        hostName,
        memberCount,
        participants: group.participants.map(
          (participant: GroupWithParticipants["participants"][number]) => ({
            id: participant.userId,
            name: participant.user?.name ?? "Guest",
            role: participant.role,
            status: participant.status,
          }),
        ),
        selectionSnapshot,
      };
    }),
});


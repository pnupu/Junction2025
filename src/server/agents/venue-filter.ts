import type {
  InfrastructureVenue,
  EventGroupPreference,
  UserPreference,
  Prisma,
} from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { calculateDistance } from "@/lib/utils";

export type VenueFilterInput = {
  preferences: EventGroupPreference[];
  userPreferences?: UserPreference | null;
  maxDistanceMeters?: number; // Default: 10000 (10km)
  city?: string;
};

export type FilteredVenue = InfrastructureVenue & {
  distanceMeters?: number;
  matchScore: number;
};

/**
 * Select InfrastructureVenue based on user location and profile preferences
 */
export async function filterInfrastructureVenues(
  db: PrismaClient,
  input: VenueFilterInput,
): Promise<FilteredVenue[]> {
  const {
    preferences,
    userPreferences,
    maxDistanceMeters = 10000, // 10km default
    city,
  } = input;

  // Get all user locations from preferences
  const userLocations = preferences
    .filter((p) => p.latitude != null && p.longitude != null)
    .map((p) => ({
      latitude: p.latitude!,
      longitude: p.longitude!,
    }));

  // Calculate center point if multiple users
  let centerLat: number | undefined;
  let centerLon: number | undefined;

  if (userLocations.length > 0) {
    centerLat =
      userLocations.reduce((sum, loc) => sum + loc.latitude, 0) /
      userLocations.length;
    centerLon =
      userLocations.reduce((sum, loc) => sum + loc.longitude, 0) /
      userLocations.length;
  }

  // Build query filters
  const where: Prisma.InfrastructureVenueWhereInput = {};

  if (city) {
    where.city = {
      equals: city,
      mode: "insensitive",
    };
  }

  // Fetch all venues matching city filter
  const venues = await db.infrastructureVenue.findMany({
    where,
  });

  // Filter by distance and preferences
  const filtered: FilteredVenue[] = [];

  for (const venue of venues) {
    if (!venue.latitude || !venue.longitude) {
      continue; // Skip venues without coordinates
    }

    // Calculate distance to center point or nearest user
    let distanceMeters: number | undefined;
    if (centerLat != null && centerLon != null) {
      distanceMeters = calculateDistance(
        centerLat,
        centerLon,
        venue.latitude,
        venue.longitude,
      );
    } else if (userLocations.length > 0) {
      // Find minimum distance to any user
      distanceMeters = Math.min(
        ...userLocations.map((loc) =>
          calculateDistance(
            loc.latitude,
            loc.longitude,
            venue.latitude!,
            venue.longitude!,
          ),
        ),
      );
    }

    // Skip if too far
    if (distanceMeters != null && distanceMeters > maxDistanceMeters) {
      continue;
    }

    // Calculate match score based on preferences
    let matchScore = 0.5; // Base score

    // Boost score based on venue type matching preferences
    if (userPreferences) {
      // Match activity types
      if (
        userPreferences.activityTypes.length > 0 &&
        venue.type &&
        userPreferences.activityTypes.some((type) =>
          venue.type.toLowerCase().includes(type.toLowerCase()),
        )
      ) {
        matchScore += 0.2;
      }

      // Match cuisine preferences
      if (
        userPreferences.cuisinePreferences.length > 0 &&
        venue.description &&
        userPreferences.cuisinePreferences.some((cuisine) =>
          venue.description!.toLowerCase().includes(cuisine.toLowerCase()),
        )
      ) {
        matchScore += 0.15;
      }

      // Match preferred locations
      if (
        userPreferences.preferredLocations.length > 0 &&
        venue.address &&
        userPreferences.preferredLocations.some((loc) =>
          venue.address!.toLowerCase().includes(loc.toLowerCase()),
        )
      ) {
        matchScore += 0.1;
      }
    }

    // Boost score for Wolt partners
    if (venue.woltPartnerTier) {
      matchScore += 0.1;
    }

    // Distance-based scoring (closer = better, but not too much weight)
    if (distanceMeters != null) {
      const distanceScore = Math.max(0, 1 - distanceMeters / maxDistanceMeters);
      matchScore += distanceScore * 0.1;
    }

    // Cap at 1.0
    matchScore = Math.min(1.0, matchScore);

    filtered.push({
      ...venue,
      distanceMeters,
      matchScore,
    });
  }

  // Sort by match score (descending) and distance (ascending)
  filtered.sort((a, b) => {
    if (Math.abs(a.matchScore - b.matchScore) > 0.05) {
      return b.matchScore - a.matchScore;
    }
    // If scores are close, prefer closer venues
    const distA = a.distanceMeters ?? Infinity;
    const distB = b.distanceMeters ?? Infinity;
    return distA - distB;
  });

  // Return top 50 venues
  return filtered.slice(0, 50);
}

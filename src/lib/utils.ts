import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Calculate the distance between two coordinates using the Haversine formula
 * @returns Distance in meters
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Generate initials from a name
 * @param name - The name to generate initials from
 * @returns Two-letter initials (e.g., "John Doe" -> "JD", "Alice" -> "AL")
 */
export function getInitials(name: string | null | undefined): string {
  if (!name || name.trim().length === 0) {
    return "??";
  }

  const trimmed = name.trim();
  const words = trimmed.split(/\s+/).filter((word) => word.length > 0);

  if (words.length === 0) {
    return "??";
  }

  if (words.length === 1) {
    // Single word: take first two letters, uppercase
    const firstTwo = trimmed.substring(0, 2).toUpperCase();
    return firstTwo.length === 1 ? `${firstTwo}${firstTwo}` : firstTwo;
  }

  // Multiple words: take first letter of first and last word
  const first = words[0]?.[0]?.toUpperCase() ?? "";
  const last = words[words.length - 1]?.[0]?.toUpperCase() ?? "";
  return `${first}${last}`;
}

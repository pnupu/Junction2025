import demoVenuesJson from "@/../data/infrastructure/espoo.json" assert { type: "json" };

export type DemoVenueAvailability = {
  label?: string;
  start?: string;
  end?: string;
  priceTotal?: number;
  pricePerPerson?: number;
  currency?: string;
  capacity?: number;
  status?: string;
  bookingLink?: string;
};

export type DemoVenueBooking = {
  provider?: string;
  leadTimeMinutes?: number;
  supportsGroupPaymentSplit?: boolean;
  link?: string;
  qrPayload?: string;
};

type BudgetLevel = "budget" | "moderate" | "premium" | (string & {});

export type DemoVenueEnriched = {
  category?: string;
  subCategory?: string;
  vibeTags?: string[];
  neighborhood?: string;
  distanceHintsKm?: Partial<Record<string, number>>;
  groupSuitability?: {
    min?: number;
    max?: number;
    sweetSpot?: number;
  };
  durationMinutes?: {
    standard?: number;
    min?: number;
    max?: number;
  };
  budgetLevel?: BudgetLevel;
  questionsMapping?: Record<string, Array<string | number>>;
  availability?: DemoVenueAvailability[];
  booking?: DemoVenueBooking;
  addOns?: string[];
  contextualSignals?: {
    weatherSuitability?: string[];
    idealFor?: string[];
    dataFreshnessHours?: number;
  };
  demoTalkingPoints?: string[];
  foodInfo?: {
    menuHighlights?: string[];
    dietaryOptions?: string[];
  };
};

export type DemoVenue = {
  slug: string;
  name: string;
  city: string;
  type: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  description?: string;
  sourceName: string;
  sourceUrl: string;
  sourceId: string;
  officialLink?: string;
  notes?: string;
  woltPartnerTier?: string;
  lastVerifiedAt?: string;
  enriched?: DemoVenueEnriched;
};

export const demoVenues = demoVenuesJson as unknown as DemoVenue[];

export function findDemoVenue(slug: string) {
  return demoVenues.find((venue) => venue.slug === slug);
}

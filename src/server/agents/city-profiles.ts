import type { EventScoutInput } from "@/server/agents/event-scout";

export type CityScoutProfile = EventScoutInput & {
  label: string;
  slug: string;
};

export const CITY_SCOUT_PROFILES: CityScoutProfile[] = [
  {
    label: "Helsinki · courts + sea decks",
    slug: "helsinki-core",
    city: "Helsinki",
    country: "Finland",
    focusAreas: [
      "tennis courts",
      "floating saunas",
      "design district rooftops",
    ],
    includeExistingSpaces: true,
    notes:
      "Highlight Wolt Market drops at Taivallahti tennis courts, Löyly sea decks, and rooftop sauna crawls.",
  },
  {
    label: "Espoo · beaches + sports parks",
    slug: "espoo-active",
    city: "Espoo",
    country: "Finland",
    focusAreas: ["beaches", "tennis parks", "outdoor courts"],
    includeExistingSpaces: true,
    notes:
      "Tap Oittaa beach mornings, Tapiola tennis park evenings, and Leppävaara pool takeovers.",
  },
];

export const DEFAULT_SCOUT_CITY = CITY_SCOUT_PROFILES[0];

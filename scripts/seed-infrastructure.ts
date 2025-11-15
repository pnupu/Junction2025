import { readFile } from "node:fs/promises";
import path from "node:path";

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type SeedVenue = {
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
};

async function loadVenuesFromFile(filePath: string) {
  const raw = await readFile(filePath, "utf-8");
  const parsed = JSON.parse(raw) as SeedVenue[];
  return parsed;
}

async function seedVenues() {
  const dataDir = path.resolve(process.cwd(), "data", "infrastructure");
  const files = ["espoo.json"];
  const summary: { city: string; inserted: number; updated: number }[] = [];

  for (const file of files) {
    const filePath = path.join(dataDir, file);
    const venues = await loadVenuesFromFile(filePath);
    let inserted = 0;
    let updated = 0;

    for (const venue of venues) {
      const result = await prisma.infrastructureVenue.upsert({
        where: { slug: venue.slug },
        create: {
          slug: venue.slug,
          name: venue.name,
          city: venue.city,
          type: venue.type,
          address: venue.address,
          latitude: venue.latitude,
          longitude: venue.longitude,
          description: venue.description,
          sourceName: venue.sourceName,
          sourceUrl: venue.sourceUrl,
          sourceId: venue.sourceId,
          officialLink: venue.officialLink,
          notes: venue.notes,
          woltPartnerTier: venue.woltPartnerTier,
          lastVerifiedAt: venue.lastVerifiedAt
            ? new Date(venue.lastVerifiedAt)
            : undefined,
        },
        update: {
          name: venue.name,
          city: venue.city,
          type: venue.type,
          address: venue.address,
          latitude: venue.latitude,
          longitude: venue.longitude,
          description: venue.description,
          sourceName: venue.sourceName,
          sourceUrl: venue.sourceUrl,
          sourceId: venue.sourceId,
          officialLink: venue.officialLink,
          notes: venue.notes,
          woltPartnerTier: venue.woltPartnerTier,
          lastVerifiedAt: venue.lastVerifiedAt
            ? new Date(venue.lastVerifiedAt)
            : undefined,
          updatedAt: new Date(),
        },
      });

      if (result.createdAt.getTime() === result.updatedAt.getTime()) {
        inserted += 1;
      } else {
        updated += 1;
      }
    }

    summary.push({
      city: venues[0]?.city ?? file.replace(".json", ""),
      inserted,
      updated,
    });
  }

  console.log("Infrastructure venues synced:");
  summary.forEach((row) =>
    console.log(
      `• ${row.city}: inserted ${row.inserted}, updated ${row.updated}`,
    ),
  );
}

seedVenues()
  .catch((error) => {
    console.error("Failed to seed infrastructure venues", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


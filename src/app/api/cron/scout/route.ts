"use server";

import { NextResponse } from "next/server";

import { CITY_SCOUT_PROFILES } from "@/server/agents/city-profiles";
import { runEventScoutAgent } from "@/server/agents/event-scout";
import { db } from "@/server/db";

export async function GET(request: Request) {
  const agentSecret = process.env.AGENT_CRON_SECRET;
  if (agentSecret) {
    const provided =
      request.headers.get("x-cron-secret") ??
      new URL(request.url).searchParams.get("token");

    if (provided !== agentSecret) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  const runs = [];
  for (const profile of CITY_SCOUT_PROFILES) {
    const result = await runEventScoutAgent({
      db,
      input: profile,
    });

    runs.push({
      city: profile.city,
      total: result.meta.total,
      source: result.meta.source,
    });
  }

  return NextResponse.json({
    ok: true,
    runs,
  });
}


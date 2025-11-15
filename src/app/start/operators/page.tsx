import Link from "next/link";

import { AgentConsole } from "@/app/_components/operator/agent-console";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CITY_SCOUT_PROFILES } from "@/server/agents/city-profiles";
import { db } from "@/server/db";

export default async function OperatorPage() {
  const [opportunities, recommendations] = await Promise.all([
    db.eventOpportunity.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        venues: {
          include: { venue: true },
        },
      },
      take: 8,
    }),
    db.eventRecommendation.findMany({
      include: {
        opportunity: {
          include: {
            venues: {
              include: { venue: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
  ]);

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-10 sm:px-8 lg:py-16">
        <header className="flex flex-col gap-4 border-b border-slate-800 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.35em] text-slate-500">
              Agent console
            </p>
            <h1 className="text-4xl font-semibold text-white">
              Operate the scout + matcher
            </h1>
            <p className="max-w-3xl text-base text-slate-300">
              Run the Event Scout per city profile, inspect stored opportunities, and test the
              recommendation agent before plugging results into onboarding.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/start"
              className={cn(
                buttonVariants({ variant: "ghost" }),
                "text-slate-300 hover:bg-slate-900",
              )}
            >
              ← Back to start
            </Link>
            <Link
              href="/start/group"
              className={cn(
                buttonVariants({ variant: "outline" }),
                "border-slate-700 text-slate-200 hover:bg-slate-900",
              )}
            >
              View crew step
            </Link>
          </div>
        </header>

        <AgentConsole cityOptions={CITY_SCOUT_PROFILES} />

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4 rounded-3xl border border-slate-800 bg-slate-900/40 p-5">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                Latest opportunities
              </p>
              <h2 className="text-2xl font-semibold text-white">
                {opportunities.length} stored ideas
              </h2>
            </div>
            <div className="space-y-3">
              {opportunities.length > 0 ? (
                opportunities.map((opp) => {
                  const primaryVenue = opp.venues[0]?.venue;
                  return (
                  <article
                    key={opp.id}
                    className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-lg font-semibold text-white">{opp.title}</p>
                        <p className="text-sm text-blue-300">
                          {opp.city} · {primaryVenue?.name ?? opp.locationType}
                        </p>
                      </div>
                      <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">
                        {opp.status}
                      </span>
                    </div>
                    <p className="mt-3 text-sm text-slate-300 line-clamp-3">{opp.summary}</p>
                    <p className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-500">
                      Venue source · {primaryVenue?.sourceName ?? "—"}
                    </p>
                    <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-500">
                      Wolt brings · {opp.woltContribution}
                    </p>
                  </article>
                );
                })
              ) : (
                <p className="text-sm text-slate-400">
                  No entries yet. Run the scout above to seed the database.
                </p>
              )}
            </div>
          </div>

          <div className="space-y-4 rounded-3xl border border-slate-800 bg-slate-900/40 p-5">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                Recent matches
              </p>
              <h2 className="text-2xl font-semibold text-white">
                {recommendations.length} recommendations
              </h2>
            </div>
            <div className="space-y-3">
              {recommendations.length > 0 ? (
                recommendations.map((rec) => {
                  const primaryVenue = rec.opportunity?.venues[0]?.venue;
                  return (
                  <article
                    key={rec.id}
                    className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-semibold text-white">
                          {rec.opportunity?.title ?? "Untitled opportunity"}
                        </p>
                        <p className="text-sm text-blue-300">
                          Match {rec.matchScore.toFixed(2)} · {primaryVenue?.name ?? "—"}
                        </p>
                      </div>
                      <span className="text-xs uppercase tracking-[0.2em] text-slate-500">
                        {new Intl.DateTimeFormat("en", {
                          hour: "2-digit",
                          minute: "2-digit",
                        }).format(rec.createdAt)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-400 line-clamp-3">
                      {rec.reasoning ?? "No reasoning provided"}
                    </p>
                    {primaryVenue?.sourceName && (
                      <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-500">
                        Source · {primaryVenue.sourceName}
                      </p>
                    )}
                  </article>
                );
                })
              ) : (
                <p className="text-sm text-slate-400">
                  No matches yet. Use the matcher on the left once opportunities exist.
                </p>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}


"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  preferenceSections,
  type SelectionState,
} from "@/app/_components/onboarding/preferences-config";
import { api, type RouterOutputs } from "@/trpc/react";

const parseSelections = (payload: string | null): SelectionState => {
  if (!payload) return {};
  try {
    const raw: unknown = JSON.parse(payload);
    if (!raw || typeof raw !== "object") return {};

    return Object.entries(raw as Record<string, unknown>).reduce<SelectionState>(
      (acc, [key, value]) => {
        if (Array.isArray(value)) {
          const stringValues = value.filter(
            (entry): entry is string => typeof entry === "string" && entry.length > 0,
          );
          acc[key] = stringValues;
        }
        return acc;
      },
      {},
    );
  } catch {
    return {};
  }
};

type VenueSnapshot = {
  name?: string | null;
  sourceName?: string | null;
  sourceUrl?: string | null;
};

const getPrimaryVenue = (opportunity: unknown): VenueSnapshot | undefined => {
  if (!opportunity || typeof opportunity !== "object") return undefined;
  const venuesRaw = (opportunity as { venues?: unknown }).venues;
  if (!Array.isArray(venuesRaw) || venuesRaw.length === 0) return undefined;
  const first: unknown = venuesRaw[0];
  if (!first || typeof first !== "object") return undefined;
  const venue = (first as { venue?: unknown }).venue;
  if (!venue || typeof venue !== "object") return undefined;
  const { name, sourceName, sourceUrl } = venue as VenueSnapshot;
  return { name, sourceName, sourceUrl };
};

const getOpportunityField = (
  opportunity: unknown,
  field: "city" | "locationType",
): string | undefined => {
  if (!opportunity || typeof opportunity !== "object") return undefined;
  const value = (opportunity as Record<string, unknown>)[field];
  return typeof value === "string" ? value : undefined;
};

export function GroupStepPanel() {
  const searchParams = useSearchParams();
  const name = searchParams.get("name") ?? "";
  const prefsParam = searchParams.get("prefs");
  const cityParam = searchParams.get("city") ?? "Helsinki";

  const selections = useMemo(() => parseSelections(prefsParam), [prefsParam]);
  const normalizedSelections = useMemo<Record<string, string[]>>(() => {
    return preferenceSections.reduce<Record<string, string[]>>((acc, section) => {
      acc[section.id] = selections[section.id] ?? [];
      return acc;
    }, {});
  }, [selections]);

  const hasSelectionData = useMemo(
    () => Object.values(normalizedSelections).some((values) => values.length > 0),
    [normalizedSelections],
  );

  const payload = useMemo(
    () => ({
      name: name || "City Explorer",
      selections: normalizedSelections,
    }),
    [name, normalizedSelections],
  );

  useEffect(() => {
    if (!hasSelectionData) return;
    if (createEvent.isPending || createEvent.isSuccess) return;
    createEvent.mutate(payload);
  }, [createEvent, hasSelectionData, payload]);

  const [origin, setOrigin] = useState("");
  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const inviteData = createEvent.data;
  const groupName =
    inviteData?.groupName ?? (name ? `${name.split(" ")[0]}'s City Crew` : "New City Crew");
  const shareUrl = inviteData ? `${origin}${inviteData.joinPath}` : "";

  const handleCopy = async () => {
    if (!inviteData) return;
    try {
      await navigator.clipboard.writeText(shareUrl || inviteData.joinPath);
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 2000);
    } catch (error) {
      console.error("Failed to copy invite link", error);
    }
  };

  const highlightTags = preferenceSections
    .flatMap((section) => normalizedSelections[section.id] ?? [])
    .slice(0, 4);

  return (
    <Card className="border-slate-800 bg-slate-900/60 text-slate-100">
      <CardHeader>
        <CardDescription className="text-xs font-mono uppercase tracking-[0.35em] text-slate-400">
          Step 03 · Crew space
        </CardDescription>
        <CardTitle>Your invite is live</CardTitle>
        <CardDescription>
          We now persist the profile + preferences so later flows can query them. Share the link
          below with your crew to let them answer the same questions.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!hasSelectionData && (
          <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4 text-yellow-100">
            Missing preference payload. Restart from step 01 to mint a valid crew.
          </div>
        )}

        {createCrew.isError && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-100">
            <p className="font-semibold text-white">We could not create the crew.</p>
            <p className="mt-1">
              {createCrew.error?.message ?? "Unknown error. Please try again."}
            </p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-3 bg-white/10 text-white hover:bg-white/20"
              onClick={() => {
                createCrew.reset();
                createCrew.mutate(payload);
              }}
            >
              Retry mint
            </Button>
          </div>
        )}

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-slate-400">
            <span>Share with friends</span>
            {createCrew.isPending && (
              <span className="flex items-center gap-2 text-[0.6rem] text-blue-200">
                <Loader2 className="h-3 w-3 animate-spin" />
                Provisioning…
              </span>
            )}
          </div>
          <h3 className="mt-2 text-2xl font-semibold text-white">{groupName}</h3>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Badge className="bg-blue-500 text-white">
              Code · {inviteData?.joinCode ?? "•••"}
            </Badge>
            <span className="text-sm text-slate-400">
              {inviteData ? shareUrl : "Generating invite link…"}
            </span>
          </div>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <Button
              variant="secondary"
              className="bg-slate-100 text-slate-900 hover:bg-white"
              onClick={handleCopy}
              disabled={!inviteData || createCrew.isPending}
            >
              {copyState === "copied" ? "Link copied" : "Copy invite link"}
            </Button>
            <Button variant="outline" className="border-slate-700 text-white" disabled>
              Download QR (coming soon)
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-dashed border-slate-800 p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            Preferences captured
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {highlightTags.length > 0 ? (
              highlightTags.map((tag) => (
                <Badge key={tag} className="bg-slate-800 text-slate-200">
                  {tag}
                </Badge>
              ))
            ) : (
              <p className="text-sm text-slate-400">
                We’ll display quick-glance tags once preferences are filled.
              </p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            Experience preview
          </p>
          <OpportunityPreviewCard
            city={cityParam}
            vibe={normalizedSelections.vibe?.[0]}
            focus={normalizedSelections.focus?.[0]}
            dietarySignals={
              normalizedSelections.diet && normalizedSelections.diet.length > 0
                ? normalizedSelections.diet
                : undefined
            }
          />
        </div>
      </CardContent>
      <CardFooter className="border-t border-slate-800 text-sm text-slate-400">
        Data now lives in Postgres via Prisma. Next step: let teammates query it via tRPC +
        AI jobs.
      </CardFooter>
    </Card>
  );
}

type StoredRecommendation =
  RouterOutputs["ai"]["recommendFromOpportunities"]["recommendations"][number];

type OpportunityPreviewProps = {
  city: string;
  vibe?: string;
  focus?: string;
  dietarySignals?: string[];
};

function OpportunityPreviewCard({
  city,
  vibe,
  focus,
  dietarySignals,
}: OpportunityPreviewProps) {
  const { data, isFetching, isError, refetch } =
    api.ai.recommendFromOpportunities.useQuery(
      {
        city,
        vibe,
        focus,
        dietarySignals,
      },
      {
        refetchOnWindowFocus: false,
        staleTime: 60_000,
      },
    );

  const recommendations = data?.recommendations ?? [];

  if (isError) {
    return (
      <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">
        <p className="font-semibold text-white">Agent error</p>
        <p>We could not fetch stored opportunities. Try again in a few seconds.</p>
        <Button
          variant="secondary"
          size="sm"
          className="mt-3 bg-white/10 text-white hover:bg-white/20"
          onClick={() => void refetch()}
        >
          <RefreshCw className="mr-2 h-3 w-3" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-4">
      {isFetching && (
        <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3 text-sm text-slate-300">
          <Loader2 className="h-4 w-4 animate-spin text-blue-300" />
          Syncing Wolt agent…
        </div>
      )}

      {recommendations.length === 0 && !isFetching ? (
        <p className="text-sm text-slate-400">
          No stored opportunities for {city} yet. Operators can run the scout in the Ops console.
        </p>
      ) : (
        recommendations.map((item) => (
          <OpportunityCard key={item.recommendation.id} data={item} />
        ))
      )}

      {data?.meta && (
        <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
          Source · {data.meta.source === "openai" ? "AI ranked" : data.meta.source}
        </p>
      )}
    </div>
  );
}

function OpportunityCard({ data }: { data: StoredRecommendation }) {
  const opportunity: unknown = data.recommendation.opportunity;
  const primaryVenue = getPrimaryVenue(opportunity);
  const opportunityCity = getOpportunityField(opportunity, "city");
  const opportunityLocationType = getOpportunityField(opportunity, "locationType");
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-lg font-semibold text-white">{data.title}</p>
          <p className="text-sm text-blue-300">
            {primaryVenue?.name ?? opportunityCity ?? "Unknown city"} ·{" "}
            {primaryVenue?.sourceName ?? opportunityLocationType ?? "pop-up"}
          </p>
        </div>
        <Badge variant="secondary" className="bg-blue-500/20 text-blue-100">
          Score {(data.recommendation.matchScore ?? 0).toFixed(2)}
        </Badge>
      </div>
      <p className="mt-3 text-sm text-slate-300">{data.summary}</p>
      <p className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-400">
        Why it works · {data.recommendation.reasoning ?? data.activationPlan}
      </p>
      {primaryVenue?.sourceUrl && (
        <p className="mt-1 text-xs text-slate-500">
          Source:{" "}
          <a
            href={primaryVenue.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="text-blue-300 underline"
          >
            {primaryVenue.sourceName ?? "Dataset"}
          </a>
        </p>
      )}
    </div>
  );
}


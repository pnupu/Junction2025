"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { OpportunityRecommendationInput } from "@/server/agents/opportunity-recommender";
import type { CityScoutProfile } from "@/server/agents/city-profiles";
import { api } from "@/trpc/react";

type CityOption = CityScoutProfile;

export function AgentConsole({ cityOptions }: { cityOptions: CityOption[] }) {
  const router = useRouter();
  const defaultCity = cityOptions[0];

  const [selectedCitySlug, setSelectedCitySlug] = useState(
    defaultCity?.slug ?? "",
  );
  const [notes, setNotes] = useState("");

  const selectedProfile =
    cityOptions.find((option) => option.slug === selectedCitySlug) ??
    defaultCity;

  const scoutMutation = api.ai.scoutOpportunities.useMutation({
    onSuccess: () => {
      setNotes("");
      router.refresh();
    },
  });

  const [recommendForm, setRecommendForm] =
    useState<OpportunityRecommendationInput>({
      city: defaultCity?.city,
    });

  const recommendationInput = useMemo<OpportunityRecommendationInput>(() => {
    const vibe = recommendForm.vibe?.trim();
    const focus = recommendForm.focus?.trim();

    return {
      city: recommendForm.city,
      vibe: vibe && vibe.length > 0 ? vibe : undefined,
      focus: focus && focus.length > 0 ? focus : undefined,
      dietarySignals:
        recommendForm.dietarySignals && recommendForm.dietarySignals.length > 0
          ? recommendForm.dietarySignals
          : undefined,
    };
  }, [recommendForm]);

  const recommendationsQuery = api.ai.recommendFromOpportunities.useQuery(
    recommendationInput,
    {
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  );

  const handleScoutRun = () => {
    if (!selectedProfile) return;
    const mergedNotes = [selectedProfile.notes, notes].filter(Boolean).join(" ").trim();
    scoutMutation.mutate({
      city: selectedProfile.city,
      country: selectedProfile.country,
      focusAreas: selectedProfile.focusAreas,
      includeExistingSpaces: selectedProfile.includeExistingSpaces,
      notes: mergedNotes.length > 0 ? mergedNotes : undefined,
    });
  };

  const handleRecommendationRun = () => {
    void recommendationsQuery.refetch();
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <Card className="border-slate-800 bg-slate-900/60">
        <CardHeader>
          <CardDescription className="text-xs uppercase tracking-[0.3em] text-slate-400">
            Agent 01
          </CardDescription>
          <CardTitle>Scout city opportunities</CardTitle>
          <CardDescription>
            Runs the Event Scout agent per city profile. Populates the `EventOpportunity`
            table with structured concepts ready for downstream matching.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="city-select" className="text-sm text-slate-200">
              City profile
            </Label>
            <select
              id="city-select"
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
              value={selectedCitySlug}
              onChange={(event) => setSelectedCitySlug(event.target.value)}
            >
              {cityOptions.map((option) => (
                <option key={option.slug} value={option.slug}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes" className="text-sm text-slate-200">
              Extra notes
            </Label>
            <textarea
              id="notes"
              rows={3}
              placeholder="Add custom instructions…"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500"
            />
            <p className="text-xs text-slate-500">
              Base brief: {selectedProfile?.notes ?? "—"}
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex items-center justify-between border-t border-slate-800 text-sm text-slate-400">
          <p>
            Focus: {selectedProfile?.focusAreas?.join(", ") ?? "Not specified"}
          </p>
          <Button
            onClick={handleScoutRun}
            disabled={scoutMutation.isPending}
            className="bg-blue-500 text-white hover:bg-blue-500/90"
          >
            {scoutMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating…
              </>
            ) : (
              "Run scout"
            )}
          </Button>
        </CardFooter>
      </Card>

      <Card className="border-slate-800 bg-slate-900/60">
        <CardHeader>
          <CardDescription className="text-xs uppercase tracking-[0.3em] text-slate-400">
            Agent 02
          </CardDescription>
          <CardTitle>Match stored opportunities</CardTitle>
          <CardDescription>
            Pulls the best saved ideas for a crew profile. Useful for QA before wiring
            into the onboarding flow.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="rec-city" className="text-sm text-slate-200">
                City
              </Label>
              <Input
                id="rec-city"
                value={recommendForm.city ?? ""}
                onChange={(event) =>
                  setRecommendForm((prev) => ({
                    ...prev,
                    city: event.target.value || undefined,
                  }))
                }
                placeholder="Helsinki"
                className="border-slate-700 bg-slate-900 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rec-vibe" className="text-sm text-slate-200">
                Vibe
              </Label>
              <Input
                id="rec-vibe"
                value={recommendForm.vibe ?? ""}
                onChange={(event) =>
                  setRecommendForm((prev) => ({
                    ...prev,
                    vibe: event.target.value || undefined,
                  }))
                }
                placeholder="Cozy, Adventurous…"
                className="border-slate-700 bg-slate-900 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rec-focus" className="text-sm text-slate-200">
                Focus
              </Label>
              <Input
                id="rec-focus"
                value={recommendForm.focus ?? ""}
                onChange={(event) =>
                  setRecommendForm((prev) => ({
                    ...prev,
                    focus: event.target.value || undefined,
                  }))
                }
                placeholder="Foodie circuit, Outdoorsy…"
                className="border-slate-700 bg-slate-900 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rec-diet" className="text-sm text-slate-200">
                Dietary signals (comma separated)
              </Label>
              <Input
                id="rec-diet"
                value={(recommendForm.dietarySignals ?? []).join(", ")}
                onChange={(event) =>
                  setRecommendForm((prev) => ({
                    ...prev,
                    dietarySignals: event.target.value
                      .split(",")
                      .map((token) => token.trim())
                      .filter(Boolean),
                  }))
                }
                placeholder="Veg-friendly, Gluten-free"
                className="border-slate-700 bg-slate-900 text-white"
              />
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex items-center justify-between border-t border-slate-800 text-sm text-slate-400">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-slate-300 hover:bg-slate-800"
              onClick={handleRecommendationRun}
            >
              <RefreshCw className="mr-1 h-3 w-3" />
              Match now
            </Button>
            {recommendationsQuery.isFetching && (
              <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
            )}
          </div>
          <p>
            Showing {recommendationsQuery.data?.recommendations.length ?? 0} matches
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}


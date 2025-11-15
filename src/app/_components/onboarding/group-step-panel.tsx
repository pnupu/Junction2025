"use client";

import { useMemo, useState } from "react";
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
import { preferenceSections, type SelectionState } from "@/app/_components/onboarding/preferences-config";
import { generateShortCode } from "@/lib/generate-short-code";

const mockExperiences = [
  {
    title: "Neo-Nordic tasting flight",
    vibe: "Cozy · Foodie circuit",
    location: "Kamppi · €€",
    description:
      "Chef-led micro menu with paired natural wines. Includes post-dinner speakeasy route.",
  },
  {
    title: "After-hours design crawl",
    vibe: "Adventurous · Culture hit",
    location: "Design District · €",
    description:
      "Private gallery unlocks + AI-personalized AR guide. Ends with rooftop sauna.",
  },
];

const parseSelections = (payload: string | null): SelectionState => {
  if (!payload) return {};
  try {
    return JSON.parse(payload) as SelectionState;
  } catch {
    return {};
  }
};

export function GroupStepPanel() {
  const searchParams = useSearchParams();
  const name = searchParams.get("name") ?? "";
  const prefsParam = searchParams.get("prefs");
  const selections = useMemo(() => parseSelections(prefsParam), [prefsParam]);

  const [invite] = useState(() => {
    const code = generateShortCode();
    const baseUrl =
      typeof window === "undefined" ? "https://invite.local" : window.location.origin;
    const link = `${baseUrl}/join/${code.toLowerCase()}`;
    const groupName = name
      ? `${name.split(" ")[0]}'s City Crew`
      : "New City Crew";

    return { code, link, groupName };
  });

  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(invite.link);
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 2000);
    } catch (error) {
      console.error("Failed to copy invite link", error);
    }
  };

  const highlightTags = preferenceSections
    .flatMap((section) => selections[section.id] ?? [])
    .slice(0, 4);

  return (
    <Card className="border-slate-800 bg-slate-900/60 text-slate-100">
      <CardHeader>
        <CardDescription className="text-xs font-mono uppercase tracking-[0.35em] text-slate-400">
          Step 03 · Crew space
        </CardDescription>
        <CardTitle>Your invite is live</CardTitle>
        <CardDescription>
          Share the invite code or QR. Friends join instantly, answer their own questions,
          and watch plans evolve in real time.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            Share with friends
          </p>
          <h3 className="mt-2 text-2xl font-semibold text-white">{invite.groupName}</h3>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Badge className="bg-blue-500 text-white">Code · {invite.code}</Badge>
            <span className="text-sm text-slate-400">{invite.link}</span>
          </div>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <Button
              variant="secondary"
              className="bg-slate-100 text-slate-900 hover:bg-white"
              onClick={handleCopy}
            >
              {copyState === "copied" ? "Link copied" : "Copy invite link"}
            </Button>
            <Button variant="outline" className="border-slate-700 text-white">
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
          <div className="mt-4 space-y-4">
            {mockExperiences.map((experience) => (
              <div
                key={experience.title}
                className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-lg font-semibold text-white">{experience.title}</p>
                    <p className="text-sm text-blue-300">{experience.vibe}</p>
                  </div>
                  <Badge variant="secondary" className="bg-blue-500/20 text-blue-100">
                    {experience.location}
                  </Badge>
                </div>
                <p className="mt-3 text-sm text-slate-300">{experience.description}</p>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
      <CardFooter className="border-t border-slate-800 text-sm text-slate-400">
        Future work: persist the crew, preferences, and recommendations via Prisma + tRPC.
      </CardFooter>
    </Card>
  );
}


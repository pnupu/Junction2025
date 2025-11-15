 "use client";

import { Loader2 } from "lucide-react";
import { useMemo, useState } from "react";

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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { api, type RouterOutputs } from "@/trpc/react";

type Step = "intro" | "preferences" | "group";

type PreferenceSection = {
  id: string;
  title: string;
  description: string;
  options: string[];
  allowMultiple?: boolean;
};

const preferenceSections: PreferenceSection[] = [
  {
    id: "vibe",
    title: "What vibe are you chasing?",
    description: "Sets the tone for the entire experience.",
    options: ["Cozy", "Adventurous", "Celebratory", "Chill AF"],
  },
  {
    id: "focus",
    title: "Pick a focus",
    description: "We will blend the city around this anchor.",
    options: ["Foodie circuit", "Culture hit", "Outdoorsy", "Wellness"],
  },
  {
    id: "diet",
    title: "Food signals",
    description: "Helps us respect everyone’s preferences.",
    options: ["No limits", "Veg-friendly", "Vegan", "Gluten-free"],
    allowMultiple: true,
  },
  {
    id: "budget",
    title: "Budget comfort zone",
    description: "Fast tracks venues in the right range.",
    options: ["Smart", "Comfort", "Premium"],
  },
];

type SelectionState = Record<string, string[]>;

type InviteDetails = {
  code: string;
  link: string;
  groupName: string;
};

type Recommendation =
  RouterOutputs["ai"]["preview"]["recommendations"][number];

export function OnboardingFlow() {
  const [step, setStep] = useState<Step>("intro");
  const [name, setName] = useState("");
  const [selections, setSelections] = useState<SelectionState>(() =>
    preferenceSections.reduce<SelectionState>((acc, section) => {
      acc[section.id] = [];
      return acc;
    }, {}),
  );
  const [invite, setInvite] = useState<InviteDetails | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");

  const isIntroValid = name.trim().length > 1;
  const isPreferencesValid = useMemo(() => {
    return preferenceSections.every((section) => {
      if (section.allowMultiple) return true;

      return (selections[section.id]?.length ?? 0) > 0;
    });
  }, [selections]);

  const aiPreviewEnabled = step !== "intro";
  const normalizedName = name.trim();
  const aiInputName = normalizedName.length > 0 ? normalizedName : undefined;

  const {
    data: aiPreview,
    isFetching: aiFetching,
    isError: aiError,
    refetch: refetchAi,
  } = api.ai.preview.useQuery(
    {
      name: aiInputName,
      selections,
    },
    {
      enabled: aiPreviewEnabled,
      placeholderData: (prev) => prev,
      refetchOnWindowFocus: false,
      staleTime: 60_000,
    },
  );

  const handleOptionToggle = (section: PreferenceSection, value: string) => {
    setSelections((prev) => {
      const current = prev[section.id] ?? [];

      if (section.allowMultiple) {
        const exists = current.includes(value);
        const updated = exists
          ? current.filter((item) => item !== value)
          : [...current, value];

        return { ...prev, [section.id]: updated };
      }

      return { ...prev, [section.id]: [value] };
    });
  };

  const handleContinue = () => {
    if (step === "intro" && isIntroValid) {
      setStep("preferences");
      return;
    }

    if (step === "preferences" && isPreferencesValid) {
      const code = generateShortCode();
      const baseUrl =
        typeof window === "undefined" ? "https://invite.local" : window.location.origin;
      const link = `${baseUrl}/join/${code.toLowerCase()}`;

      const groupName = name
        ? `${name.split(" ")[0]}'s City Crew`
        : "New City Crew";

      setInvite({ code, link, groupName });
      setStep("group");
    }
  };

  const handleCopy = async () => {
    if (!invite?.link) return;
    try {
      await navigator.clipboard.writeText(invite.link);
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 2000);
    } catch (error) {
      console.error("Failed to copy", error);
    }
  };

  const primaryCtaLabel =
    step === "intro"
      ? "Start designing"
      : step === "preferences"
        ? "Spin up group"
        : "Share invite";

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <Card className="border-slate-800 bg-slate-900/50 text-slate-100">
        <CardHeader>
          <CardDescription className="text-xs font-mono uppercase tracking-[0.35em] text-slate-400">
            Step {step === "intro" ? "01" : step === "preferences" ? "02" : "03"}
          </CardDescription>
          <CardTitle>
            {step === "intro" && "Who’s landing on Wolt?"}
            {step === "preferences" && "Rapid-fire preferences"}
            {step === "group" && "Your crew space is live"}
          </CardTitle>
          <CardDescription>
            {step === "intro" &&
              "Drop a name (nicknames welcome). We’ll create a lightweight profile and keep onboarding snappy for demo mode."}
            {step === "preferences" &&
              "These signals prime our AI to blend food, venues, and experiences that feel hyper-personal in any city."}
            {step === "group" &&
              "Share the invite code or QR. Friends join instantly, answer their own questions, and watch plans evolve in real-time."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {step === "intro" && (
            <div className="space-y-3">
              <Label htmlFor="name" className="text-sm text-slate-200">
                Your name
              </Label>
              <Input
                id="name"
                placeholder="e.g. Lina"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="border-slate-700 bg-slate-900 text-base text-white placeholder:text-slate-500"
              />
            </div>
          )}

          {step === "preferences" && (
            <div className="space-y-8">
              {preferenceSections.map((section) => (
                <div key={section.id} className="space-y-2.5">
                  <div>
                    <p className="text-base font-medium text-white">
                      {section.title}
                    </p>
                    <p className="text-sm text-slate-400">
                      {section.description}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {section.options.map((option) => {
                      const selected = selections[section.id]?.includes(option);
                      return (
                        <button
                          key={option}
                          type="button"
                          onClick={() => handleOptionToggle(section, option)}
                          className={cn(
                            "rounded-full border px-4 py-2 text-sm transition",
                            selected
                              ? "border-blue-400 bg-blue-500/20 text-white"
                              : "border-slate-700 text-slate-300 hover:border-slate-500 hover:text-white",
                          )}
                          aria-pressed={selected}
                        >
                          {option}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {step === "group" && invite && (
            <div className="space-y-6">
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Share with friends
                </p>
                <h3 className="mt-2 text-2xl font-semibold text-white">
                  {invite.groupName}
                </h3>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <Badge className="bg-blue-500 text-white">
                    Code · {invite.code}
                  </Badge>
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
                  Next up
                </p>
                <ul className="mt-3 list-inside list-disc text-sm text-slate-300">
                  <li>Auto-create onboarding link with QR</li>
                  <li>Let friends answer the same questions</li>
                  <li>Blend preferences into concrete plans</li>
                </ul>
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="justify-between border-t border-slate-800 text-slate-300">
          <div className="text-sm">
            {step === "intro" && "Ultra-fast onboarding keeps demos flowing."}
            {step === "preferences" && "AI watches every preference in real time."}
            {step === "group" && "Invite the crew — we’ll sync everyone instantly."}
          </div>
          <Button
            onClick={handleContinue}
            disabled={
              (step === "intro" && !isIntroValid) ||
              (step === "preferences" && !isPreferencesValid) ||
              step === "group"
            }
            className="bg-blue-500 text-white hover:bg-blue-500/90"
          >
            {primaryCtaLabel}
          </Button>
        </CardFooter>
      </Card>

      <AiRecommendationsCard
        recommendations={aiPreview?.recommendations ?? []}
        metaSource={aiPreview?.meta.source}
        modelName={aiPreview?.meta.model}
        generatedAt={aiPreview?.meta.generatedAt}
        isLoading={aiFetching && aiPreviewEnabled}
        isError={aiError}
        onRetry={() => void refetchAi()}
      />
    </div>
  );
}

function generateShortCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  return Array.from({ length: 3 })
    .map(() => alphabet[Math.floor(Math.random() * alphabet.length)])
    .join("");
}

type AiRecommendationsCardProps = {
  recommendations: Recommendation[];
  metaSource?: "openai" | "fallback";
  modelName?: string;
  generatedAt?: string;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
};

function AiRecommendationsCard({
  recommendations,
  metaSource,
  modelName,
  generatedAt,
  isLoading,
  isError,
  onRetry,
}: AiRecommendationsCardProps) {
  const showEmptyState = !isLoading && !recommendations.length && !isError;
  const updatedLabel =
    generatedAt && !Number.isNaN(Date.parse(generatedAt))
      ? new Date(generatedAt).toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : undefined;

  return (
    <Card className="border-slate-800 bg-slate-900/40 text-slate-100">
      <CardHeader>
        <CardDescription className="text-xs uppercase tracking-[0.35em] text-slate-400">
          Preview
        </CardDescription>
        <CardTitle>AI generated experiences</CardTitle>
        <CardDescription>
          Once your group joins, we’ll stream live suggestions personalized to
          everyone’s answers. This panel is wired to the new OpenAI-powered tRPC
          endpoint for live previews.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading && (
          <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-6 text-sm text-slate-300">
            <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
            Warming up Wolt AI...
          </div>
        )}

        {isError && (
          <div className="rounded-xl border border-red-600/40 bg-red-600/10 px-4 py-5 text-sm text-red-100">
            <p className="font-medium text-white">Something glitched.</p>
            <p>We fell back to cached ideas. Try again?</p>
            <Button
              onClick={onRetry}
              variant="secondary"
              className="mt-3 bg-white/10 text-white hover:bg-white/20"
            >
              Retry generation
            </Button>
          </div>
        )}

        {!isLoading &&
          !isError &&
          recommendations.map((experience) => (
            <div
              key={experience.title}
              className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-semibold text-white">
                    {experience.title}
                  </p>
                  <p className="text-sm text-blue-300">{experience.vibe}</p>
                </div>
                <Badge variant="secondary" className="bg-blue-500/20 text-blue-100">
                  {experience.location}
                </Badge>
              </div>
              <p className="mt-3 text-sm text-slate-300">
                {experience.description}
              </p>
              {experience.highlights && experience.highlights.length > 0 && (
                <ul className="mt-3 list-inside list-disc text-sm text-slate-400">
                  {experience.highlights.map((detail) => (
                    <li key={detail}>{detail}</li>
                  ))}
                </ul>
              )}
              {experience.estimatedBudget && (
                <p className="mt-3 text-xs uppercase tracking-[0.2em] text-slate-500">
                  Budget · {experience.estimatedBudget}
                </p>
              )}
            </div>
          ))}

        {showEmptyState && (
          <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 p-5 text-sm text-slate-400">
            Signal preferences on the left and we’ll start composing ideas in real time.
          </div>
        )}
      </CardContent>
      <CardFooter className="flex-col items-start gap-3 border-t border-slate-800 text-sm text-slate-400">
        <p>Generation status:</p>
        <ul className="list-inside list-disc space-y-1">
          <li>
            Source · {metaSource === "openai" ? "OpenAI live call" : "Local seed set"}
          </li>
          {modelName && <li>Model · {modelName}</li>}
          {updatedLabel && <li>Updated · {updatedLabel}</li>}
          <li>Streaming via tRPC + React Query</li>
        </ul>
      </CardFooter>
    </Card>
  );
}


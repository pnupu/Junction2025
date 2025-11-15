"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { preferenceSections, createEmptySelections } from "@/app/_components/onboarding/preferences-config";
import type { PreferenceSection, SelectionState } from "@/app/_components/onboarding/preferences-config";
import { cn } from "@/lib/utils";

const getInitialSelections = (prefsParam: string | null): SelectionState => {
  if (!prefsParam) return createEmptySelections();

  try {
    const parsed = JSON.parse(prefsParam) as SelectionState;
    return {
      ...createEmptySelections(),
      ...parsed,
    };
  } catch {
    return createEmptySelections();
  }
};

export function PreferencesStepForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const name = searchParams.get("name") ?? "";
  const prefsParam = searchParams.get("prefs");

  const [selections, setSelections] = useState<SelectionState>(() =>
    getInitialSelections(prefsParam),
  );

  const isValid = useMemo(
    () =>
      preferenceSections.every((section) => {
        if (section.allowMultiple) return true;
        return (selections[section.id]?.length ?? 0) > 0;
      }),
    [selections],
  );

  const handleOptionToggle = (section: PreferenceSection, value: string) => {
    setSelections((prev) => {
      const current = prev[section.id] ?? [];

      if (section.allowMultiple) {
        const exists = current.includes(value);
        const next = exists
          ? current.filter((item) => item !== value)
          : [...current, value];
        return { ...prev, [section.id]: next };
      }

      return { ...prev, [section.id]: [value] };
    });
  };

  const handleContinue = () => {
    if (!isValid) return;

    const params = new URLSearchParams();
    if (name) params.set("name", name);
    params.set("prefs", JSON.stringify(selections));

    router.push(`/start/group?${params.toString()}`);
  };

  return (
    <Card className="border-slate-800 bg-slate-900/60 text-slate-100">
      <CardHeader>
        <CardDescription className="text-xs font-mono uppercase tracking-[0.35em] text-slate-400">
          Step 02 · Signals
        </CardDescription>
        <CardTitle>Rapid-fire preferences</CardTitle>
        <CardDescription>
          These signals prime our AI to blend food, venues, and experiences that feel
          hyper-personal in any city.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        {preferenceSections.map((section) => (
          <div key={section.id} className="space-y-2.5">
            <div>
              <p className="text-base font-medium text-white">{section.title}</p>
              <p className="text-sm text-slate-400">{section.description}</p>
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
      </CardContent>
      <CardFooter className="flex flex-col gap-4 border-t border-slate-800 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between">
        <p>
          {name
            ? `We’ll mark this as ${name.split(" ")[0]}'s signal set.`
            : "We’ll tie this to your crew on the next step."}
        </p>
        <Button
          onClick={handleContinue}
          disabled={!isValid}
          className="bg-blue-500 text-white hover:bg-blue-500/90"
        >
          Spin up crew space
        </Button>
      </CardFooter>
    </Card>
  );
}


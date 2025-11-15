"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

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

export function NameStepForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultName = searchParams.get("name") ?? "";

  const [name, setName] = useState(defaultName);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isValid = name.trim().length > 1;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isValid || isSubmitting) return;

    setIsSubmitting(true);
    const trimmedName = name.trim();

    const params = new URLSearchParams();
    params.set("name", trimmedName);

    setTimeout(() => {
      router.push(`/start/preferences?${params.toString()}`);
    }, 200);
  };

  return (
    <Card className="border-slate-800 bg-slate-900/60 text-slate-100">
      <form onSubmit={handleSubmit}>
        <CardHeader>
          <CardDescription className="text-xs font-mono uppercase tracking-[0.35em] text-slate-400">
            Step 01 · Profile pulse
          </CardDescription>
          <CardTitle>Who’s landing on Wolt?</CardTitle>
          <CardDescription>
            Drop a name (nicknames welcome). We’ll create a lightweight profile and keep
            onboarding snappy for demo mode.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
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
            <p className="text-sm text-slate-400">
              This is stored locally for now. Later we will persist to Prisma.
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4 border-t border-slate-800 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <p>Next: rapid-fire preferences.</p>
          <Button
            type="submit"
            disabled={!isValid || isSubmitting}
            className="bg-blue-500 text-white hover:bg-blue-500/90"
          >
            {isSubmitting ? "Saving…" : "Continue to preferences"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}


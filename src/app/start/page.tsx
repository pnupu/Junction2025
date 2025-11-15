import Link from "next/link";

import { OnboardingFlow } from "@/app/_components/onboarding-flow";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function StartPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-10 sm:px-8 lg:py-16">
        <div className="flex flex-col gap-4 border-b border-slate-800 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.4em] text-slate-500">
              Start a new plan
            </p>
            <h1 className="text-4xl font-semibold text-white">
              Rapid onboarding for your city crew
            </h1>
            <p className="max-w-2xl text-base text-slate-300">
              Give us a name and gut-feel preferences. We’ll capture signals for the AI
              engine and spin up a shareable space with QR + short code invites.
            </p>
          </div>
          <Link
            href="/"
            className={cn(
              buttonVariants({ variant: "ghost" }),
              "self-start text-slate-300 hover:bg-slate-900",
            )}
          >
            ← Back to overview
          </Link>
        </div>

        <OnboardingFlow />
      </div>
    </main>
  );
}


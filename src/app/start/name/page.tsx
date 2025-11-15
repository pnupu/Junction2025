import Link from "next/link";

import { NameStepForm } from "@/app/_components/onboarding/name-step-form";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function StartNamePage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10 sm:px-8 lg:py-16">
        <div className="flex flex-col gap-3 border-b border-slate-800 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.35em] text-slate-500">
              Step 01
            </p>
            <h1 className="text-4xl font-semibold text-white">Name pulse</h1>
            <p className="text-base text-slate-300">
              Keep onboarding ultra-fast. Once auth is ready, we’ll swap this for actual
              account creation.
            </p>
          </div>
          <Link
            href="/start"
            className={cn(
              buttonVariants({ variant: "ghost" }),
              "self-start text-slate-300 hover:bg-slate-900",
            )}
          >
            ← All steps
          </Link>
        </div>

        <NameStepForm />
      </div>
    </main>
  );
}


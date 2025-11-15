import Link from "next/link";

import { GroupStepPanel } from "@/app/_components/onboarding/group-step-panel";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function GroupPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10 sm:px-8 lg:py-16">
        <div className="flex flex-col gap-3 border-b border-slate-800 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.35em] text-slate-500">
              Step 03
            </p>
            <h1 className="text-4xl font-semibold text-white">Crew space</h1>
            <p className="text-base text-slate-300">
              We simulate the final confirmation page: invite code, QR placeholder, and
              mock AI stream, ready for teammates to wire up.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/start/preferences"
              className={cn(
                buttonVariants({ variant: "outline" }),
                "border-slate-700 text-slate-200 hover:bg-slate-900",
              )}
            >
              ← Back
            </Link>
            <Link
              href="/start"
              className={cn(
                buttonVariants({ variant: "ghost" }),
                "text-slate-300 hover:bg-slate-900",
              )}
            >
              All steps
            </Link>
          </div>
        </div>

        <GroupStepPanel />
      </div>
    </main>
  );
}


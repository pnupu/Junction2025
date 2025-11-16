import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
// NOT CURRENTLY USED
const steps = [
  {
    title: "Name pulse",
    description:
      "Capture a friendly name in seconds. Ideal for demo mode before auth is wired.",
    href: "/start/name",
    tag: "Step 01",
  },
  {
    title: "Preferences",
    description:
      "Collect high-signal vibes, dietary notes, and budget comfort zones for AI.",
    href: "/start/preferences",
    tag: "Step 02",
  },
  {
    title: "Crew space",
    description:
      "Auto-generate the invite code, QR placeholder, and experience preview stream.",
    href: "/start/group",
    tag: "Step 03",
  },
  {
    title: "Operator console",
    description:
      "Trigger the scout + recommendation agents and review stored opportunities.",
    href: "/start/operators",
    tag: "Ops",
  },
];

export default function StartPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-10 sm:px-8 lg:py-16">
        <div className="flex flex-col gap-4 border-b border-slate-800 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <p className="text-xs tracking-[0.4em] text-slate-500 uppercase">
              Start a new plan
            </p>
            <h1 className="text-4xl font-semibold text-white">
              Rapid onboarding for your city crew
            </h1>
            <p className="max-w-2xl text-base text-slate-300">
              Give us a name and gut-feel preferences. We’ll capture signals for
              the AI engine and spin up a shareable space with QR + short code
              invites.
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

        <div className="grid gap-6 md:grid-cols-3">
          {steps.map((step) => (
            <div
              key={step.title}
              className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5"
            >
              <p className="text-xs tracking-[0.35em] text-slate-500 uppercase">
                {step.tag}
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-white">
                {step.title}
              </h2>
              <p className="mt-2 text-sm text-slate-400">{step.description}</p>
              <Link
                href={step.href}
                className={cn(
                  buttonVariants({ size: "sm" }),
                  "mt-4 inline-flex bg-blue-500 text-white hover:bg-blue-500/80",
                )}
              >
                Open step
              </Link>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

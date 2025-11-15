import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const flowSteps = [
  {
    title: "Pulse check",
    copy: "Ultra-fast onboarding captures a name + gut-feel preferences without friction.",
    tag: "Step 01",
    location: "/start/name",
  },
  {
    title: "Spin up crew space",
    copy: "We auto-create an event group, short code, and invite QR that friends can scan.",
    tag: "Step 02",
    location: "/start/preferences",
  },
  {
    title: "Stream experiences",
    copy: "AI blends food, venues, and local experiences that adapt as more friends join.",
    tag: "Step 03",
    location: "/start/group",
  },
];

const highlights = [
  {
    label: "City-agnostic",
    value: "30+",
    copy: "market-ready playbooks that scale with Wolt’s footprint.",
  },
  {
    label: "Signals captured",
    value: "15",
    copy: "preference inputs routed into our matching engine.",
  },
  {
    label: "Share speed",
    value: "<10s",
    copy: "from name entry to a working invite link.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-16 px-4 py-12 sm:px-8 lg:py-16">
        <section className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div className="space-y-6">
            <p className="text-sm uppercase tracking-[0.35em] text-blue-300">
              AI for the next local experience
            </p>
            <h1 className="text-5xl font-semibold leading-tight text-white sm:text-6xl">
              Plan hyper-personal city experiences with a few taps
            </h1>
            <p className="text-lg text-slate-300">
              Our hackathon prototype shows how Wolt could let friends co-create
              unforgettable moments: fast onboarding, AI-personalized experience
              streams, and instant invites that feel magical.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/create"
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "bg-blue-500 px-6 text-white hover:bg-blue-500/90",
                )}
              >
                Create Event
              </Link>
              <Link
                href="/start/name"
                className={cn(
                  buttonVariants({ size: "lg", variant: "outline" }),
                  "border-slate-700 text-gray-300 hover:bg-slate-900",
                )}
              >
                Start a new plan
              </Link>
              <Link
                href="/join"
                className={cn(
                  buttonVariants({ size: "lg", variant: "outline" }),
                  "border-slate-700 text-gray-300 hover:bg-slate-900",
                )}
              >
                I have a code
              </Link>
            </div>
          </div>
          <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
            <p className="text-sm uppercase tracking-[0.2em] text-slate-400">
              Why it matters
            </p>
            <p className="mt-3 text-xl text-white">
              We target four criteria in the brief: strong AI personalization,
              market scalability, novel invite mechanics, and tangible user
              impact for city exploration.
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {highlights.map((item) => (
                <div key={item.label} className="rounded-2xl border border-slate-800/70 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                    {item.label}
                  </p>
                  <p className="mt-2 text-3xl font-semibold text-white">{item.value}</p>
                  <p className="text-sm text-slate-400">{item.copy}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <div className="flex flex-col gap-2">
            <p className="text-sm uppercase tracking-[0.3em] text-slate-500">
              Flow overview
            </p>
            <h2 className="text-3xl font-semibold text-white">
              We split the experience into focused pages
            </h2>
            <p className="text-slate-400">
              The landing page tees up the narrative. Dedicated routes handle onboarding
              and join flows so the demo stays clean and teammates can build deeper logic
              later.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {flowSteps.map((step, index) => (
              <div
                key={step.title}
                className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5"
              >
                <p className="text-xs uppercase tracking-[0.35em] text-slate-500">
                  {step.tag}
                </p>
                <h3 className="mt-2 text-xl font-semibold text-white">
                  {index + 1}. {step.title}
                </h3>
                <p className="mt-2 text-sm text-slate-400">{step.copy}</p>
                <div className="mt-4 text-sm text-blue-300">{step.location}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

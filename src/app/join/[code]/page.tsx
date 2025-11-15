import Link from "next/link";

import { JoinGroupPanel } from "@/app/_components/join-group-panel";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type JoinCodePageProps = {
  params: Promise<{
    code: string;
  }>;
};

export default async function JoinCodePage({ params }: JoinCodePageProps) {
  const { code } = await params;
  const formattedCode = code?.toUpperCase() ?? "";

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-10 sm:px-8 lg:py-16">
        <div className="flex flex-col gap-4 border-b border-slate-800 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.4em] text-slate-500">
              Join an existing group
            </p>
            <h1 className="text-4xl font-semibold text-white">
              Code {formattedCode} · verify + sync instantly
            </h1>
            <p className="max-w-3xl text-base text-slate-300">
              We prefill the code from the shared link. Review the crew snapshot, then continue
              to answer the same AI-driven questions as the host.
            </p>
          </div>
          <Link
            href="/start/name"
            className={cn(
              buttonVariants({ variant: "secondary" }),
              "self-start bg-blue-500/10 text-blue-200 hover:bg-blue-500/20",
            )}
          >
            Start a new plan
          </Link>
        </div>

        <JoinGroupPanel prefillCode={formattedCode} />
      </div>
    </main>
  );
}


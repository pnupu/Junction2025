import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-white">
      <div className="w-full max-w-3xl px-6 py-12">
        {/* Hero Section */}
        <div className="mb-16 text-center">
          <div className="mb-6 text-6xl">🎉</div>
          <h1 className="mb-4 text-5xl font-semibold tracking-tight text-slate-900 sm:text-6xl">
            Plan Together
          </h1>
          <p className="mx-auto max-w-xl text-xl text-slate-600">
            AI-powered event planning that adapts to everyone&apos;s preferences
          </p>
        </div>

        {/* Action Buttons */}
        <div className="mb-12 flex flex-col gap-4 sm:flex-row sm:justify-center">
          <Link
            href="/create"
            className="group flex h-16 items-center justify-center gap-3 rounded-xl bg-[#029DE2] px-8 text-lg font-semibold text-white shadow-xl transition-all hover:scale-105 hover:bg-[#029DE2]/90 hover:shadow-2xl"
          >
            <span className="text-2xl transition-transform group-hover:scale-110">✨</span>
            <span>Create Event</span>
          </Link>
          <Link
            href="/join"
            className="flex h-16 items-center justify-center gap-3 rounded-xl border-2 border-[#029DE2] bg-white px-8 text-lg font-semibold text-[#029DE2] backdrop-blur transition-all hover:scale-105 hover:bg-[#029DE2]/5"
          >
            <span className="text-2xl">🔗</span>
            <span>Join Event</span>
          </Link>
        </div>

        {/* Features */}
        <div className="grid gap-6 sm:grid-cols-3">
          <div className="rounded-2xl bg-slate-900/50 p-6 text-center backdrop-blur">
            <div className="mb-3 text-4xl">🎯</div>
            <h3 className="mb-2 font-semibold text-white">Simple</h3>
            <p className="text-sm text-slate-400">No text inputs, just tap</p>
          </div>
          <div className="rounded-2xl bg-slate-900/50 p-6 text-center backdrop-blur">
            <div className="mb-3 text-4xl">��</div>
            <h3 className="mb-2 font-semibold text-white">Together</h3>
            <p className="text-sm text-slate-400">Everyone&apos;s voice matters</p>
          </div>
          <div className="rounded-2xl bg-slate-900/50 p-6 text-center backdrop-blur">
            <div className="mb-3 text-4xl">🚀</div>
            <h3 className="mb-2 font-semibold text-white">Fast</h3>
            <p className="text-sm text-slate-400">Results in seconds</p>
          </div>
        </div>

        {/* Dev Tools */}
        <div className="mt-12 rounded-lg border border-slate-200 bg-slate-50 p-4 font-mono text-xs text-slate-600">
          <div className="mb-2 text-slate-500">Dev Tools:</div>
          <div>Alternative routes: /start/name (old flow), /join (join with code)</div>
          <div>Design: Apple-inspired, mobile-first, single-screen layout</div>
        </div>
      </div>
    </main>
  );
}

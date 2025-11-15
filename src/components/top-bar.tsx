import Link from "next/link";

export function TopBar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-800 bg-slate-950/80 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-8">
        <Link
          href="/"
          className="flex items-center gap-2 transition-transform hover:scale-105"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-2xl font-bold text-white shadow-lg shadow-blue-500/20">
            W
          </div>
          <span className="text-xl font-semibold text-white">Wolt Events</span>
        </Link>
      </div>
    </header>
  );
}

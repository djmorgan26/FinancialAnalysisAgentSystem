import Link from "next/link";

/**
 * Persistent strip shown across the top of every page while in no-login demo
 * mode. Makes it unambiguous that the figures are fictional.
 */
export function DemoBanner() {
  return (
    <div
      className="flex items-center justify-center gap-3 h-8 px-4 text-[11.5px] shrink-0"
      style={{
        background: "var(--accent-soft, #1f2937)",
        color: "var(--accent-strong, #93c5fd)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <span
        className="inline-block w-1.5 h-1.5 rounded-full"
        style={{ background: "currentColor" }}
      />
      <span className="font-medium">Demo data — not real accounts.</span>
      <span className="hidden sm:inline opacity-70">
        Read-only sample portfolio. Nothing here is real or saved.
      </span>
      <Link
        href="/demo?exit=1"
        className="underline underline-offset-2 hover:opacity-80"
      >
        Exit demo
      </Link>
    </div>
  );
}

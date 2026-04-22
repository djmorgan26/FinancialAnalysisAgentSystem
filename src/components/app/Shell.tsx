"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Cable,
  BarChart3,
  History,
  Sparkles,
  Settings,
  LogOut,
  Search,
} from "lucide-react";
import { FloatingAssistant } from "./FloatingAssistant";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, match: (p: string) => p === "/" },
  { href: "/connections", label: "Connections", icon: Cable, match: (p: string) => p.startsWith("/connections") },
  { href: "/analysis", label: "Analysis", icon: BarChart3, match: (p: string) => p.startsWith("/analysis") },
  { href: "/history", label: "History", icon: History, match: (p: string) => p.startsWith("/history") },
  { href: "/assistant", label: "Assistant", icon: Sparkles, match: (p: string) => p.startsWith("/assistant") },
  { href: "/settings/preferences", label: "Settings", icon: Settings, match: (p: string) => p.startsWith("/settings") },
];

export function AppShell({
  children,
  user,
  syncSummary,
  netWorthPill,
}: {
  children: React.ReactNode;
  user: { email: string | null; initial: string };
  syncSummary?: { label: string; tone: "gain" | "warn" | "loss" } | null;
  netWorthPill?: { value: string; delta?: string; tone?: "gain" | "loss" | "neutral" } | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    try {
      await fetch("/api/auth?action=signout", { method: "POST" });
      router.replace("/sign-in");
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar */}
      <header
        className="flex items-center h-14 px-5 gap-4 shrink-0"
        style={{
          borderBottom: "1px solid var(--border)",
          background: "var(--bg-elevated)",
        }}
      >
        <Link href="/" className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center text-[13px] font-semibold"
            style={{
              background: "var(--accent-soft)",
              color: "var(--accent-strong)",
              border: "1px solid var(--border)",
            }}
          >
            ƒ
          </div>
          <span className="text-[14px] font-semibold tracking-tight">
            Ledger
          </span>
        </Link>

        <div className="flex-1" />

        {netWorthPill && (
          <div className="hidden md:flex flex-col items-end gap-0.5 px-3 border-r" style={{ borderColor: "var(--border)" }}>
            <span className="text-[10px] uppercase tracking-wider text-[color:var(--text-muted)]">
              Net worth
            </span>
            <div className="flex items-baseline gap-2">
              <span className="mono text-[14px] font-semibold">{netWorthPill.value}</span>
              {netWorthPill.delta && (
                <span
                  className="mono text-[11px]"
                  style={{
                    color:
                      netWorthPill.tone === "gain"
                        ? "var(--gain)"
                        : netWorthPill.tone === "loss"
                          ? "var(--loss)"
                          : "var(--text-muted)",
                  }}
                >
                  {netWorthPill.delta}
                </span>
              )}
            </div>
          </div>
        )}

        {syncSummary && (
          <span className={`chip chip-${syncSummary.tone}`}>
            <span className={`dot dot-${syncSummary.tone}`} />
            {syncSummary.label}
          </span>
        )}

        <button
          className="hidden md:inline-flex items-center gap-2 input"
          style={{
            width: 220,
            padding: "6px 10px",
            color: "var(--text-muted)",
            background: "var(--bg-inset)",
          }}
          disabled
          title="Coming soon"
        >
          <Search size={13} />
          <span className="text-[12px]">Quick search</span>
          <span className="flex-1" />
          <span className="kbd">⌘K</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={signOut}
            disabled={signingOut}
            className="btn btn-ghost btn-sm"
            title="Sign out"
          >
            <LogOut size={14} />
            <span className="hidden md:inline">Sign out</span>
          </button>
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-semibold mono"
            style={{
              background: "var(--bg-inset)",
              border: "1px solid var(--border)",
              color: "var(--text-muted)",
            }}
            title={user.email ?? ""}
          >
            {user.initial}
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 min-h-0">
        {/* Left nav */}
        <aside
          className="w-56 shrink-0 flex flex-col p-3 gap-1"
          style={{
            borderRight: "1px solid var(--border)",
            background: "var(--bg-elevated)",
          }}
        >
          {NAV.map(({ href, label, icon: Icon, match }) => {
            const active = match(pathname);
            return (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 px-3 py-2 rounded-[6px] text-[13px] transition-colors"
                style={{
                  background: active ? "var(--bg-inset)" : "transparent",
                  color: active ? "var(--text)" : "var(--text-muted)",
                  border: active
                    ? "1px solid var(--border)"
                    : "1px solid transparent",
                  fontWeight: active ? 600 : 500,
                }}
              >
                <Icon size={15} />
                <span>{label}</span>
              </Link>
            );
          })}
          <div className="flex-1" />
          <div
            className="px-3 py-2 text-[11px]"
            style={{ color: "var(--text-faint)" }}
          >
            <div>Signed in as</div>
            <div
              className="mono truncate"
              style={{ color: "var(--text-muted)" }}
              title={user.email ?? ""}
            >
              {user.email ?? "—"}
            </div>
          </div>
        </aside>

        {/* Main */}
        <main
          className="flex-1 min-w-0 overflow-auto"
          style={{ background: "var(--bg)" }}
        >
          {children}
        </main>
      </div>

      {/* Footer */}
      <footer
        className="h-8 flex items-center justify-center text-[11px] italic shrink-0"
        style={{
          borderTop: "1px solid var(--border)",
          background: "var(--bg-elevated)",
          color: "var(--text-faint)",
        }}
      >
        Informational only — not financial, tax, or legal advice.
      </footer>

      {/* Floating assistant launcher */}
      <FloatingAssistant />
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Cable,
  BarChart3,
  ListTodo,
  History,
  Newspaper,
  Sparkles,
  Settings,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { FloatingAssistant } from "./FloatingAssistant";
import { QuickSearch, type QuickSearchItem } from "./QuickSearch";
import { DemoBanner } from "./DemoBanner";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, match: (p: string) => p === "/" },
  { href: "/connections", label: "Connections", icon: Cable, match: (p: string) => p.startsWith("/connections") },
  { href: "/analysis", label: "Analysis", icon: BarChart3, match: (p: string) => p.startsWith("/analysis") },
  { href: "/plan", label: "Plan", icon: ListTodo, match: (p: string) => p.startsWith("/plan") },
  { href: "/history", label: "History", icon: History, match: (p: string) => p.startsWith("/history") },
  { href: "/news", label: "News", icon: Newspaper, match: (p: string) => p.startsWith("/news") },
  { href: "/assistant", label: "Assistant", icon: Sparkles, match: (p: string) => p.startsWith("/assistant") },
  { href: "/settings/preferences", label: "Settings", icon: Settings, match: (p: string) => p.startsWith("/settings") },
];

/** The nav links + "signed in as" footer, shared by the desktop sidebar and
 *  the mobile off-canvas drawer. `onNavigate` lets the drawer close on tap. */
function NavList({
  pathname,
  email,
  onNavigate,
}: {
  pathname: string;
  email: string | null;
  onNavigate?: () => void;
}) {
  return (
    <>
      {NAV.map(({ href, label, icon: Icon, match }) => {
        const active = match(pathname);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
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
      <div className="px-3 py-2 text-[11px]" style={{ color: "var(--text-faint)" }}>
        <div>Signed in as</div>
        <div
          className="mono truncate"
          style={{ color: "var(--text-muted)" }}
          title={email ?? ""}
        >
          {email ?? "—"}
        </div>
      </div>
    </>
  );
}

export function AppShell({
  children,
  user,
  syncSummary,
  netWorthPill,
  searchItems = [],
  demo = false,
}: {
  children: React.ReactNode;
  user: { email: string | null; initial: string };
  syncSummary?: { label: string; tone: "gain" | "warn" | "loss" } | null;
  netWorthPill?: { value: string; delta?: string; tone?: "gain" | "loss" | "neutral" } | null;
  searchItems?: QuickSearchItem[];
  demo?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  // Lock body scroll while the drawer is open.
  useEffect(() => {
    if (!navOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [navOpen]);

  async function signOut() {
    // In demo mode there's no session — "Sign out" exits the demo instead.
    if (demo) {
      router.replace("/demo?exit=1");
      router.refresh();
      return;
    }
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
      {demo && <DemoBanner />}
      {/* Top bar */}
      <header
        className="flex items-center h-14 px-3 sm:px-5 gap-2 sm:gap-4 shrink-0"
        style={{
          borderBottom: "1px solid var(--border)",
          background: "var(--bg-elevated)",
        }}
      >
        {/* Hamburger — mobile only. Wrapped so the .btn display rule can't
            override the md:hidden visibility utility. */}
        <div className="md:hidden flex items-center">
          <button
            type="button"
            onClick={() => setNavOpen(true)}
            aria-label="Open navigation menu"
            aria-expanded={navOpen}
            className="btn btn-ghost btn-sm px-2"
          >
            <Menu size={18} />
          </button>
        </div>

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

        <QuickSearch items={searchItems} />

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
        {/* Left nav — persistent on md+, hidden on mobile */}
        <aside
          className="hidden md:flex w-56 shrink-0 flex-col p-3 gap-1"
          style={{
            borderRight: "1px solid var(--border)",
            background: "var(--bg-elevated)",
          }}
        >
          <NavList pathname={pathname} email={user.email} />
        </aside>

        {/* Mobile off-canvas drawer */}
        {navOpen && (
          <div className="md:hidden fixed inset-0 z-50">
            {/* Backdrop */}
            <button
              type="button"
              aria-label="Close navigation menu"
              onClick={() => setNavOpen(false)}
              className="absolute inset-0"
              style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)" }}
            />
            {/* Drawer panel */}
            <nav
              className="absolute inset-y-0 left-0 w-64 max-w-[80vw] flex flex-col p-3 gap-1"
              style={{
                background: "var(--bg-elevated)",
                borderRight: "1px solid var(--border)",
                boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
              }}
            >
              <div className="flex items-center justify-between px-1 pb-2 mb-1" style={{ borderBottom: "1px solid var(--border)" }}>
                <span className="text-[13px] font-semibold tracking-tight">Menu</span>
                <button
                  type="button"
                  onClick={() => setNavOpen(false)}
                  aria-label="Close navigation menu"
                  className="btn btn-ghost btn-sm px-2"
                >
                  <X size={16} />
                </button>
              </div>
              <NavList
                pathname={pathname}
                email={user.email}
                onNavigate={() => setNavOpen(false)}
              />
            </nav>
          </div>
        )}

        {/* Main */}
        <main
          className="flex-1 min-w-0 overflow-x-hidden overflow-y-auto"
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

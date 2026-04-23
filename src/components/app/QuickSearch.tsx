"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  LayoutDashboard,
  Cable,
  BarChart3,
  History as HistoryIcon,
  Sparkles,
  Settings,
  Coins,
  Wallet,
  ArrowRight,
} from "lucide-react";

export type QuickSearchItem = {
  type: "page" | "account" | "holding";
  label: string;
  subtitle?: string;
  href: string;
  /** Free-form keywords the match checks against in addition to label/subtitle. */
  keywords?: string;
};

const PAGES: QuickSearchItem[] = [
  { type: "page", label: "Dashboard", subtitle: "Overview", href: "/" },
  { type: "page", label: "Connections", subtitle: "Link accounts", href: "/connections" },
  { type: "page", label: "Analysis", subtitle: "Positions & allocation", href: "/analysis" },
  { type: "page", label: "History", subtitle: "Snapshots & changes", href: "/history" },
  { type: "page", label: "Assistant", subtitle: "AI brief & chat", href: "/assistant" },
  { type: "page", label: "Settings", subtitle: "Profile & preferences", href: "/settings/preferences" },
];

function iconFor(type: QuickSearchItem["type"]) {
  switch (type) {
    case "account":
      return Wallet;
    case "holding":
      return Coins;
    default:
      return BarChart3;
  }
}

function pageIcon(label: string) {
  switch (label) {
    case "Dashboard": return LayoutDashboard;
    case "Connections": return Cable;
    case "Analysis": return BarChart3;
    case "History": return HistoryIcon;
    case "Assistant": return Sparkles;
    case "Settings": return Settings;
    default: return BarChart3;
  }
}

export function QuickSearch({ items }: { items: QuickSearchItem[] }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const router = useRouter();

  const all = useMemo(() => [...PAGES, ...items], [items]);

  // Cmd/Ctrl+K anywhere to open; Escape to close.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    } else {
      setQ("");
    }
  }, [open]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) {
      // Show pages + a preview of accounts/holdings
      return all.slice(0, 12);
    }
    return all
      .filter((it) => {
        const hay = `${it.label} ${it.subtitle ?? ""} ${it.keywords ?? ""}`.toLowerCase();
        return hay.includes(needle);
      })
      .slice(0, 20);
  }, [q, all]);

  useEffect(() => {
    if (active >= filtered.length) setActive(0);
  }, [filtered.length, active]);

  function go(item: QuickSearchItem) {
    setOpen(false);
    router.push(item.href);
  }

  function onListKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = filtered[active];
      if (item) go(item);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden md:inline-flex items-center gap-2 input"
        style={{
          width: 220,
          padding: "6px 10px",
          color: "var(--text-muted)",
          background: "var(--bg-inset)",
          cursor: "pointer",
        }}
        title="Quick search (⌘K)"
      >
        <Search size={13} />
        <span className="text-[12px]">Quick search</span>
        <span className="flex-1" />
        <span className="kbd">⌘K</span>
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-50 flex items-start justify-center"
          style={{
            background: "rgba(0,0,0,0.5)",
            paddingTop: "15vh",
            backdropFilter: "blur(2px)",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[560px] rounded-lg overflow-hidden mx-4"
            style={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
            }}
          >
            <div
              className="flex items-center gap-2 px-4 py-3"
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              <Search size={15} style={{ color: "var(--text-muted)" }} />
              <input
                ref={inputRef}
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={onListKey}
                placeholder="Search pages, accounts, positions…"
                className="bg-transparent outline-none text-[13.5px] flex-1"
                style={{ color: "var(--text)" }}
              />
              <span className="kbd text-[10px]">Esc</span>
            </div>

            <div style={{ maxHeight: "50vh", overflow: "auto" }}>
              {filtered.length === 0 ? (
                <div className="px-4 py-8 text-center text-[12px] text-[color:var(--text-muted)]">
                  No matches for &ldquo;{q}&rdquo;
                </div>
              ) : (
                filtered.map((item, i) => {
                  const Icon = item.type === "page" ? pageIcon(item.label) : iconFor(item.type);
                  const isActive = i === active;
                  return (
                    <button
                      key={`${item.type}-${item.href}-${item.label}`}
                      type="button"
                      onMouseEnter={() => setActive(i)}
                      onClick={() => go(item)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left"
                      style={{
                        background: isActive ? "var(--bg-inset)" : "transparent",
                        borderBottom: "1px solid var(--border)",
                      }}
                    >
                      <div
                        className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                        style={{
                          background: "var(--bg-inset)",
                          color: isActive ? "var(--accent-strong)" : "var(--text-muted)",
                          border: "1px solid var(--border)",
                        }}
                      >
                        <Icon size={14} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2">
                          <span className="text-[13px] font-medium truncate">{item.label}</span>
                          <span
                            className="text-[10px] uppercase tracking-wider shrink-0"
                            style={{ color: "var(--text-faint)" }}
                          >
                            {item.type}
                          </span>
                        </div>
                        {item.subtitle && (
                          <div
                            className="text-[11.5px] truncate"
                            style={{ color: "var(--text-muted)" }}
                          >
                            {item.subtitle}
                          </div>
                        )}
                      </div>
                      {isActive && (
                        <ArrowRight size={13} style={{ color: "var(--text-muted)" }} />
                      )}
                    </button>
                  );
                })
              )}
            </div>

            <div
              className="flex items-center justify-between px-4 py-2 text-[10.5px]"
              style={{
                borderTop: "1px solid var(--border)",
                background: "var(--bg-inset)",
                color: "var(--text-faint)",
              }}
            >
              <div className="flex items-center gap-3">
                <span>
                  <span className="kbd">↑↓</span> navigate
                </span>
                <span>
                  <span className="kbd">↵</span> open
                </span>
                <span>
                  <span className="kbd">Esc</span> close
                </span>
              </div>
              <span>{filtered.length} results</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

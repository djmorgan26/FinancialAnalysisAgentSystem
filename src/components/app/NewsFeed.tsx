"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";

interface NewsItem {
  id?: number;
  headline: string;
  summary?: string;
  source?: string;
  url: string;
  datetime: number;
  related?: string;
  image?: string;
}

type Tab = "portfolio" | "market" | "symbol";

interface Props {
  variant: "compact" | "full";
  /** Held symbols — used to populate the per-symbol dropdown in full mode. */
  symbols?: string[];
}

export function NewsFeed({ variant, symbols = [] }: Props) {
  const [tab, setTab] = useState<Tab>("portfolio");
  const [symbol, setSymbol] = useState<string>(symbols[0] ?? "");
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const endpoint = useMemo(() => {
    if (tab === "market") return "/api/news?type=market";
    if (tab === "symbol" && symbol) return `/api/news?symbol=${symbol}`;
    return "/api/news";
  }, [tab, symbol]);

  const fetchNews = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(endpoint);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setItems(Array.isArray(body.news) ? body.news : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

  const shown = variant === "compact" ? items.slice(0, 3) : items;

  return (
    <div>
      {variant === "full" && (
        <div className="flex items-center gap-2 mb-3">
          <div className="flex rounded-md overflow-hidden border" style={{ borderColor: "var(--border)" }}>
            {(["portfolio", "market", "symbol"] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className="px-3 py-1.5 text-[12px] capitalize"
                style={{
                  background:
                    tab === t ? "var(--bg-inset)" : "transparent",
                  color: tab === t ? "var(--text)" : "var(--text-muted)",
                  borderRight:
                    t !== "symbol" ? "1px solid var(--border)" : "none",
                }}
              >
                {t}
              </button>
            ))}
          </div>
          {tab === "symbol" && (
            <select
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              className="input text-[12px]"
              style={{ padding: "4px 8px", height: 30 }}
            >
              {symbols.length === 0 ? (
                <option value="">No holdings</option>
              ) : (
                symbols.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))
              )}
            </select>
          )}
          <div className="flex-1" />
          <button
            type="button"
            onClick={fetchNews}
            disabled={loading}
            className="btn btn-ghost btn-sm"
          >
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>
      )}

      {error ? (
        <NewsError message={error} />
      ) : loading && items.length === 0 ? (
        <div className="text-[12px] text-[color:var(--text-muted)]">
          Loading headlines…
        </div>
      ) : shown.length === 0 ? (
        <div className="text-[12px] text-[color:var(--text-muted)]">
          No headlines right now.
        </div>
      ) : (
        <ul
          className={variant === "compact" ? "space-y-2.5" : "space-y-3"}
        >
          {shown.map((n, i) => (
            <li
              key={`${n.id ?? i}-${n.datetime}`}
              className="pb-2.5 last:pb-0"
              style={{
                borderBottom:
                  i < shown.length - 1 ? "1px dotted var(--border)" : "none",
              }}
            >
              <a
                href={n.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block group"
              >
                <div className="flex items-baseline gap-2">
                  <span
                    className="text-[12.5px] font-medium leading-snug group-hover:underline"
                    style={{ color: "var(--text)" }}
                  >
                    {n.headline}
                  </span>
                  <ExternalLink
                    size={10}
                    className="shrink-0"
                    style={{ color: "var(--text-faint)" }}
                  />
                </div>
                <div
                  className="text-[11px] mt-0.5 flex items-center gap-2"
                  style={{ color: "var(--text-muted)" }}
                >
                  {n.source && <span>{n.source}</span>}
                  {n.source && <span>·</span>}
                  <span className="mono">{relativeTime(n.datetime)}</span>
                  {n.related && variant === "full" && (
                    <>
                      <span>·</span>
                      <span className="mono">{n.related}</span>
                    </>
                  )}
                </div>
                {variant === "full" && n.summary && (
                  <div
                    className="text-[11.5px] mt-1 leading-relaxed"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {n.summary.slice(0, 220)}
                    {n.summary.length > 220 ? "…" : ""}
                  </div>
                )}
              </a>
            </li>
          ))}
        </ul>
      )}

      {variant === "compact" && !error && !loading && items.length > 0 && (
        <div className="mt-3 pt-3 border-t" style={{ borderColor: "var(--border)" }}>
          <Link
            href="/news"
            className="text-[11.5px] text-[color:var(--text-muted)] hover:text-[color:var(--text)] underline underline-offset-4"
          >
            View all →
          </Link>
        </div>
      )}
    </div>
  );
}

function NewsError({ message }: { message: string }) {
  const notConfigured = /not configured/i.test(message);
  return (
    <div
      className="text-[11.5px] rounded-md px-3 py-2"
      style={{
        background: "var(--bg-inset)",
        border: "1px solid var(--border)",
        color: "var(--text-muted)",
      }}
    >
      {notConfigured
        ? "Add FINNHUB_API_KEY to env to enable news."
        : message}
    </div>
  );
}

function relativeTime(epochSec: number): string {
  const diff = Date.now() / 1000 - epochSec;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(epochSec * 1000).toLocaleDateString();
}

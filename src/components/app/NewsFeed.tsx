"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, Newspaper, TrendingUp } from "lucide-react";

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

  if (variant === "compact") {
    return (
      <CompactList
        items={items.slice(0, 3)}
        loading={loading}
        error={error}
      />
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div
          className="flex rounded-md border flex-none"
          style={{ borderColor: "var(--border)" }}
        >
          {(["portfolio", "market", "symbol"] as Tab[]).map((t, i, arr) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className="px-3 py-1.5 text-[12px] capitalize whitespace-nowrap"
              style={{
                background: tab === t ? "var(--bg-inset)" : "transparent",
                color: tab === t ? "var(--text)" : "var(--text-muted)",
                borderRight:
                  i < arr.length - 1 ? "1px solid var(--border)" : "none",
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
            className="input text-[12px] mono flex-none"
            style={{ padding: "4px 10px", height: 30, minWidth: 120, maxWidth: 180 }}
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

      {error ? (
        <NewsError message={error} />
      ) : loading && items.length === 0 ? (
        <LoadingSkeleton />
      ) : items.length === 0 ? (
        <div className="text-[12px] text-[color:var(--text-muted)]">
          No headlines right now.
        </div>
      ) : (
        <FullFeed items={items} tab={tab} />
      )}
    </div>
  );
}

// ---------- Full feed: pulse + featured + list -------------------------------

function FullFeed({ items, tab }: { items: NewsItem[]; tab: Tab }) {
  const pulse = usePulse(items);
  const featured = items.slice(0, 3);
  const rest = items.slice(3);

  return (
    <div className="space-y-5">
      {tab !== "symbol" && pulse.total >= 4 && <PulseStrip pulse={pulse} />}

      {featured.length > 0 && (
        <div className="grid gap-3 md:grid-cols-3">
          {featured.map((n, i) => (
            <FeaturedCard key={`${n.id ?? i}-${n.datetime}`} item={n} />
          ))}
        </div>
      )}

      {rest.length > 0 && (
        <ul className="space-y-0">
          {rest.map((n, i) => (
            <li
              key={`${n.id ?? i}-${n.datetime}`}
              style={{
                borderTop: "1px solid var(--border)",
              }}
            >
              <ListRow item={n} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------- Pulse strip ------------------------------------------------------

interface Pulse {
  total: number;
  topSources: { name: string; count: number; pct: number }[];
  topTickers: { name: string; count: number }[];
  newest: number;
}

function usePulse(items: NewsItem[]): Pulse {
  return useMemo(() => {
    const total = items.length;
    const sourceCounts = new Map<string, number>();
    const tickerCounts = new Map<string, number>();
    let newest = 0;

    for (const n of items) {
      if (n.datetime > newest) newest = n.datetime;
      if (n.source) {
        sourceCounts.set(n.source, (sourceCounts.get(n.source) ?? 0) + 1);
      }
      if (n.related) {
        for (const raw of n.related.split(",")) {
          const t = raw.trim().toUpperCase();
          if (t && /^[A-Z.-]{1,6}$/.test(t)) {
            tickerCounts.set(t, (tickerCounts.get(t) ?? 0) + 1);
          }
        }
      }
    }

    const topSources = [...sourceCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({
        name,
        count,
        pct: total > 0 ? (count / total) * 100 : 0,
      }));

    const topTickers = [...tickerCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, count]) => ({ name, count }));

    return { total, topSources, topTickers, newest };
  }, [items]);
}

function PulseStrip({ pulse }: { pulse: Pulse }) {
  const palette = [
    "#4f8cff",
    "#3fb68b",
    "#d9a74a",
    "#a78bfa",
    "#60a5fa",
    "#8b93a7",
  ];
  return (
    <div
      className="rounded-md px-4 py-3"
      style={{
        background: "var(--bg-inset)",
        border: "1px solid var(--border)",
      }}
    >
      <div className="grid gap-4 md:grid-cols-[auto_1fr_1fr] items-start">
        <div className="flex items-center gap-2.5 min-w-[120px]">
          <div
            className="w-8 h-8 rounded-md flex items-center justify-center shrink-0"
            style={{
              background: "var(--bg)",
              border: "1px solid var(--border)",
              color: "var(--accent-strong)",
            }}
          >
            <Newspaper size={15} />
          </div>
          <div>
            <div className="mono text-[18px] font-semibold leading-none">
              {pulse.total}
            </div>
            <div
              className="text-[10.5px] uppercase tracking-wider mt-1"
              style={{ color: "var(--text-faint)" }}
            >
              Headlines
            </div>
          </div>
        </div>

        <div>
          <div
            className="text-[10.5px] uppercase tracking-wider mb-1.5"
            style={{ color: "var(--text-faint)" }}
          >
            Sources
          </div>
          {pulse.topSources.length > 0 ? (
            <>
              <div
                className="flex h-1.5 rounded-full overflow-hidden"
                style={{ background: "var(--border)" }}
              >
                {pulse.topSources.map((s, i) => (
                  <div
                    key={s.name}
                    style={{
                      width: `${s.pct}%`,
                      background: palette[i % palette.length],
                    }}
                    title={`${s.name} · ${s.count}`}
                  />
                ))}
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                {pulse.topSources.slice(0, 4).map((s, i) => (
                  <div
                    key={s.name}
                    className="flex items-center gap-1.5 text-[11px]"
                  >
                    <span
                      className="inline-block w-2 h-2 rounded-full"
                      style={{ background: palette[i % palette.length] }}
                    />
                    <span style={{ color: "var(--text-muted)" }}>
                      {s.name}
                    </span>
                    <span
                      className="mono"
                      style={{ color: "var(--text-faint)" }}
                    >
                      {s.count}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div
              className="text-[11px]"
              style={{ color: "var(--text-faint)" }}
            >
              —
            </div>
          )}
        </div>

        <div>
          <div
            className="text-[10.5px] uppercase tracking-wider mb-1.5 flex items-center gap-1.5"
            style={{ color: "var(--text-faint)" }}
          >
            <TrendingUp size={11} />
            Most Mentioned
          </div>
          {pulse.topTickers.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {pulse.topTickers.map((t) => (
                <span
                  key={t.name}
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px]"
                  style={{
                    background: "var(--bg)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <span className="mono font-semibold">{t.name}</span>
                  <span
                    className="mono"
                    style={{ color: "var(--text-faint)" }}
                  >
                    {t.count}
                  </span>
                </span>
              ))}
            </div>
          ) : (
            <div
              className="text-[11px]"
              style={{ color: "var(--text-faint)" }}
            >
              No ticker tags
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- Featured card ----------------------------------------------------

function FeaturedCard({ item }: { item: NewsItem }) {
  const [imgOk, setImgOk] = useState(true);
  const hasImage = !!item.image && imgOk;

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col rounded-md overflow-hidden"
      style={{
        background: "var(--bg-inset)",
        border: "1px solid var(--border)",
      }}
    >
      <div
        className="relative aspect-[16/9] overflow-hidden flex items-center justify-center p-4"
        style={{ background: "var(--bg)" }}
      >
        {hasImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.image}
            alt=""
            onError={() => setImgOk(false)}
            className="max-w-full max-h-full object-contain group-hover:scale-[1.03] transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <FallbackArt source={item.source} related={item.related} />
        )}
      </div>
      <div className="p-3 flex-1 flex flex-col">
        <div
          className="flex items-center gap-2 text-[10.5px] mb-1.5"
          style={{ color: "var(--text-faint)" }}
        >
          {item.source && (
            <span
              className="px-1.5 py-0.5 rounded"
              style={{
                background: "var(--bg)",
                border: "1px solid var(--border)",
                color: "var(--text-muted)",
              }}
            >
              {item.source}
            </span>
          )}
          <span className="mono">{relativeTime(item.datetime)}</span>
          {item.related && (
            <span
              className="mono truncate"
              style={{ color: "var(--text-faint)" }}
            >
              · {item.related.split(",")[0].trim()}
            </span>
          )}
        </div>
        <div
          className="text-[13px] font-medium leading-snug group-hover:underline"
          style={{ color: "var(--text)" }}
        >
          {item.headline}
        </div>
        {item.summary && item.summary !== item.headline && (
          <div
            className="text-[11.5px] mt-1.5 leading-relaxed line-clamp-2"
            style={{ color: "var(--text-muted)" }}
          >
            {item.summary}
          </div>
        )}
      </div>
    </a>
  );
}

function FallbackArt({
  source,
  related,
}: {
  source?: string;
  related?: string;
}) {
  const label = related?.split(",")[0]?.trim() || source || "News";
  const hue = hashHue(label);
  return (
    <div
      className="w-full h-full flex items-center justify-center"
      style={{
        background: `linear-gradient(135deg, hsl(${hue}, 45%, 22%) 0%, hsl(${(hue + 40) % 360}, 40%, 14%) 100%)`,
      }}
    >
      <span
        className="mono text-[22px] font-semibold tracking-wide"
        style={{ color: "rgba(255,255,255,0.75)" }}
      >
        {label}
      </span>
    </div>
  );
}

function hashHue(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h) % 360;
}

// ---------- List row (rest of headlines) -------------------------------------

function ListRow({ item }: { item: NewsItem }) {
  const hideSummary =
    !item.summary ||
    item.summary === item.headline ||
    item.summary.length < 40;

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block py-3"
    >
      <div className="flex items-baseline gap-2">
        <span
          className="text-[12.5px] font-medium leading-snug group-hover:underline"
          style={{ color: "var(--text)" }}
        >
          {item.headline}
        </span>
        <ExternalLink
          size={10}
          className="shrink-0"
          style={{ color: "var(--text-faint)" }}
        />
      </div>
      <div
        className="text-[11px] mt-1 flex items-center flex-wrap gap-x-2 gap-y-0.5"
        style={{ color: "var(--text-muted)" }}
      >
        {item.source && (
          <span
            className="px-1.5 py-0.5 rounded text-[10.5px]"
            style={{
              background: "var(--bg-inset)",
              border: "1px solid var(--border)",
            }}
          >
            {item.source}
          </span>
        )}
        <span className="mono">{relativeTime(item.datetime)}</span>
        {item.related && (
          <span
            className="mono"
            style={{ color: "var(--text-faint)" }}
          >
            · {item.related.split(",").slice(0, 2).join(", ")}
          </span>
        )}
      </div>
      {!hideSummary && (
        <div
          className="text-[11.5px] mt-1 leading-relaxed line-clamp-2"
          style={{ color: "var(--text-muted)" }}
        >
          {item.summary}
        </div>
      )}
    </a>
  );
}

// ---------- Compact (dashboard) ----------------------------------------------

function CompactList({
  items,
  loading,
  error,
}: {
  items: NewsItem[];
  loading: boolean;
  error: string | null;
}) {
  if (error) return <NewsError message={error} />;
  if (loading && items.length === 0) {
    return (
      <div className="text-[12px] text-[color:var(--text-muted)]">
        Loading headlines…
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <div className="text-[12px] text-[color:var(--text-muted)]">
        No headlines right now.
      </div>
    );
  }
  return (
    <div>
      <ul className="space-y-2.5">
        {items.map((n, i) => (
          <li
            key={`${n.id ?? i}-${n.datetime}`}
            className="pb-2.5 last:pb-0"
            style={{
              borderBottom:
                i < items.length - 1 ? "1px dotted var(--border)" : "none",
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
              </div>
            </a>
          </li>
        ))}
      </ul>
      <div
        className="mt-3 pt-3 border-t"
        style={{ borderColor: "var(--border)" }}
      >
        <Link
          href="/news"
          className="text-[11.5px] text-[color:var(--text-muted)] hover:text-[color:var(--text)] underline underline-offset-4"
        >
          View all →
        </Link>
      </div>
    </div>
  );
}

// ---------- Shared bits ------------------------------------------------------

function LoadingSkeleton() {
  return (
    <div className="space-y-5">
      <div
        className="rounded-md px-4 py-3 h-[78px] animate-pulse"
        style={{
          background: "var(--bg-inset)",
          border: "1px solid var(--border)",
        }}
      />
      <div className="grid gap-3 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="rounded-md overflow-hidden animate-pulse"
            style={{
              background: "var(--bg-inset)",
              border: "1px solid var(--border)",
            }}
          >
            <div
              className="aspect-[16/9]"
              style={{ background: "var(--bg)" }}
            />
            <div className="p-3 space-y-2">
              <div
                className="h-3 rounded w-1/3"
                style={{ background: "var(--border)" }}
              />
              <div
                className="h-4 rounded"
                style={{ background: "var(--border)" }}
              />
              <div
                className="h-4 rounded w-5/6"
                style={{ background: "var(--border)" }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-12 rounded animate-pulse"
            style={{ background: "var(--bg-inset)" }}
          />
        ))}
      </div>
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

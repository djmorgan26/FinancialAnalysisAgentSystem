"use client";

import { useState, useEffect, useCallback } from "react";

interface NewsItem {
  id: number;
  headline: string;
  summary: string;
  source: string;
  url: string;
  datetime: number;
  related: string;
  image: string;
}

export default function NewsFeed() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"portfolio" | "market">("portfolio");

  const fetchNews = useCallback(async (type: "portfolio" | "market") => {
    setLoading(true);
    setError(null);
    try {
      const url =
        type === "market" ? "/api/news?type=market" : "/api/news";
      const res = await fetch(url);
      const data = await res.json();

      if (data.error) {
        if (data.error === "Finnhub not configured") {
          setError("not_configured");
        } else {
          setError(data.error);
        }
        setNews([]);
      } else {
        setNews(data.news || []);
      }
    } catch {
      setError("Failed to fetch news");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNews(tab);
  }, [tab, fetchNews]);

  return (
    <section className="rounded-lg border border-card-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground">Market News</h2>
        <div className="flex gap-1 bg-[#161616] rounded-lg p-1">
          <TabBtn
            active={tab === "portfolio"}
            onClick={() => setTab("portfolio")}
          >
            My Holdings
          </TabBtn>
          <TabBtn
            active={tab === "market"}
            onClick={() => setTab("market")}
          >
            Market
          </TabBtn>
        </div>
      </div>

      {error === "not_configured" ? (
        <div className="py-6 text-center">
          <p className="text-sm text-muted-foreground">
            Add <code className="text-foreground">FINNHUB_API_KEY</code> to{" "}
            <code className="text-foreground">.env.local</code> for live news
          </p>
          <p className="text-xs text-muted mt-1">
            Free at finnhub.io — 60 calls/min
          </p>
        </div>
      ) : error ? (
        <p className="text-sm text-red-400 py-4 text-center">{error}</p>
      ) : loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-16 rounded-lg bg-[#161616] animate-pulse"
            />
          ))}
        </div>
      ) : news.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          No recent news found.
        </p>
      ) : (
        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
          {news.map((item) => (
            <a
              key={item.id}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-lg border border-card-border bg-[#161616] p-3 hover:bg-[#1a1a1a] transition-colors group"
            >
              <div className="flex gap-3">
                {item.image && (
                  <div className="w-16 h-16 rounded-md overflow-hidden shrink-0 bg-[#1a1a1a]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.image}
                      alt=""
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-medium text-foreground group-hover:text-blue-400 transition-colors line-clamp-2">
                    {item.headline}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-muted-foreground">
                      {item.source}
                    </span>
                    <span className="text-[10px] text-muted">
                      {formatTimeAgo(item.datetime)}
                    </span>
                    {item.related && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400">
                        {item.related}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-xs px-3 py-1.5 rounded-md transition-colors ${
        active
          ? "bg-card text-foreground font-medium shadow-sm"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor(Date.now() / 1000 - timestamp);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

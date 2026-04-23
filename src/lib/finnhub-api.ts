/**
 * Finnhub API — Free tier: 60 calls/min
 * Real-time stock quotes, company news, and market sentiment.
 *
 * Setup: Get a free API key at https://finnhub.io → add to .env.local:
 *   FINNHUB_API_KEY=your_key
 */

import { hasEnv, requireEnv } from "./env";

const BASE_URL = "https://finnhub.io/api/v1";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StockQuote {
  symbol: string;
  current: number;       // c — current price
  change: number;        // d — change
  percentChange: number; // dp — percent change
  high: number;          // h — high of the day
  low: number;           // l — low of the day
  open: number;          // o — open price
  previousClose: number; // pc — previous close
  timestamp: number;     // t — unix timestamp
}

export interface MarketNews {
  id: number;
  category: string;
  datetime: number;
  headline: string;
  image: string;
  related: string;
  source: string;
  summary: string;
  url: string;
}

export interface CompanyNews {
  id: number;
  category: string;
  datetime: number;
  headline: string;
  image: string;
  related: string;
  source: string;
  summary: string;
  url: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function finnhubFetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  if (!hasEnv("FINNHUB_API_KEY")) {
    throw new Error("FINNHUB_NOT_CONFIGURED");
  }

  const url = new URL(`${BASE_URL}${endpoint}`);
  url.searchParams.set("token", requireEnv("FINNHUB_API_KEY"));
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    next: { revalidate: 60 }, // Cache for 60 seconds in Next.js
  });

  if (res.status === 429) {
    throw new Error("FINNHUB_RATE_LIMIT");
  }

  if (!res.ok) {
    throw new Error(`Finnhub API error (${res.status})`);
  }

  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get a real-time quote for a single symbol.
 */
export async function getQuote(symbol: string): Promise<StockQuote> {
  const raw = await finnhubFetch<{
    c: number; d: number; dp: number; h: number;
    l: number; o: number; pc: number; t: number;
  }>("/quote", { symbol });

  return {
    symbol,
    current: raw.c,
    change: raw.d,
    percentChange: raw.dp,
    high: raw.h,
    low: raw.l,
    open: raw.o,
    previousClose: raw.pc,
    timestamp: raw.t,
  };
}

/**
 * Get quotes for multiple symbols.
 * Batches requests to stay under rate limits (60/min).
 * Adds a small delay between requests.
 */
export async function getQuotes(symbols: string[]): Promise<StockQuote[]> {
  const unique = [...new Set(symbols)].filter(
    (s) => s && !s.startsWith("NON") && s !== "SWVXX" && s !== "Cash"
  );

  const results: StockQuote[] = [];
  const batchSize = 15; // ~15 per batch, well under 60/min

  for (let i = 0; i < unique.length; i += batchSize) {
    const batch = unique.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(async (sym) => {
        try {
          return await getQuote(sym);
        } catch {
          return null;
        }
      })
    );
    results.push(...batchResults.filter((r): r is StockQuote => r !== null));

    // Rate limit pause between batches
    if (i + batchSize < unique.length) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  return results;
}

/**
 * Get general market news.
 */
export async function getMarketNews(
  category: "general" | "forex" | "crypto" | "merger" = "general"
): Promise<MarketNews[]> {
  return finnhubFetch<MarketNews[]>("/news", { category });
}

/**
 * Get news for a specific company.
 */
export async function getCompanyNews(
  symbol: string,
  from: string, // YYYY-MM-DD
  to: string
): Promise<CompanyNews[]> {
  return finnhubFetch<CompanyNews[]>("/company-news", { symbol, from, to });
}

/**
 * Get news for all symbols the user holds.
 * Deduplicates and sorts by date.
 */
export async function getPortfolioNews(
  symbols: string[],
  daysBack: number = 3
): Promise<CompanyNews[]> {
  // Pick top symbols to stay under rate limits
  const topSymbols = symbols
    .filter((s) => s && !s.startsWith("NON") && s !== "SWVXX" && s !== "Cash")
    .slice(0, 10); // Top 10 holdings

  const now = new Date();
  const from = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
  const toStr = now.toISOString().split("T")[0];
  const fromStr = from.toISOString().split("T")[0];

  const allNews: CompanyNews[] = [];

  for (const sym of topSymbols) {
    try {
      const news = await getCompanyNews(sym, fromStr, toStr);
      allNews.push(...news.slice(0, 3)); // Max 3 per symbol
      await new Promise((resolve) => setTimeout(resolve, 500)); // Rate limit
    } catch {
      // Skip failures silently
    }
  }

  // Deduplicate by headline and sort by date
  const seen = new Set<string>();
  const unique = allNews.filter((n) => {
    if (seen.has(n.headline)) return false;
    seen.add(n.headline);
    return true;
  });

  return unique.sort((a, b) => b.datetime - a.datetime).slice(0, 20);
}

/**
 * Check if Finnhub is configured.
 */
export function isConfigured(): boolean {
  return hasEnv("FINNHUB_API_KEY");
}

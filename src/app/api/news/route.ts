/**
 * GET /api/news — portfolio-relevant news from Finnhub (default)
 * GET /api/news?type=market — general market news
 * GET /api/news?symbol=NVDA — company-specific news (must be a held symbol)
 *
 * Auth-gated; symbols are validated against the caller's actual holdings so
 * the shared Finnhub key can't be turned into an open news proxy.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { loadFinancialData } from "@/lib/data-store";
import * as finnhub from "@/lib/finnhub-api";

export async function GET(request: NextRequest) {
  if (!finnhub.isConfigured()) {
    return NextResponse.json(
      { error: "Finnhub not configured" },
      { status: 400 }
    );
  }

  let userId: string;
  try {
    ({ user: { id: userId } } = await requireUser());
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const type = request.nextUrl.searchParams.get("type");
  const symbol = request.nextUrl.searchParams.get("symbol");
  const fetchedAt = new Date().toISOString();

  try {
    if (type === "market") {
      const news = await finnhub.getMarketNews("general");
      return NextResponse.json({ news: news.slice(0, 15), fetchedAt });
    }

    const data = await loadFinancialData(userId);
    const held = new Set(
      data.holdings.map((h) => h.symbol.toUpperCase())
    );

    if (symbol) {
      const sym = symbol.toUpperCase();
      if (!held.has(sym)) {
        return NextResponse.json(
          { error: "Symbol not in your holdings" },
          { status: 403 }
        );
      }
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const iso = (d: Date) => d.toISOString().slice(0, 10);
      const news = await finnhub.getCompanyNews(sym, iso(weekAgo), iso(now));
      return NextResponse.json({
        symbol: sym,
        news: news.slice(0, 10),
        fetchedAt,
      });
    }

    const topSymbols = [...data.holdings]
      .filter((h) => h.assetClass !== "cash" && h.assetClass !== "crypto")
      .sort((a, b) => b.currentValue - a.currentValue)
      .slice(0, 10)
      .map((h) => h.symbol);
    const news = await finnhub.getPortfolioNews(topSymbols, 3);
    return NextResponse.json({ news, symbols: topSymbols, fetchedAt });
  } catch (err) {
    console.error("[GET /api/news] failed:", err);
    return NextResponse.json(
      { error: "News fetch failed", detail: String(err) },
      { status: 500 }
    );
  }
}

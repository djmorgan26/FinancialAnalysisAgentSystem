/**
 * GET /api/news — Portfolio-relevant news from Finnhub
 * GET /api/news?type=market — General market news
 * GET /api/news?symbol=NVDA — Company-specific news
 */
import { NextRequest, NextResponse } from "next/server";
import * as finnhub from "@/lib/finnhub-api";
import { loadAnalysis } from "@/lib/data-store";

export async function GET(request: NextRequest) {
  if (!finnhub.isConfigured()) {
    return NextResponse.json(
      {
        error: "Finnhub not configured",
        setup: "Add FINNHUB_API_KEY to .env.local (free at https://finnhub.io)",
      },
      { status: 400 }
    );
  }

  const type = request.nextUrl.searchParams.get("type");
  const symbol = request.nextUrl.searchParams.get("symbol");

  try {
    if (type === "market") {
      const news = await finnhub.getMarketNews("general");
      return NextResponse.json({
        news: news.slice(0, 15),
        fetchedAt: new Date().toISOString(),
      });
    }

    if (symbol) {
      const now = new Date();
      const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const news = await finnhub.getCompanyNews(
        symbol.toUpperCase(),
        from.toISOString().split("T")[0],
        now.toISOString().split("T")[0]
      );
      return NextResponse.json({
        symbol: symbol.toUpperCase(),
        news: news.slice(0, 10),
        fetchedAt: new Date().toISOString(),
      });
    }

    // Default: portfolio news for top holdings
    const analysis = await loadAnalysis();
    if (!analysis) {
      return NextResponse.json(
        { error: "No analysis data. Run analysis first." },
        { status: 400 }
      );
    }

    // Get top holdings by value for news
    const topSymbols = analysis.holdings
      .filter(
        (h) =>
          h.symbol &&
          !h.symbol.startsWith("NON") &&
          h.symbol !== "SWVXX" &&
          h.symbol !== "Cash"
      )
      .sort((a, b) => b.currentValue - a.currentValue)
      .slice(0, 10)
      .map((h) => h.symbol);

    const news = await finnhub.getPortfolioNews(topSymbols, 3);

    return NextResponse.json({
      news,
      symbols: topSymbols,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * GET /api/prices?symbols=AAPL,MSFT,NVDA — Fetch real-time quotes
 * POST /api/prices — Refresh all portfolio prices and update analysis
 */
import { NextRequest, NextResponse } from "next/server";
import * as finnhub from "@/lib/finnhub-api";
import { loadAnalysis, saveAnalysis } from "@/lib/data-store";
import { requireUser } from "@/lib/supabase/server";

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

  const symbolsParam = request.nextUrl.searchParams.get("symbols") || "";
  const symbols = symbolsParam
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);

  if (symbols.length === 0) {
    return NextResponse.json(
      { error: "No symbols provided. Use ?symbols=AAPL,MSFT" },
      { status: 400 }
    );
  }

  try {
    const quotes = await finnhub.getQuotes(symbols);
    return NextResponse.json({ quotes, fetchedAt: new Date().toISOString() });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST() {
  if (!finnhub.isConfigured()) {
    return NextResponse.json(
      { error: "Finnhub not configured" },
      { status: 400 }
    );
  }

  try {
    const { user } = await requireUser();
    const analysis = await loadAnalysis(user.id);
    if (!analysis) {
      return NextResponse.json(
        { error: "No analysis data found. Run analysis first." },
        { status: 400 }
      );
    }

    // Get unique symbols from holdings
    const symbols = [
      ...new Set(analysis.holdings.map((h) => h.symbol)),
    ].filter(
      (s) => s && !s.startsWith("NON") && s !== "SWVXX" && s !== "Cash"
    );

    const quotes = await finnhub.getQuotes(symbols);
    const quoteMap = new Map(quotes.map((q) => [q.symbol, q]));

    // Update holdings with real-time prices
    let updatedCount = 0;
    for (const holding of analysis.holdings) {
      const quote = quoteMap.get(holding.symbol);
      if (quote && quote.current > 0) {
        const oldValue = holding.currentValue;
        holding.currentPrice = quote.current;
        holding.currentValue = Math.round(holding.quantity * quote.current * 100) / 100;
        holding.gainLoss = Math.round((holding.currentValue - holding.costBasis) * 100) / 100;
        holding.gainLossPercent =
          holding.costBasis > 0
            ? Math.round((holding.gainLoss / holding.costBasis) * 10000) / 100
            : 0;
        holding.lastUpdated = new Date().toISOString();
        if (Math.abs(holding.currentValue - oldValue) > 0.01) updatedCount++;
      }
    }

    // Recalculate portfolio-level metrics
    const totalAssets = analysis.holdings.reduce(
      (sum, h) => sum + h.currentValue,
      0
    );
    analysis.totalAssets = Math.round(totalAssets * 100) / 100;
    analysis.netWorth = analysis.totalAssets - analysis.totalLiabilities;
    analysis.generatedAt = new Date().toISOString();

    // Recalculate sector exposure
    const sectorTotals: Record<string, number> = {};
    for (const h of analysis.holdings) {
      sectorTotals[h.sector] = (sectorTotals[h.sector] || 0) + h.currentValue;
    }
    analysis.sectorExposure = Object.entries(sectorTotals)
      .sort(([, a], [, b]) => b - a)
      .map(([label, value]) => ({
        label,
        value: Math.round(value * 100) / 100,
        percent: Math.round((value / totalAssets) * 1000) / 10,
      }));

    await saveAnalysis(user.id, analysis);

    return NextResponse.json({
      success: true,
      symbolsChecked: symbols.length,
      pricesUpdated: updatedCount,
      newNetWorth: analysis.netWorth,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

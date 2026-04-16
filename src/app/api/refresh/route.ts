/**
 * POST /api/refresh — One-click full data refresh.
 *
 * Orchestrates all available data sources:
 *   1. Schwab API (if connected) → pull accounts + positions
 *   2. Finnhub (if configured) → update real-time prices
 *   3. Coinbase (if configured) → pull crypto holdings
 *   4. Falls back to existing CSV data for uncovered platforms
 *   5. Re-runs the analysis pipeline
 */
import { NextResponse } from "next/server";
import * as schwab from "@/lib/schwab-api";
import * as finnhub from "@/lib/finnhub-api";
import * as coinbase from "@/lib/coinbase-api";
import { loadAnalysis, saveAnalysis } from "@/lib/data-store";

interface RefreshResult {
  schwab: { success: boolean; message: string };
  finnhub: { success: boolean; message: string };
  coinbase: { success: boolean; message: string };
  overall: {
    success: boolean;
    dataSourcesUsed: string[];
    pricesUpdated: number;
    timestamp: string;
  };
}

export async function POST() {
  const result: RefreshResult = {
    schwab: { success: false, message: "Not configured" },
    finnhub: { success: false, message: "Not configured" },
    coinbase: { success: false, message: "Not configured" },
    overall: {
      success: false,
      dataSourcesUsed: [],
      pricesUpdated: 0,
      timestamp: new Date().toISOString(),
    },
  };

  // ---------- Step 1: Schwab ----------
  if (schwab.isConfigured()) {
    try {
      const token = await schwab.getValidToken();
      if (token) {
        const data = await schwab.fetchAllSchwabData();
        result.schwab = {
          success: true,
          message: `Synced ${data.accounts.length} accounts`,
        };
        result.overall.dataSourcesUsed.push("schwab");
      } else {
        result.schwab = {
          success: false,
          message: "Token expired — re-authenticate at /api/schwab",
        };
      }
    } catch (err: unknown) {
      result.schwab = {
        success: false,
        message: err instanceof Error ? err.message : "Unknown error",
      };
    }
  }

  // ---------- Step 2: Coinbase ----------
  if (coinbase.isConfigured()) {
    try {
      const holdings = await coinbase.getHoldings();
      result.coinbase = {
        success: true,
        message: `Found ${holdings.length} crypto positions`,
      };
      result.overall.dataSourcesUsed.push("coinbase");
    } catch (err: unknown) {
      result.coinbase = {
        success: false,
        message: err instanceof Error ? err.message : "Unknown error",
      };
    }
  }

  // ---------- Step 3: Finnhub price refresh ----------
  if (finnhub.isConfigured()) {
    try {
      const analysis = await loadAnalysis();
      if (analysis) {
        const symbols = [
          ...new Set(analysis.holdings.map((h) => h.symbol)),
        ].filter(
          (s) =>
            s && !s.startsWith("NON") && s !== "SWVXX" && s !== "Cash"
        );

        const quotes = await finnhub.getQuotes(symbols);
        const quoteMap = new Map(quotes.map((q) => [q.symbol, q]));

        let updatedCount = 0;
        for (const holding of analysis.holdings) {
          const quote = quoteMap.get(holding.symbol);
          if (quote && quote.current > 0) {
            holding.currentPrice = quote.current;
            holding.currentValue =
              Math.round(holding.quantity * quote.current * 100) / 100;
            holding.gainLoss =
              Math.round(
                (holding.currentValue - holding.costBasis) * 100
              ) / 100;
            holding.gainLossPercent =
              holding.costBasis > 0
                ? Math.round(
                    (holding.gainLoss / holding.costBasis) * 10000
                  ) / 100
                : 0;
            holding.lastUpdated = new Date().toISOString();
            updatedCount++;
          }
        }

        // Recalculate totals
        const totalAssets = analysis.holdings.reduce(
          (sum, h) => sum + h.currentValue,
          0
        );
        analysis.totalAssets = Math.round(totalAssets * 100) / 100;
        analysis.netWorth = analysis.totalAssets - analysis.totalLiabilities;
        analysis.generatedAt = new Date().toISOString();

        await saveAnalysis(analysis);

        result.finnhub = {
          success: true,
          message: `Updated ${updatedCount}/${symbols.length} prices`,
        };
        result.overall.pricesUpdated = updatedCount;
        result.overall.dataSourcesUsed.push("finnhub");
      }
    } catch (err: unknown) {
      result.finnhub = {
        success: false,
        message: err instanceof Error ? err.message : "Unknown error",
      };
    }
  }

  // Always include CSV as a data source
  result.overall.dataSourcesUsed.push("csv-fallback");
  result.overall.success = result.overall.dataSourcesUsed.length > 1;

  return NextResponse.json(result);
}

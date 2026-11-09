/**
 * Live price refresh for positions whose platform has no live API here
 * (Robinhood, Fidelity and other CSV imports).
 *
 * Quantities stay as last imported; prices, values and gain/loss are
 * re-marked from Finnhub quotes and written back to `holdings`, so the
 * read-only `claude_ro.holdings` view reflects today's market.
 * Never quotes cash or crypto: symbols like CASH/BTC/ETH collide with tickers.
 */
import * as finnhub from "./finnhub-api";
import { getSupabaseAdmin } from "./supabase/admin";

const LIVE_API_PLATFORMS = new Set(["schwab", "coinbase"]);

export interface PriceRefreshResult {
  quoted: number;
  updated: number;
}

export async function refreshCsvHoldingPrices(
  userId: string
): Promise<PriceRefreshResult> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("holdings")
    .select("id, platform, symbol, quantity, cost_basis, asset_class")
    .eq("user_id", userId);
  if (error) throw new Error(`holdings read: ${error.message}`);

  const rows = (data ?? []).filter(
    (h) =>
      !LIVE_API_PLATFORMS.has(h.platform) &&
      h.asset_class !== "cash" &&
      h.asset_class !== "crypto" &&
      typeof h.symbol === "string" &&
      h.symbol.length > 0 &&
      !h.symbol.startsWith("NON")
  );
  if (rows.length === 0) return { quoted: 0, updated: 0 };

  const quotes = await finnhub.getQuotes(rows.map((h) => h.symbol));
  const bySymbol = new Map(quotes.map((q) => [q.symbol, q]));

  const now = new Date().toISOString();
  let updated = 0;
  for (const h of rows) {
    const q = bySymbol.get(h.symbol);
    if (!q || !(q.current > 0)) continue;
    const quantity = Number(h.quantity) || 0;
    const costBasis = Number(h.cost_basis) || 0;
    const currentValue = Math.round(quantity * q.current * 100) / 100;
    const gainLoss = Math.round((currentValue - costBasis) * 100) / 100;
    const { error: upErr } = await supabase
      .from("holdings")
      .update({
        current_price: q.current,
        current_value: currentValue,
        gain_loss: gainLoss,
        gain_loss_percent:
          costBasis > 0 ? Math.round((gainLoss / costBasis) * 10000) / 100 : 0,
        last_updated: now,
      })
      .eq("id", h.id)
      .eq("user_id", userId);
    if (!upErr) updated++;
  }
  return { quoted: quotes.length, updated };
}

/**
 * Coinbase → Supabase sync.
 *
 * Reads balances from the Coinbase CDP API (read-only use) and replaces this
 * user's Coinbase account + holdings rows. Shared by:
 *   • POST /api/coinbase   — Connections page sync button
 *   • GET  /api/cron/sync  — scheduled daily sync
 */
import * as coinbase from "./coinbase-api";
import { getSupabaseAdmin } from "./supabase/admin";
import { deterministicId } from "./importers/utils";
import { invalidateAnalysis } from "./data-store";

export interface CoinbaseSyncResult {
  positionCount: number;
  totalValue: number;
  fetchedAt: string;
}

export async function syncCoinbaseToSupabase(
  userId: string
): Promise<CoinbaseSyncResult> {
  const supabase = getSupabaseAdmin();
  const fetchedAt = new Date().toISOString();

  try {
    const holdings = await coinbase.getHoldings();

    const accountId = deterministicId(`coinbase-account-${userId}-main`);
    const totalValue = holdings.reduce((s, h) => s + h.valueUSD, 0);

    {
      const { error } = await supabase.from("accounts").upsert(
        [
          {
            id: accountId,
            user_id: userId,
            platform: "coinbase",
            account_type: "crypto",
            name: "Coinbase",
            balance: totalValue,
            currency: "USD",
            last_updated: fetchedAt,
          },
        ],
        { onConflict: "id" }
      );
      if (error) throw new Error(`accounts upsert: ${error.message}`);
    }

    {
      const { error } = await supabase
        .from("holdings")
        .delete()
        .eq("user_id", userId)
        .eq("platform", "coinbase");
      if (error) throw new Error(`holdings delete: ${error.message}`);
    }

    if (holdings.length > 0) {
      const rows = holdings.map((h) => ({
        id: deterministicId(`coinbase-holding-${userId}-${h.symbol}`),
        user_id: userId,
        account_id: accountId,
        platform: "coinbase",
        symbol: h.symbol,
        name: h.name || h.symbol,
        quantity: h.quantity,
        cost_basis: h.valueUSD,
        current_price: h.currentPrice,
        current_value: h.valueUSD,
        gain_loss: 0,
        gain_loss_percent: 0,
        asset_class: "crypto",
        sector: "crypto",
        last_updated: fetchedAt,
      }));
      const { error } = await supabase.from("holdings").insert(rows);
      if (error) throw new Error(`holdings insert: ${error.message}`);
    }

    await supabase.from("sync_logs").insert({
      user_id: userId,
      source: "coinbase",
      status: "success",
      message: `Synced 1 account, ${holdings.length} crypto positions`,
      metadata: {
        positionCount: holdings.length,
        totalValue,
        fetchedAt,
        symbols: holdings.map((h) => h.symbol),
      },
    });

    await invalidateAnalysis(userId);

    return { positionCount: holdings.length, totalValue, fetchedAt };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await supabase.from("sync_logs").insert({
      user_id: userId,
      source: "coinbase",
      status: "error",
      message,
      metadata: { fetchedAt },
    });
    throw err;
  }
}

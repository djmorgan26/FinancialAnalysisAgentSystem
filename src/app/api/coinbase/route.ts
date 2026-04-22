/**
 * GET  /api/coinbase — Connection status
 * POST /api/coinbase — Trigger sync from Coinbase Advanced Trade API → Supabase
 */
import { NextResponse } from "next/server";
import * as coinbase from "@/lib/coinbase-api";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/supabase/server";
import { deterministicId } from "@/lib/importers/utils";

export async function GET() {
  if (!coinbase.isConfigured()) {
    return NextResponse.json({ configured: false, connected: false });
  }
  try {
    await coinbase.getAccounts();
    return NextResponse.json({ configured: true, connected: true });
  } catch (err) {
    return NextResponse.json({
      configured: true,
      connected: false,
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
}

export async function POST() {
  if (!coinbase.isConfigured()) {
    return NextResponse.json(
      { error: "Coinbase API not configured" },
      { status: 400 }
    );
  }
  let userId: string;
  try {
    ({ user: { id: userId } } = await requireUser());
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

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

    return NextResponse.json({
      success: true,
      positionCount: holdings.length,
      totalValue,
      fetchedAt,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await supabase.from("sync_logs").insert({
      user_id: userId,
      source: "coinbase",
      status: "error",
      message,
      metadata: { fetchedAt },
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

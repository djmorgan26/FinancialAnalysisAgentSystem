/**
 * GET /api/connections — Status of all data source connections for the signed-in user.
 */
import { NextResponse } from "next/server";
import * as schwab from "@/lib/schwab-api";
import * as finnhub from "@/lib/finnhub-api";
import * as coinbase from "@/lib/coinbase-api";
import { requireUser } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isDemoUserId } from "@/lib/demo/constants";

export async function GET() {
  let userId: string;
  try {
    ({ user: { id: userId } } = await requireUser());
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Read-only demo: report mock-connected sources, no Supabase calls.
  if (isDemoUserId(userId)) {
    return NextResponse.json({
      schwab: {
        configured: true,
        connected: true,
        needsReauth: false,
        accounts: [
          { id: "demo-acct-schwab-brokerage", name: "Schwab Individual Brokerage", last4: "4821" },
          { id: "demo-acct-schwab-roth", name: "Schwab Roth IRA", last4: "7733" },
        ],
      },
      finnhub: { configured: true, connected: true },
      coinbase: { configured: true, connected: true },
      csv: { fidelity: new Date().toISOString(), robinhood: null },
    });
  }

  // ---- Schwab ----
  let schwabStatus;
  if (schwab.isConfigured()) {
    const status = await schwab.getConnectionStatus(userId);
    const { data: schwabAccounts } = await getSupabaseAdmin()
      .from("accounts")
      .select("id, name, last4")
      .eq("user_id", userId)
      .eq("platform", "schwab")
      .order("name");
    schwabStatus = {
      configured: true,
      ...status,
      authUrl: schwab.getAuthorizationUrl(userId),
      accounts: (schwabAccounts ?? []).map((a) => ({
        id: a.id as string,
        name: a.name as string,
        last4: (a.last4 as string | null) ?? null,
      })),
    };
  } else {
    schwabStatus = { configured: false, connected: false, needsReauth: true, accounts: [] };
  }

  // ---- Finnhub (global, not per user) ----
  const finnhubConfigured = finnhub.isConfigured();
  let finnhubConnected = finnhubConfigured;
  if (finnhubConfigured) {
    try {
      await finnhub.getQuote("AAPL");
      finnhubConnected = true;
    } catch {
      finnhubConnected = false;
    }
  }

  // ---- Coinbase ----
  const coinbaseConfigured = coinbase.isConfigured();
  let coinbaseConnected = false;
  if (coinbaseConfigured) {
    try {
      await coinbase.getAccounts();
      coinbaseConnected = true;
    } catch {
      coinbaseConnected = false;
    }
  }

  // ---- CSV freshness per platform ----
  const supabase = getSupabaseAdmin();
  const { data: accounts } = await supabase
    .from("accounts")
    .select("platform, last_updated")
    .eq("user_id", userId)
    .in("platform", ["fidelity", "robinhood"]);

  const csvFreshness: Record<string, string | null> = {
    fidelity: null,
    robinhood: null,
  };
  for (const row of accounts ?? []) {
    const prev = csvFreshness[row.platform];
    if (!prev || row.last_updated > prev) csvFreshness[row.platform] = row.last_updated;
  }

  return NextResponse.json({
    schwab: schwabStatus,
    finnhub: { configured: finnhubConfigured, connected: finnhubConnected },
    coinbase: { configured: coinbaseConfigured, connected: coinbaseConnected },
    csv: csvFreshness,
  });
}

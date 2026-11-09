/**
 * GET  /api/coinbase — Connection status
 * POST /api/coinbase — Trigger sync from Coinbase Advanced Trade API → Supabase
 */
import { NextResponse } from "next/server";
import * as coinbase from "@/lib/coinbase-api";
import { requireUser } from "@/lib/supabase/server";
import { syncCoinbaseToSupabase } from "@/lib/coinbase-sync";
import { isOwner } from "@/lib/owner";

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
  // The Coinbase key is the owner's own key: never sync it into anyone else's rows.
  if (!isOwner(userId)) {
    return NextResponse.json(
      { error: "Coinbase sync is limited to the account owner" },
      { status: 403 }
    );
  }

  try {
    const result = await syncCoinbaseToSupabase(userId);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

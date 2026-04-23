/**
 * GET  /api/schwab — Connection status + auth URL (for the logged-in user)
 * POST /api/schwab — Trigger data sync from Schwab (writes to Supabase)
 */
import { NextResponse } from "next/server";
import {
  isConfigured,
  getConnectionStatus,
  getAuthorizationUrl,
  getValidToken,
} from "@/lib/schwab-api";
import { syncSchwabToSupabase } from "@/lib/schwab-sync";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/supabase/server";

export async function GET() {
  if (!isConfigured()) {
    return NextResponse.json({
      configured: false,
      connected: false,
      message:
        "Schwab API not configured. Add SCHWAB_APP_KEY and SCHWAB_APP_SECRET to .env.local",
    });
  }
  let userId: string;
  try {
    ({ user: { id: userId } } = await requireUser());
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const status = await getConnectionStatus(userId);
  return NextResponse.json({
    configured: true,
    ...status,
    authUrl: getAuthorizationUrl(userId),
  });
}

export async function POST() {
  if (!isConfigured()) {
    return NextResponse.json(
      { error: "Schwab API not configured" },
      { status: 400 }
    );
  }
  let userId: string;
  try {
    ({ user: { id: userId } } = await requireUser());
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const token = await getValidToken(userId);
  if (!token) {
    return NextResponse.json(
      {
        error: "Not connected to Schwab",
        authUrl: getAuthorizationUrl(userId),
      },
      { status: 401 }
    );
  }

  try {
    const result = await syncSchwabToSupabase(userId);
    return NextResponse.json({ success: true, ...result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await getSupabaseAdmin().from("sync_logs").insert({
      user_id: userId,
      source: "schwab",
      status: "error",
      message,
      metadata: { fetchedAt: new Date().toISOString() },
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

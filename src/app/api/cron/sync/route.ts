/**
 * GET /api/cron/sync — scheduled daily sync (Vercel Cron, see vercel.json).
 *
 * Keeps the data fresh without anyone clicking "Sync":
 *   1. Schwab   — pulls accounts + positions if the stored OAuth token is still
 *                 valid; otherwise writes a `needs_reauth` sync log so the
 *                 read-only `claude_ro.data_freshness` view shows it.
 *   2. Coinbase — pulls balances with the CDP key (read-only use).
 *   3. Re-prices CSV-imported positions (Robinhood, Fidelity) from Finnhub.
 *   4. Recomputes the analysis cache and writes one snapshot (net-worth history).
 *
 * Also called on demand by `claude_ro.refresh_now()` in Postgres (pg_net), so
 * Claude can pull live broker data right before answering.
 *
 * The daily database activity also stops Supabase's free tier from pausing the
 * project for inactivity, which is what took the app offline in 2026.
 *
 * Auth: Vercel sends `Authorization: Bearer $CRON_SECRET`. Anything else gets 401.
 * Users: `OWNER_USER_IDS` (comma-separated auth.users ids). Never synced for
 * anyone not listed. The response carries counts and statuses only, never
 * balances, tokens or account numbers.
 */
import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import * as schwab from "@/lib/schwab-api";
import * as coinbase from "@/lib/coinbase-api";
import { syncSchwabToSupabase } from "@/lib/schwab-sync";
import { syncCoinbaseToSupabase } from "@/lib/coinbase-sync";
import { refreshCsvHoldingPrices } from "@/lib/price-refresh";
import * as finnhub from "@/lib/finnhub-api";
import {
  createSnapshot,
  loadFinancialData,
  loadInvestmentPreferences,
  loadUserProfile,
  saveAnalysis,
  writeSyncLog,
} from "@/lib/data-store";
import { runAnalysis } from "@/lib/analysis";
import { resolveClassifications } from "@/lib/classification";
import { optionalEnv } from "@/lib/env";
import { ownerUserIds } from "@/lib/owner";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type StepStatus = "ok" | "skipped" | "needs_reauth" | "error";

interface UserSyncReport {
  schwab: StepStatus;
  coinbase: StepStatus;
  prices: StepStatus;
  snapshot: StepStatus;
  errors: string[];
}

function authorized(request: NextRequest): boolean {
  const secret = optionalEnv("CRON_SECRET");
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(header);
  return (
    actual.length === expected.length && timingSafeEqual(actual, expected)
  );
}

async function syncUser(userId: string): Promise<UserSyncReport> {
  const report: UserSyncReport = {
    schwab: "skipped",
    coinbase: "skipped",
    prices: "skipped",
    snapshot: "skipped",
    errors: [],
  };

  // ---------- Schwab ----------
  if (schwab.isConfigured()) {
    try {
      const token = await schwab.getValidToken(userId);
      if (token) {
        await syncSchwabToSupabase(userId);
        report.schwab = "ok";
      } else {
        report.schwab = "needs_reauth";
        await writeSyncLog(userId, {
          source: "schwab",
          status: "needs_reauth",
          message:
            "Scheduled sync skipped: Schwab sign-in expired. Reconnect on the Connections page.",
        });
      }
    } catch (err) {
      report.schwab = "error";
      const message = err instanceof Error ? err.message : "Unknown error";
      report.errors.push(`schwab: ${message}`);
      await writeSyncLog(userId, {
        source: "schwab",
        status: "error",
        message: `Scheduled sync failed: ${message}`,
      }).catch(() => undefined);
    }
  }

  // ---------- Coinbase ----------
  if (coinbase.isConfigured()) {
    try {
      await syncCoinbaseToSupabase(userId); // writes its own sync_logs row
      report.coinbase = "ok";
    } catch (err) {
      report.coinbase = "error";
      report.errors.push(
        `coinbase: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    }
  }

  // ---------- Live prices for CSV-imported positions (Robinhood etc.) ----------
  if (finnhub.isConfigured()) {
    try {
      const { updated } = await refreshCsvHoldingPrices(userId);
      report.prices = "ok";
      await writeSyncLog(userId, {
        source: "prices",
        status: "success",
        message: `Re-priced ${updated} imported positions`,
      });
    } catch (err) {
      report.prices = "error";
      report.errors.push(
        `prices: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    }
  }

  // ---------- Analysis + snapshot ----------
  try {
    const [data, profile, preferences] = await Promise.all([
      loadFinancialData(userId),
      loadUserProfile(userId),
      loadInvestmentPreferences(userId),
    ]);
    if (data.accounts.length > 0) {
      const classificationMap = await resolveClassifications(
        data.holdings.map((h) => h.symbol),
        userId
      );
      const fresh = runAnalysis(data, profile, classificationMap, {
        emergencyFundTarget: preferences.emergencyFundTarget,
        emergencyFundAccountIds: preferences.emergencyFundAccountIds,
        emergencyFundCurrentOverride: preferences.emergencyFundCurrentOverride,
      });
      await Promise.all([
        saveAnalysis(userId, fresh),
        createSnapshot(userId, fresh),
      ]);
      report.snapshot = "ok";
    }
  } catch (err) {
    report.snapshot = "error";
    report.errors.push(
      `snapshot: ${err instanceof Error ? err.message : "Unknown error"}`
    );
  }

  return report;
}

export async function POST(request: NextRequest) {
  return GET(request);
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const userIds = ownerUserIds();
  if (userIds.length === 0) {
    return NextResponse.json(
      { error: "OWNER_USER_IDS is not set" },
      { status: 500 }
    );
  }

  const startedAt = new Date().toISOString();
  const reports: UserSyncReport[] = [];
  for (const userId of userIds) {
    reports.push(await syncUser(userId));
  }

  const ok = reports.every((r) => r.errors.length === 0);
  return NextResponse.json(
    { ok, startedAt, finishedAt: new Date().toISOString(), users: reports },
    { status: ok ? 200 : 207 }
  );
}

#!/usr/bin/env tsx
/**
 * Gathers a deterministic snapshot for the /invest slash command.
 * Pulls prefs + holdings from Supabase, fetches live prices from Finnhub,
 * computes metrics, prints JSON to stdout. Claude consumes this and produces
 * the actionable brief.
 *
 * Usage:
 *   npm run invest:brief
 *   npm run invest:brief -- --human   # pretty-print instead of JSON
 */

import fs from "fs/promises";
import path from "path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { UserProfile } from "../src/lib/types";

const FINNHUB_BASE = "https://finnhub.io/api/v1";

interface InvestmentPreferences {
  roth_ira_annual_target: number | null;
  roth_ira_ytd_contributed: number;
  roth_401k_percent: number | null;
  emergency_fund_target: number | null;
  cash_floor_brokerage: number;
  single_position_cap_percent: number | null;
  core_allocation_min_percent: number | null;
  core_tickers: string[];
  sector_caps: Record<string, number>;
  excluded_tickers: string[];
  allow_sell_recommendations: boolean;
  allow_tax_loss_harvesting: boolean;
  rebalance_drift_threshold_percent: number;
  notes: string | null;
  updated_at: string;
}

interface HoldingRow {
  id: string;
  account_id: string;
  platform: string;
  symbol: string;
  name: string;
  quantity: number;
  cost_basis: number;
  current_price: number;
  current_value: number;
  gain_loss: number;
  gain_loss_percent: number;
  asset_class: string;
  sector: string;
  last_updated: string;
}

interface AccountRow {
  id: string;
  platform: string;
  account_type: string;
  name: string;
  balance: number;
  currency: string;
  last_updated: string;
}

interface Quote {
  current: number;
  previousClose: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  open: number;
}

interface PositionBrief {
  accountId: string;
  accountName: string;
  accountType: string;
  symbol: string;
  name: string;
  quantity: number;
  costBasis: number;
  avgCost: number;
  lastStoredPrice: number;
  livePrice: number | null;
  liveValue: number | null;
  storedValue: number;
  todayChangePercent: number | null;
  todayChangeDollars: number | null;
  gainLossLive: number | null;
  gainLossPercentLive: number | null;
  sector: string;
  assetClass: string;
  percentOfPortfolio: number | null;
  inCore: boolean;
}

function num(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return parseFloat(v);
  return 0;
}

function getSupabase(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function loadEnv(): Promise<void> {
  try {
    const raw = await fs.readFile(
      path.join(process.cwd(), ".env.local"),
      "utf-8"
    );
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 0) continue;
      const k = trimmed.slice(0, eq).trim();
      const v = trimmed.slice(eq + 1).trim();
      if (!(k in process.env)) process.env[k] = v;
    }
  } catch {
    // .env.local optional — fall through to process.env
  }
}

async function fetchQuote(
  symbol: string,
  token: string
): Promise<Quote | null> {
  try {
    const url = `${FINNHUB_BASE}/quote?symbol=${encodeURIComponent(
      symbol
    )}&token=${token}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const j = (await res.json()) as {
      c: number;
      d: number;
      dp: number;
      h: number;
      l: number;
      o: number;
      pc: number;
    };
    if (!j.c) return null;
    return {
      current: j.c,
      previousClose: j.pc,
      change: j.d,
      changePercent: j.dp,
      high: j.h,
      low: j.l,
      open: j.o,
    };
  } catch {
    return null;
  }
}

async function fetchQuotesBatch(
  symbols: string[],
  token: string
): Promise<Map<string, Quote>> {
  const out = new Map<string, Quote>();
  // Finnhub free tier is 60 req/min. Batch sequentially with tiny pauses.
  for (const sym of symbols) {
    const q = await fetchQuote(sym, token);
    if (q) out.set(sym, q);
    await new Promise((r) => setTimeout(r, 120)); // ~8 req/sec, well under limit
  }
  return out;
}

async function main(): Promise<void> {
  await loadEnv();
  const humanMode = process.argv.includes("--human");
  const userId = process.env.TARGET_USER_ID;
  if (!userId) {
    throw new Error(
      "Set TARGET_USER_ID (your auth user_id) in the environment to run this script."
    );
  }
  const supabase = getSupabase();

  // ---------------- Load preferences ----------------
  const { data: prefRow, error: prefErr } = await supabase
    .from("investment_preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (prefErr) throw prefErr;
  if (!prefRow) {
    throw new Error(
      "No investment_preferences row. Seed the singleton (id=1) first."
    );
  }
  const prefs: InvestmentPreferences = {
    ...prefRow,
    roth_ira_annual_target: prefRow.roth_ira_annual_target
      ? num(prefRow.roth_ira_annual_target)
      : null,
    roth_ira_ytd_contributed: num(prefRow.roth_ira_ytd_contributed),
    roth_401k_percent: prefRow.roth_401k_percent
      ? num(prefRow.roth_401k_percent)
      : null,
    emergency_fund_target: prefRow.emergency_fund_target
      ? num(prefRow.emergency_fund_target)
      : null,
    cash_floor_brokerage: num(prefRow.cash_floor_brokerage),
    single_position_cap_percent: prefRow.single_position_cap_percent
      ? num(prefRow.single_position_cap_percent)
      : null,
    core_allocation_min_percent: prefRow.core_allocation_min_percent
      ? num(prefRow.core_allocation_min_percent)
      : null,
    rebalance_drift_threshold_percent: num(
      prefRow.rebalance_drift_threshold_percent
    ),
  };

  // ---------------- Load profile + accounts + holdings ----------------
  const profileRaw = await fs.readFile(
    path.join(process.cwd(), "config", "user-profile.json"),
    "utf-8"
  );
  const profile = JSON.parse(profileRaw) as UserProfile;

  const [{ data: accountRows, error: aErr }, { data: holdingRows, error: hErr }] =
    await Promise.all([
      supabase.from("accounts").select("*").eq("user_id", userId),
      supabase.from("holdings").select("*").eq("user_id", userId),
    ]);
  if (aErr) throw aErr;
  if (hErr) throw hErr;

  const accounts: AccountRow[] = (accountRows ?? []).map((r) => ({
    ...r,
    balance: num(r.balance),
  }));
  const holdings: HoldingRow[] = (holdingRows ?? []).map((r) => ({
    ...r,
    quantity: num(r.quantity),
    cost_basis: num(r.cost_basis),
    current_price: num(r.current_price),
    current_value: num(r.current_value),
    gain_loss: num(r.gain_loss),
    gain_loss_percent: num(r.gain_loss_percent),
  }));

  const accountById = new Map(accounts.map((a) => [a.id, a]));

  // ---------------- Fetch live prices ----------------
  const finnhubToken = process.env.FINNHUB_API_KEY;
  const equitySymbols = Array.from(
    new Set(
      holdings
        .filter(
          (h) =>
            h.asset_class === "us_equity" || h.asset_class === "intl_equity"
        )
        .map((h) => h.symbol.toUpperCase())
    )
  );

  let quotes = new Map<string, Quote>();
  let priceSource: "finnhub" | "stored" = "stored";
  if (finnhubToken) {
    quotes = await fetchQuotesBatch(equitySymbols, finnhubToken);
    priceSource = quotes.size > 0 ? "finnhub" : "stored";
  }

  // ---------------- Build per-position briefs ----------------
  const coreSet = new Set(prefs.core_tickers.map((t) => t.toUpperCase()));

  const positions: PositionBrief[] = holdings.map((h) => {
    const acct = accountById.get(h.account_id);
    // Never apply a Finnhub stock quote to non-equity asset classes. Symbols
    // like "CASH", "BTC", "ETH" will match real tickers (Pathward Financial,
    // Bit Digital, etc.) and produce garbage values. Cash and crypto carry
    // their own current_price from the platform sync.
    const isEquity =
      h.asset_class === "us_equity" || h.asset_class === "intl_equity";
    const q = !isEquity ? undefined : quotes.get(h.symbol.toUpperCase());
    const livePrice = q?.current ?? null;
    const liveValue = livePrice !== null ? livePrice * h.quantity : null;
    const todayChangeDollars =
      q && h.asset_class !== "cash" ? q.change * h.quantity : null;
    const gainLossLive =
      liveValue !== null ? liveValue - h.cost_basis : null;
    const gainLossPercentLive =
      gainLossLive !== null && h.cost_basis > 0
        ? (gainLossLive / h.cost_basis) * 100
        : null;

    return {
      accountId: h.account_id,
      accountName: acct?.name ?? "unknown",
      accountType: acct?.account_type ?? "unknown",
      symbol: h.symbol,
      name: h.name,
      quantity: h.quantity,
      costBasis: h.cost_basis,
      avgCost: h.quantity > 0 ? h.cost_basis / h.quantity : 0,
      lastStoredPrice: h.current_price,
      livePrice,
      liveValue,
      storedValue: h.current_value,
      todayChangePercent: q?.changePercent ?? null,
      todayChangeDollars,
      gainLossLive,
      gainLossPercentLive,
      sector: h.sector,
      assetClass: h.asset_class,
      percentOfPortfolio: null, // filled below once totals known
      inCore: coreSet.has(h.symbol.toUpperCase()),
    };
  });

  // ---------------- Portfolio totals ----------------
  const bestValue = (p: PositionBrief): number => p.liveValue ?? p.storedValue;

  const portfolioValue = positions.reduce((s, p) => s + bestValue(p), 0);
  const cashPositions = positions.filter((p) => p.assetClass === "cash");
  const equityPositions = positions.filter((p) => p.assetClass !== "cash");
  const cashValue = cashPositions.reduce((s, p) => s + bestValue(p), 0);
  const equityValue = equityPositions.reduce((s, p) => s + bestValue(p), 0);

  for (const p of positions) {
    p.percentOfPortfolio =
      portfolioValue > 0 ? (bestValue(p) / portfolioValue) * 100 : 0;
  }

  const todayMoveDollars = positions.reduce(
    (s, p) => s + (p.todayChangeDollars ?? 0),
    0
  );

  // ---------------- Per-account view ----------------
  const accountViews = accounts.map((a) => {
    const posInAcct = positions.filter((p) => p.accountId === a.id);
    const value = posInAcct.reduce((s, p) => s + bestValue(p), 0);
    const cashInAcct = posInAcct
      .filter((p) => p.assetClass === "cash")
      .reduce((s, p) => s + bestValue(p), 0);
    return {
      id: a.id,
      name: a.name,
      accountType: a.account_type,
      storedBalance: a.balance,
      liveValue: value,
      cashHolding: cashInAcct,
      positionCount: posInAcct.filter((p) => p.assetClass !== "cash").length,
    };
  });

  // ---------------- Allocation stats ----------------
  const coreValue = positions
    .filter((p) => p.inCore)
    .reduce((s, p) => s + bestValue(p), 0);
  const coreAllocationPct =
    portfolioValue > 0 ? (coreValue / portfolioValue) * 100 : 0;

  const sectorMap = new Map<string, number>();
  for (const p of equityPositions) {
    sectorMap.set(p.sector, (sectorMap.get(p.sector) ?? 0) + bestValue(p));
  }
  const sectorAllocation = Array.from(sectorMap.entries())
    .map(([sector, value]) => ({
      sector,
      value,
      percent: portfolioValue > 0 ? (value / portfolioValue) * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value);

  // ---------------- Top positions (concentration) ----------------
  const topPositions = [...positions]
    .sort((a, b) => bestValue(b) - bestValue(a))
    .slice(0, 10)
    .map((p) => ({
      symbol: p.symbol,
      value: bestValue(p),
      percent: p.percentOfPortfolio,
      account: p.accountName,
    }));

  // ---------------- Flags ----------------
  const flags: { kind: string; symbol?: string; detail: string }[] = [];

  // Core drift
  if (
    prefs.core_allocation_min_percent !== null &&
    coreAllocationPct < prefs.core_allocation_min_percent
  ) {
    flags.push({
      kind: "core_below_min",
      detail: `Core allocation ${coreAllocationPct.toFixed(1)}% is below min ${prefs.core_allocation_min_percent}%. Deficit: $${(
        ((prefs.core_allocation_min_percent - coreAllocationPct) / 100) *
        portfolioValue
      ).toFixed(0)}`,
    });
  }

  // Single-position cap
  if (prefs.single_position_cap_percent !== null) {
    for (const p of positions) {
      if (
        p.assetClass !== "cash" &&
        (p.percentOfPortfolio ?? 0) > prefs.single_position_cap_percent
      ) {
        flags.push({
          kind: "position_over_cap",
          symbol: p.symbol,
          detail: `${p.symbol} is ${p.percentOfPortfolio?.toFixed(
            1
          )}% of portfolio (cap ${prefs.single_position_cap_percent}%)`,
        });
      }
    }
  }

  // Excluded tickers still held
  for (const p of positions) {
    if (
      prefs.excluded_tickers
        .map((t) => t.toUpperCase())
        .includes(p.symbol.toUpperCase())
    ) {
      flags.push({
        kind: "holds_excluded",
        symbol: p.symbol,
        detail: `Holding excluded ticker ${p.symbol}`,
      });
    }
  }

  // Tax-loss harvest candidates (losses > $100 in taxable only)
  if (prefs.allow_tax_loss_harvesting) {
    for (const p of positions) {
      if (
        p.accountType === "brokerage" &&
        p.gainLossLive !== null &&
        p.gainLossLive < -100
      ) {
        flags.push({
          kind: "tlh_candidate",
          symbol: p.symbol,
          detail: `${p.symbol} unrealized loss $${p.gainLossLive.toFixed(
            0
          )} (${p.gainLossPercentLive?.toFixed(1)}%) in taxable — possible TLH`,
        });
      }
    }
  }

  // Cash excess
  const brokerage = accountViews.find((a) => a.accountType === "brokerage");
  if (brokerage) {
    const excessCash = brokerage.cashHolding - prefs.cash_floor_brokerage;
    if (excessCash > 500) {
      flags.push({
        kind: "cash_deployable_brokerage",
        detail: `Brokerage has $${excessCash.toFixed(
          0
        )} above cash floor — deployable`,
      });
    }
  }
  const roth = accountViews.find((a) => a.accountType === "roth_ira");
  if (roth && roth.cashHolding > 100) {
    flags.push({
      kind: "cash_deployable_roth",
      detail: `Roth IRA has $${roth.cashHolding.toFixed(0)} uninvested`,
    });
  }

  // Roth IRA remaining room
  const rothRoomLeft =
    (prefs.roth_ira_annual_target ?? 0) - prefs.roth_ira_ytd_contributed;
  if (rothRoomLeft > 0) {
    flags.push({
      kind: "roth_room",
      detail: `Roth IRA has $${rothRoomLeft.toFixed(
        0
      )} of contribution room remaining for the year`,
    });
  }

  // ---------------- Output ----------------
  const now = new Date();
  const marketStatus = inferMarketStatus(now);

  const brief = {
    generatedAt: now.toISOString(),
    generatedAtLocal: now.toLocaleString("en-US", { timeZone: "America/New_York" }) + " ET",
    marketStatus,
    priceSource,
    preferences: prefs,
    profileSummary: {
      name: profile.name,
      age: profile.age,
      annualIncome: profile.annualIncome,
      semiMonthlyNet: (profile as UserProfile & { payrollDetails?: { netPayPerPaycheck?: number; ytd2026?: { roth401kContributions?: number } } }).payrollDetails?.netPayPerPaycheck,
      roth401kYtd: (profile as UserProfile & { payrollDetails?: { ytd2026?: { roth401kContributions?: number } } }).payrollDetails?.ytd2026?.roth401kContributions,
      fixedMonthlyExpenses: profile.fixedExpenses.reduce((s, e) => {
        const mo =
          e.frequency === "monthly"
            ? e.amount
            : e.frequency === "annual"
            ? e.amount / 12
            : e.amount / 3;
        return s + mo;
      }, 0),
      sectorBias: profile.investmentPreferences.sectorBias,
      riskTolerance: profile.investmentPreferences.riskTolerance,
    },
    portfolio: {
      totalValue: portfolioValue,
      equityValue,
      cashValue,
      todayMoveDollars,
      todayMovePercent:
        portfolioValue > 0 ? (todayMoveDollars / portfolioValue) * 100 : 0,
      coreAllocationPercent: coreAllocationPct,
      coreValue,
      positionCount: equityPositions.length,
    },
    rothIra: {
      annualTarget: prefs.roth_ira_annual_target,
      ytdContributed: prefs.roth_ira_ytd_contributed,
      remainingRoom: Math.max(0, rothRoomLeft),
    },
    accounts: accountViews,
    topPositions,
    sectorAllocation,
    positions,
    flags,
  };

  const outDir = path.join(process.cwd(), "data", "normalized");
  await fs.mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, "invest-brief.json");
  await fs.writeFile(outPath, JSON.stringify(brief, null, 2));

  if (humanMode) {
    printHuman(brief);
    console.log(`\nFull JSON written to ${path.relative(process.cwd(), outPath)}`);
  } else {
    console.log(JSON.stringify(brief, null, 2));
  }
}

function inferMarketStatus(now: Date): string {
  const et = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const day = et.getDay();
  const mins = et.getHours() * 60 + et.getMinutes();
  if (day === 0 || day === 6) return "closed_weekend";
  if (mins < 9 * 60 + 30) return "pre_market";
  if (mins >= 16 * 60) return "after_hours";
  return "open";
}

function printHuman(b: any): void {
  console.log(`INVEST BRIEF — ${b.generatedAtLocal} (market: ${b.marketStatus}, prices: ${b.priceSource})`);
  console.log(`Portfolio: $${b.portfolio.totalValue.toFixed(0)}  |  Today: ${b.portfolio.todayMoveDollars >= 0 ? "+" : ""}$${b.portfolio.todayMoveDollars.toFixed(0)} (${b.portfolio.todayMovePercent.toFixed(2)}%)`);
  console.log(`Core (${b.preferences.core_tickers.join(",")}): ${b.portfolio.coreAllocationPercent.toFixed(1)}% (min ${b.preferences.core_allocation_min_percent}%)`);
  console.log(`Cash: $${b.portfolio.cashValue.toFixed(0)}  |  Roth room left: $${b.rothIra.remainingRoom.toFixed(0)}`);
  console.log(`\nACCOUNTS`);
  for (const a of b.accounts) {
    console.log(`  ${a.name} (${a.accountType}): $${a.liveValue.toFixed(0)}  cash $${a.cashHolding.toFixed(0)}  positions ${a.positionCount}`);
  }
  console.log(`\nTOP 10 POSITIONS`);
  for (const p of b.topPositions) {
    console.log(`  ${p.symbol.padEnd(6)} $${p.value.toFixed(0).padStart(8)} ${(p.percent ?? 0).toFixed(1).padStart(5)}%  ${p.account}`);
  }
  console.log(`\nSECTOR`);
  for (const s of b.sectorAllocation) {
    console.log(`  ${s.sector.padEnd(22)} $${s.value.toFixed(0).padStart(8)} ${s.percent.toFixed(1).padStart(5)}%`);
  }
  console.log(`\nFLAGS`);
  for (const f of b.flags) console.log(`  [${f.kind}] ${f.detail}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

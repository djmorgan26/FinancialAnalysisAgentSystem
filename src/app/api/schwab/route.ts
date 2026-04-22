/**
 * GET  /api/schwab — Connection status + auth URL
 * POST /api/schwab — Trigger data sync from Schwab (writes to Supabase)
 */
import { NextResponse } from "next/server";
import {
  isConfigured,
  getConnectionStatus,
  getAuthorizationUrl,
  fetchAllSchwabData,
  getValidToken,
  type SchwabAccountDetail,
  type SchwabPosition,
} from "@/lib/schwab-api";
import { deterministicId, todayISO } from "@/lib/importers/utils";
import { getSupabase } from "@/lib/supabase";
import type {
  AccountType,
  AssetClass,
  Sector,
} from "@/lib/types";

export async function GET() {
  if (!isConfigured()) {
    return NextResponse.json({
      configured: false,
      connected: false,
      message:
        "Schwab API not configured. Add SCHWAB_APP_KEY and SCHWAB_APP_SECRET to .env.local",
      setupGuide: {
        step1: "Go to https://developer.schwab.com and create an account",
        step2: 'Create an app → select "Accounts and Trading Production"',
        step3:
          "Set callback URL to your deployed URL + /api/schwab/callback (or https://127.0.0.1:8182 for local)",
        step4: "Copy App Key and Secret to .env.local in project root",
        envTemplate:
          "SCHWAB_APP_KEY=your_app_key\nSCHWAB_APP_SECRET=your_app_secret",
      },
    });
  }

  const status = await getConnectionStatus();
  return NextResponse.json({
    configured: true,
    ...status,
    authUrl: status.needsReauth ? getAuthorizationUrl() : null,
  });
}

export async function POST() {
  if (!isConfigured()) {
    return NextResponse.json(
      { error: "Schwab API not configured" },
      { status: 400 }
    );
  }

  const token = await getValidToken();
  if (!token) {
    return NextResponse.json(
      {
        error: "Not connected to Schwab",
        authUrl: getAuthorizationUrl(),
      },
      { status: 401 }
    );
  }

  const supabase = getSupabase();
  const fetchedAt = new Date().toISOString();

  try {
    const data = await fetchAllSchwabData();

    const { accountRows, holdingRows, accountDiagnostics } =
      normalize(data.accounts);

    // ---- Upsert accounts ----
    if (accountRows.length > 0) {
      const { error } = await supabase
        .from("accounts")
        .upsert(accountRows, { onConflict: "id" });
      if (error) throw new Error(`accounts upsert: ${error.message}`);
    }

    // ---- Replace holdings for these Schwab accounts (stale-removal) ----
    const accountIds = accountRows.map((a) => a.id);
    if (accountIds.length > 0) {
      const { error: delErr } = await supabase
        .from("holdings")
        .delete()
        .eq("platform", "schwab")
        .in("account_id", accountIds);
      if (delErr) throw new Error(`holdings delete: ${delErr.message}`);
    }

    if (holdingRows.length > 0) {
      const { error } = await supabase.from("holdings").insert(holdingRows);
      if (error) throw new Error(`holdings insert: ${error.message}`);
    }

    // ---- Sync log ----
    await supabase.from("sync_logs").insert({
      source: "schwab",
      status: "success",
      message: `Synced ${accountRows.length} accounts, ${holdingRows.length} positions`,
      metadata: {
        accountCount: accountRows.length,
        positionCount: holdingRows.length,
        fetchedAt,
        accounts: accountDiagnostics,
      },
    });

    return NextResponse.json({
      success: true,
      accountCount: accountRows.length,
      positionCount: holdingRows.length,
      fetchedAt,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await supabase.from("sync_logs").insert({
      source: "schwab",
      status: "error",
      message,
      metadata: { fetchedAt },
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

interface AccountRow {
  id: string;
  platform: "schwab";
  account_type: AccountType;
  name: string;
  balance: number;
  currency: string;
  last_updated: string;
}

interface HoldingRow {
  id: string;
  account_id: string;
  platform: "schwab";
  symbol: string;
  name: string;
  quantity: number;
  cost_basis: number;
  current_price: number;
  current_value: number;
  gain_loss: number;
  gain_loss_percent: number;
  asset_class: AssetClass;
  sector: Sector;
  last_updated: string;
}

type AccountDiagnostic = {
  accountNumber: string;
  schwabType: string;
  currentBalances: SchwabAccountDetail["securitiesAccount"]["currentBalances"];
  resolvedAccountType: AccountType;
  resolvedName: string;
};

function normalize(accounts: SchwabAccountDetail[]): {
  accountRows: AccountRow[];
  holdingRows: HoldingRow[];
  accountDiagnostics: AccountDiagnostic[];
} {
  const accountRows: AccountRow[] = [];
  const holdingRows: HoldingRow[] = [];
  const accountDiagnostics: AccountDiagnostic[] = [];
  const now = todayISO();

  for (const acct of accounts) {
    const sa = acct.securitiesAccount;
    const accountNumber = sa.accountNumber ?? "";
    const nicknames = nicknamesFromEnv();
    const override = accountNumber
      ? nicknames[accountNumber] ??
        nicknames[accountNumber.slice(-4)] ??
        null
      : null;

    const accountType = override?.accountType ?? mapAccountType(sa.type);
    const label =
      override?.name ??
      defaultAccountName(accountType, accountNumber);

    const idSeed = accountNumber
      ? `schwab-account-${accountNumber}`
      : `schwab-account-${sa.type}`;
    const accountId = deterministicId(idSeed);

    // Authoritative balance from Schwab's liquidationValue (matches what
    // the Schwab app and website display). Falls back to longMarketValue +
    // totalCash if missing.
    const balance =
      sa.currentBalances?.liquidationValue ??
      (sa.currentBalances?.longMarketValue ?? 0) +
        (sa.currentBalances?.totalCash ?? 0);

    accountRows.push({
      id: accountId,
      platform: "schwab",
      account_type: accountType,
      name: label,
      balance: round(balance),
      currency: "USD",
      last_updated: now,
    });

    accountDiagnostics.push({
      accountNumber: accountNumber
        ? `···${accountNumber.slice(-4)}`
        : "(unknown)",
      schwabType: sa.type,
      currentBalances: sa.currentBalances,
      resolvedAccountType: accountType,
      resolvedName: label,
    });

    for (const pos of sa.positions ?? []) {
      const row = positionToHoldingRow(pos, accountId, accountNumber || label, now);
      if (row) holdingRows.push(row);
    }

    const mmf = sa.currentBalances?.moneyMarketFund || 0;
    const cash = sa.currentBalances?.totalCash || 0;
    const cashTotal = mmf || cash;
    if (cashTotal > 0) {
      holdingRows.push({
        id: deterministicId(`schwab-holding-${accountNumber || label}-SWVXX`),
        account_id: accountId,
        platform: "schwab",
        symbol: "SWVXX",
        name: "SCHWAB PRIME ADVANTAGE MONEY FUND",
        quantity: cashTotal,
        cost_basis: cashTotal,
        current_price: 1,
        current_value: cashTotal,
        gain_loss: 0,
        gain_loss_percent: 0,
        asset_class: "cash",
        sector: "other",
        last_updated: now,
      });
    }
  }

  return { accountRows, holdingRows, accountDiagnostics };
}

/**
 * Parse SCHWAB_ACCOUNT_NICKNAMES env var into a lookup.
 * Format: `ACCOUNT_NUMBER:Display Name:account_type, ...`
 * Key may be full account number or last-4 digits.
 * `account_type` is optional; must match the AccountType union if provided.
 *
 * Example:
 *   SCHWAB_ACCOUNT_NICKNAMES="9886:Individual Brokerage:brokerage,1949:Roth Contributory IRA:roth_ira"
 */
function nicknamesFromEnv(): Record<
  string,
  { name: string; accountType?: AccountType }
> {
  const raw = process.env.SCHWAB_ACCOUNT_NICKNAMES;
  if (!raw) return {};
  const out: Record<string, { name: string; accountType?: AccountType }> = {};
  for (const entry of raw.split(",")) {
    const parts = entry.split(":").map((s) => s.trim());
    if (parts.length < 2 || !parts[0] || !parts[1]) continue;
    const [key, name, typeStr] = parts;
    out[key] = {
      name,
      accountType: typeStr
        ? (typeStr as AccountType)
        : undefined,
    };
  }
  return out;
}

function defaultAccountName(
  accountType: AccountType,
  accountNumber: string
): string {
  const base = (() => {
    switch (accountType) {
      case "roth_ira":
        return "Roth IRA";
      case "traditional_ira":
        return "Traditional IRA";
      case "roth_401k":
        return "Roth 401k";
      case "traditional_401k":
        return "Traditional 401k";
      case "brokerage":
        return "Brokerage";
      case "checking":
        return "Checking";
      case "savings":
        return "Savings";
      default:
        return "Account";
    }
  })();
  return accountNumber ? `${base} ···${accountNumber.slice(-4)}` : base;
}

function positionToHoldingRow(
  pos: SchwabPosition,
  accountId: string,
  accountIdentifier: string,
  lastUpdated: string
): HoldingRow | null {
  const symbol = pos.instrument?.symbol?.trim();
  if (!symbol) return null;

  const qty = pos.longQuantity || 0;
  const marketValue = pos.marketValue || 0;
  const avgPrice = pos.averagePrice || 0;
  const costBasis = avgPrice * qty;
  const currentPrice = qty > 0 ? marketValue / qty : 0;
  const gainLoss = marketValue - costBasis;
  const gainLossPct = costBasis > 0 ? (gainLoss / costBasis) * 100 : 0;

  const description = pos.instrument?.description ?? "";

  return {
    id: deterministicId(`schwab-holding-${accountIdentifier}-${symbol}`),
    account_id: accountId,
    platform: "schwab",
    symbol,
    name: description || symbol,
    quantity: qty,
    cost_basis: round(costBasis),
    current_price: round(currentPrice),
    current_value: round(marketValue),
    gain_loss: round(gainLoss),
    gain_loss_percent: round(gainLossPct),
    asset_class: inferAssetClass(symbol, description),
    sector: inferSector(symbol, description),
    last_updated: lastUpdated,
  };
}

const round = (n: number) => Math.round(n * 100) / 100;

function accountLabel(schwabType: string): string {
  switch (schwabType) {
    case "INDIVIDUAL":
      return "Individual";
    case "ROTH_IRA":
    case "IRA":
      return "Roth IRA";
    case "TRADITIONAL_IRA":
      return "Traditional IRA";
    default:
      return schwabType;
  }
}

function mapAccountType(schwabType: string): AccountType {
  switch (schwabType) {
    case "INDIVIDUAL":
      return "brokerage";
    case "ROTH_IRA":
      return "roth_ira";
    case "TRADITIONAL_IRA":
    case "IRA":
      return "traditional_ira";
    case "ROTH_401K":
      return "roth_401k";
    case "TRADITIONAL_401K":
    case "401K":
      return "traditional_401k";
    default:
      return "brokerage";
  }
}

function inferAssetClass(symbol: string, description: string): AssetClass {
  const s = symbol.toUpperCase();
  const d = description.toLowerCase();
  if (
    s === "SWVXX" ||
    s === "SNVXX" ||
    s === "SNSXX" ||
    d.includes("money market") ||
    d.includes("cash") ||
    s === "CASH"
  )
    return "cash";
  if (
    d.includes("bond") ||
    d.includes("fixed income") ||
    d.includes("treasury") ||
    d.includes("aggregate") ||
    s === "SCHZ" ||
    s === "AGG" ||
    s === "BND"
  )
    return "fixed_income";
  if (
    d.includes("international") ||
    d.includes("intl") ||
    d.includes("foreign") ||
    d.includes("emerging") ||
    s === "SCHF" ||
    s === "SCHE" ||
    s === "VXUS" ||
    s === "SWISX"
  )
    return "intl_equity";
  if (d.includes("real estate") || d.includes("reit") || s === "SCHH")
    return "real_estate";
  if (d.includes("commodity") || d.includes("gold") || s === "GLD")
    return "commodity";
  return "us_equity";
}

function inferSector(symbol: string, description: string): Sector {
  const s = symbol.toUpperCase();
  const d = description.toLowerCase();

  if (
    d.includes("500") ||
    d.includes("total") ||
    d.includes("broad") ||
    d.includes("index")
  )
    return "broad_market";
  if (d.includes("technology") || s === "SCHG" || s === "QQQ")
    return "technology";
  if (d.includes("semiconductor") || s === "SOXX" || s === "SMH")
    return "semiconductors";
  if (d.includes("health") || s === "XLV") return "healthcare";
  if (d.includes("financ") || s === "XLF") return "financials";
  if (d.includes("energy") || s === "XLE") return "energy";
  if (d.includes("real estate") || d.includes("reit")) return "real_estate";
  if (d.includes("biotech")) return "biotech";

  const techStocks = [
    "AAPL",
    "MSFT",
    "GOOGL",
    "GOOG",
    "META",
    "AMZN",
    "NVDA",
    "TSLA",
    "NFLX",
    "CRM",
    "ORCL",
    "ADBE",
    "INTC",
    "AMD",
  ];
  if (techStocks.includes(s)) return "technology";
  const healthStocks = ["JNJ", "UNH", "PFE", "ABBV", "MRK", "LLY"];
  if (healthStocks.includes(s)) return "healthcare";
  const finStocks = ["JPM", "BAC", "WFC", "GS", "MS", "V", "MA"];
  if (finStocks.includes(s)) return "financials";

  return "other";
}

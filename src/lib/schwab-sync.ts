/**
 * Schwab → Supabase sync.
 *
 * Takes the raw accounts-with-positions response from the Schwab Trader API,
 * normalizes it to the app's domain types, and upserts into Supabase.
 * Shared by:
 *   • POST /api/schwab  — dedicated Schwab sync button on Connections
 *   • POST /api/refresh — global "Sync all" button on the dashboard
 */
import { getSupabaseAdmin } from "./supabase/admin";
import { deterministicId, todayISO } from "./importers/utils";
import { fetchAllSchwabData } from "./schwab-api";
import type { SchwabAccountDetail, SchwabPosition } from "./schwab-api";
import { invalidateAnalysis } from "./data-store";
import type { AccountType, AssetClass, Sector } from "./types";

const MMF_SYMBOLS = new Set(["SWVXX", "SWGXX", "SNVXX", "SNSXX", "SNAXX"]);

interface AccountRow {
  id: string;
  user_id: string;
  platform: "schwab";
  account_type: AccountType;
  name: string;
  last4: string | null;
  balance: number;
  currency: string;
  last_updated: string;
}

interface HoldingRow {
  id: string;
  user_id: string;
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

export interface SchwabSyncResult {
  accountCount: number;
  positionCount: number;
  fetchedAt: string;
  accounts: {
    accountNumber: string;
    schwabType: string;
    resolvedAccountType: AccountType;
    resolvedName: string;
  }[];
}

/**
 * Fetch fresh Schwab data and persist it to Supabase for this user.
 * Upserts accounts, replaces holdings wholesale, prunes orphaned accounts,
 * writes a sync_log row, and invalidates analysis cache.
 */
export async function syncSchwabToSupabase(
  userId: string
): Promise<SchwabSyncResult> {
  const supabase = getSupabaseAdmin();
  const fetchedAt = new Date().toISOString();
  const [data, nicknames] = await Promise.all([
    fetchAllSchwabData(userId),
    loadNicknames(userId),
  ]);
  const { accountRows, holdingRows, accountDiagnostics } = normalize(
    userId,
    data.accounts,
    nicknames
  );

  // Delete ALL existing schwab holdings for this user first so closed or
  // renamed accounts don't leak orphans when they drop out of the fresh fetch.
  {
    const { error } = await supabase
      .from("holdings")
      .delete()
      .eq("user_id", userId)
      .eq("platform", "schwab");
    if (error) throw new Error(`holdings delete: ${error.message}`);
  }

  if (accountRows.length > 0) {
    const { error } = await supabase
      .from("accounts")
      .upsert(accountRows, { onConflict: "id" });
    if (error) throw new Error(`accounts upsert: ${error.message}`);
  }

  // Prune any schwab accounts that no longer appear in the fresh fetch.
  {
    const accountIds = accountRows.map((a) => a.id);
    const del = supabase
      .from("accounts")
      .delete()
      .eq("user_id", userId)
      .eq("platform", "schwab");
    const { error } =
      accountIds.length > 0
        ? await del.not("id", "in", `(${accountIds.join(",")})`)
        : await del;
    if (error) throw new Error(`accounts prune: ${error.message}`);
  }

  if (holdingRows.length > 0) {
    const { error } = await supabase.from("holdings").insert(holdingRows);
    if (error) throw new Error(`holdings insert: ${error.message}`);
  }

  await supabase.from("sync_logs").insert({
    user_id: userId,
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

  await invalidateAnalysis(userId);

  return {
    accountCount: accountRows.length,
    positionCount: holdingRows.length,
    fetchedAt,
    accounts: accountDiagnostics,
  };
}

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

type NicknameMap = Record<string, { name: string; accountType?: AccountType }>;

async function loadNicknames(userId: string): Promise<NicknameMap> {
  const base = nicknamesFromEnv();
  const { data } = await getSupabaseAdmin()
    .from("user_profiles")
    .select("schwab_account_nicknames")
    .eq("user_id", userId)
    .maybeSingle();
  const stored = (data?.schwab_account_nicknames as Record<string, string> | null) ?? {};
  return {
    ...base,
    ...Object.fromEntries(Object.entries(stored).map(([k, v]) => [k, { name: v }])),
  };
}

export async function saveSchwabNickname(
  userId: string,
  last4: string,
  name: string
): Promise<void> {
  const supabase = getSupabaseAdmin();

  // Persist in user_profiles so the mapping survives across syncs.
  const { data: existing } = await supabase
    .from("user_profiles")
    .select("schwab_account_nicknames")
    .eq("user_id", userId)
    .maybeSingle();
  const current = (existing?.schwab_account_nicknames as Record<string, string>) ?? {};
  const updated = name ? { ...current, [last4]: name } : Object.fromEntries(
    Object.entries(current).filter(([k]) => k !== last4)
  );
  await supabase
    .from("user_profiles")
    .upsert({ user_id: userId, schwab_account_nicknames: updated }, { onConflict: "user_id" });

  // Apply immediately to the live account row so the UI reflects the rename
  // without waiting for the next Schwab sync.
  if (name) {
    await supabase
      .from("accounts")
      .update({ name })
      .eq("user_id", userId)
      .eq("platform", "schwab")
      .eq("last4", last4);
  }
}

type AccountDiagnostic = SchwabSyncResult["accounts"][number];

function normalize(
  userId: string,
  accounts: SchwabAccountDetail[],
  nicknames: NicknameMap
): {
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
    const override = accountNumber
      ? nicknames[accountNumber] ??
        nicknames[accountNumber.slice(-4)] ??
        null
      : null;

    const accountType = override?.accountType ?? mapAccountType(sa.type);
    const label = override?.name ?? defaultAccountName(accountType, accountNumber);

    const idSeed = accountNumber
      ? `schwab-account-${userId}-${accountNumber}`
      : `schwab-account-${userId}-${sa.type}`;
    const accountId = deterministicId(idSeed);

    const balance =
      sa.currentBalances?.liquidationValue ??
      (sa.currentBalances?.longMarketValue ?? 0) +
        (sa.currentBalances?.totalCash ?? 0);

    const last4 = accountNumber ? accountNumber.slice(-4) : null;

    accountRows.push({
      id: accountId,
      user_id: userId,
      platform: "schwab",
      account_type: accountType,
      name: label,
      last4,
      balance: round(balance),
      currency: "USD",
      last_updated: now,
    });

    accountDiagnostics.push({
      accountNumber: accountNumber
        ? `···${accountNumber.slice(-4)}`
        : "(unknown)",
      schwabType: sa.type,
      resolvedAccountType: accountType,
      resolvedName: label,
    });

    // Real positions from Schwab.
    let hasRealMMFPosition = false;
    for (const pos of sa.positions ?? []) {
      const row = positionToHoldingRow(
        userId,
        pos,
        accountId,
        accountNumber || label,
        now
      );
      if (!row) continue;
      if (MMF_SYMBOLS.has(row.symbol.toUpperCase())) hasRealMMFPosition = true;
      holdingRows.push(row);
    }

    // Record uninvested settled cash (cashBalance) as its own holding row.
    // This is distinct from a real MMF position (SWVXX etc.) — both can
    // coexist. liquidationValue = longMarketValue + MMF positions + cashBalance,
    // so if we only capture positions we under-report cash by cashBalance.
    // Fall back to moneyMarketFund/totalCash ONLY when no real MMF position
    // and no cashBalance is reported (older account shapes).
    const cashBalance = sa.currentBalances?.cashBalance || 0;
    const fallbackCash = hasRealMMFPosition
      ? 0
      : (sa.currentBalances?.moneyMarketFund || 0) ||
        (sa.currentBalances?.totalCash || 0);
    const uninvestedCash = cashBalance > 0 ? cashBalance : fallbackCash;
    if (uninvestedCash > 0) {
      holdingRows.push({
        id: deterministicId(
          `schwab-holding-${userId}-${accountNumber || label}-CASH_SWEEP`
        ),
        user_id: userId,
        account_id: accountId,
        platform: "schwab",
        symbol: "CASH",
        name: "Schwab Uninvested Cash",
        quantity: uninvestedCash,
        cost_basis: uninvestedCash,
        current_price: 1,
        current_value: uninvestedCash,
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
      accountType: typeStr ? (typeStr as AccountType) : undefined,
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
  userId: string,
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
    id: deterministicId(
      `schwab-holding-${userId}-${accountIdentifier}-${symbol}`
    ),
    user_id: userId,
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
    MMF_SYMBOLS.has(s) ||
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

  if (MMF_SYMBOLS.has(s)) return "other";
  if (
    d.includes("500") ||
    d.includes("total") ||
    d.includes("broad") ||
    d.includes("index")
  )
    return "broad_market";
  if (d.includes("technology") || s === "SCHG" || s === "QQQ") return "technology";
  if (d.includes("semiconductor") || s === "SOXX" || s === "SMH")
    return "semiconductors";
  if (d.includes("health") || s === "XLV") return "healthcare";
  if (d.includes("financ") || s === "XLF") return "financials";
  if (d.includes("energy") || s === "XLE") return "energy";
  if (d.includes("real estate") || d.includes("reit")) return "real_estate";
  if (d.includes("biotech")) return "biotech";

  const techStocks = [
    "AAPL", "MSFT", "GOOGL", "GOOG", "META", "AMZN", "NVDA", "TSLA",
    "NFLX", "CRM", "ORCL", "ADBE", "INTC", "AMD",
  ];
  if (techStocks.includes(s)) return "technology";
  const healthStocks = ["JNJ", "UNH", "PFE", "ABBV", "MRK", "LLY"];
  if (healthStocks.includes(s)) return "healthcare";
  const finStocks = ["JPM", "BAC", "WFC", "GS", "MS", "V", "MA"];
  if (finStocks.includes(s)) return "financials";

  return "other";
}

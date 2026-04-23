import type {
  Account,
  AccountType,
  AnalysisResult,
  FinancialData,
  Holding,
  Platform,
  Snapshot,
  Transaction,
  TransactionCategory,
  UserProfile,
  AssetClass,
  Sector,
} from "./types";
import { getSupabaseAdmin } from "./supabase/admin";

// ---------------------------------------------------------------------------
// Row <-> domain mappers
// ---------------------------------------------------------------------------

interface AccountRow {
  id: string;
  user_id: string;
  platform: Platform;
  account_type: AccountType;
  name: string;
  balance: number | string;
  currency: string;
  last_updated: string;
}

interface TransactionRow {
  id: string;
  user_id: string;
  account_id: string;
  platform: Platform;
  date: string;
  description: string;
  amount: number | string;
  category: TransactionCategory;
  subcategory: string | null;
  original_category: string | null;
  memo: string | null;
}

interface HoldingRow {
  id: string;
  user_id: string;
  account_id: string;
  platform: Platform;
  symbol: string;
  name: string;
  quantity: number | string;
  cost_basis: number | string;
  current_price: number | string;
  current_value: number | string;
  gain_loss: number | string;
  gain_loss_percent: number | string;
  asset_class: AssetClass;
  sector: Sector;
  last_updated: string;
}

const num = (v: number | string): number =>
  typeof v === "number" ? v : parseFloat(v);

function accountFromRow(r: AccountRow): Account {
  return {
    id: r.id,
    platform: r.platform,
    accountType: r.account_type,
    name: r.name,
    balance: num(r.balance),
    currency: r.currency,
    lastUpdated: r.last_updated,
  };
}

function accountToRow(userId: string, a: Account): AccountRow {
  return {
    id: a.id,
    user_id: userId,
    platform: a.platform,
    account_type: a.accountType,
    name: a.name,
    balance: a.balance,
    currency: a.currency,
    last_updated: a.lastUpdated,
  };
}

function transactionFromRow(r: TransactionRow): Transaction {
  return {
    id: r.id,
    accountId: r.account_id,
    platform: r.platform,
    date: r.date,
    description: r.description,
    amount: num(r.amount),
    category: r.category,
    subcategory: r.subcategory ?? undefined,
    originalCategory: r.original_category ?? undefined,
    memo: r.memo ?? undefined,
  };
}

function transactionToRow(userId: string, t: Transaction): TransactionRow {
  return {
    id: t.id,
    user_id: userId,
    account_id: t.accountId,
    platform: t.platform,
    date: t.date,
    description: t.description,
    amount: t.amount,
    category: t.category,
    subcategory: t.subcategory ?? null,
    original_category: t.originalCategory ?? null,
    memo: t.memo ?? null,
  };
}

function holdingFromRow(r: HoldingRow): Holding {
  return {
    id: r.id,
    accountId: r.account_id,
    platform: r.platform,
    symbol: r.symbol,
    name: r.name,
    quantity: num(r.quantity),
    costBasis: num(r.cost_basis),
    currentPrice: num(r.current_price),
    currentValue: num(r.current_value),
    gainLoss: num(r.gain_loss),
    gainLossPercent: num(r.gain_loss_percent),
    assetClass: r.asset_class,
    sector: r.sector,
    lastUpdated: r.last_updated,
  };
}

function holdingToRow(userId: string, h: Holding): HoldingRow {
  return {
    id: h.id,
    user_id: userId,
    account_id: h.accountId,
    platform: h.platform,
    symbol: h.symbol,
    name: h.name,
    quantity: h.quantity,
    cost_basis: h.costBasis,
    current_price: h.currentPrice,
    current_value: h.currentValue,
    gain_loss: h.gainLoss,
    gain_loss_percent: h.gainLossPercent,
    asset_class: h.assetClass,
    sector: h.sector,
    last_updated: h.lastUpdated,
  };
}

// ---------------------------------------------------------------------------
// FinancialData (accounts / holdings / transactions)
// ---------------------------------------------------------------------------

export async function loadFinancialData(userId: string): Promise<FinancialData> {
  const supabase = getSupabaseAdmin();

  const [accountsRes, transactionsRes, holdingsRes] = await Promise.all([
    supabase.from("accounts").select("*").eq("user_id", userId),
    supabase
      .from("transactions")
      .select("*")
      .eq("user_id", userId)
      .order("date", { ascending: false }),
    supabase.from("holdings").select("*").eq("user_id", userId),
  ]);

  if (accountsRes.error) throw accountsRes.error;
  if (transactionsRes.error) throw transactionsRes.error;
  if (holdingsRes.error) throw holdingsRes.error;

  const accounts = (accountsRes.data ?? []).map(accountFromRow);
  const transactions = (transactionsRes.data ?? []).map(transactionFromRow);
  const holdings = (holdingsRes.data ?? []).map(holdingFromRow);

  const lastUpdated =
    accounts.reduce<string>(
      (max, a) => (a.lastUpdated > max ? a.lastUpdated : max),
      ""
    ) || new Date().toISOString();

  return { lastUpdated, accounts, transactions, holdings };
}

export async function saveFinancialData(
  userId: string,
  data: FinancialData
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  if (data.accounts.length > 0) {
    const rows = data.accounts.map((a) => ({
      ...accountToRow(userId, a),
      last_updated: a.lastUpdated || now,
    }));
    const { error } = await supabase
      .from("accounts")
      .upsert(rows, { onConflict: "id" });
    if (error) throw error;
  }

  if (data.holdings.length > 0) {
    const accountIds = Array.from(new Set(data.holdings.map((h) => h.accountId)));
    const { error: delErr } = await supabase
      .from("holdings")
      .delete()
      .eq("user_id", userId)
      .in("account_id", accountIds);
    if (delErr) throw delErr;

    const rows = data.holdings.map((h) => ({
      ...holdingToRow(userId, h),
      last_updated: h.lastUpdated || now,
    }));
    const { error } = await supabase.from("holdings").insert(rows);
    if (error) throw error;
  }

  if (data.transactions.length > 0) {
    const rows = data.transactions.map((t) => transactionToRow(userId, t));
    const { error } = await supabase
      .from("transactions")
      .upsert(rows, { onConflict: "id" });
    if (error) throw error;
  }
}

// ---------------------------------------------------------------------------
// Analysis cache (per user)
// ---------------------------------------------------------------------------

export async function loadAnalysis(
  userId: string
): Promise<AnalysisResult | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("analysis_cache")
    .select("result")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data?.result as AnalysisResult) ?? null;
}

export async function saveAnalysis(
  userId: string,
  result: AnalysisResult
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("analysis_cache").upsert(
    {
      user_id: userId,
      result,
      generated_at: result.generatedAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// User profile (per-user row in user_profiles table)
// ---------------------------------------------------------------------------

interface UserProfileRow {
  user_id: string;
  name: string;
  age: number | null;
  annual_income: number | string | null;
  occupation: string | null;
  fixed_expenses: UserProfile["fixedExpenses"] | null;
  budget_overrides: UserProfile["budgetOverrides"] | null;
  payroll_details: Record<string, unknown> | null;
  risk_tolerance: "conservative" | "moderate" | "aggressive" | null;
  time_horizon: "short" | "medium" | "long" | null;
  sector_bias: Sector[] | null;
  onboarding_complete: boolean;
}

function profileFromRow(r: UserProfileRow): UserProfile {
  const overrides = r.budget_overrides ?? undefined;
  return {
    name: r.name ?? "",
    age: r.age ?? 0,
    annualIncome: r.annual_income ? num(r.annual_income) : 0,
    occupation: r.occupation ?? "",
    fixedExpenses: (r.fixed_expenses as UserProfile["fixedExpenses"]) ?? [],
    budgetOverrides:
      overrides && Object.keys(overrides).length > 0 ? overrides : undefined,
    investmentPreferences: {
      sectorBias: r.sector_bias ?? [],
      riskTolerance: r.risk_tolerance ?? "moderate",
      timeHorizon: r.time_horizon ?? "long",
    },
    accounts: [],
  };
}

export async function loadUserProfile(userId: string): Promise<UserProfile> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    return {
      name: "",
      age: 0,
      annualIncome: 0,
      occupation: "",
      fixedExpenses: [],
      investmentPreferences: {
        sectorBias: [],
        riskTolerance: "moderate",
        timeHorizon: "long",
      },
      accounts: [],
    };
  }
  return profileFromRow(data as UserProfileRow);
}

export async function saveUserProfile(
  userId: string,
  profile: Omit<Partial<UserProfile>, "budgetOverrides"> & {
    payrollDetails?: Record<string, unknown>;
    onboardingComplete?: boolean;
    // null = clear all overrides, a partial object = replace stored overrides
    budgetOverrides?: UserProfile["budgetOverrides"] | null;
  }
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const row: Partial<UserProfileRow> & { user_id: string; updated_at: string } = {
    user_id: userId,
    updated_at: new Date().toISOString(),
  };
  if (profile.name !== undefined) row.name = profile.name;
  if (profile.age !== undefined) row.age = profile.age;
  if (profile.annualIncome !== undefined) row.annual_income = profile.annualIncome;
  if (profile.occupation !== undefined) row.occupation = profile.occupation;
  if (profile.fixedExpenses !== undefined) row.fixed_expenses = profile.fixedExpenses;
  if (profile.budgetOverrides !== undefined) {
    row.budget_overrides =
      profile.budgetOverrides === null
        ? null
        : (profile.budgetOverrides as UserProfile["budgetOverrides"]);
  }
  if (profile.payrollDetails !== undefined) row.payroll_details = profile.payrollDetails;
  if (profile.investmentPreferences?.riskTolerance !== undefined)
    row.risk_tolerance = profile.investmentPreferences.riskTolerance;
  if (profile.investmentPreferences?.timeHorizon !== undefined)
    row.time_horizon = profile.investmentPreferences.timeHorizon;
  if (profile.investmentPreferences?.sectorBias !== undefined)
    row.sector_bias = profile.investmentPreferences.sectorBias;
  if (profile.onboardingComplete !== undefined)
    row.onboarding_complete = profile.onboardingComplete;

  const { error } = await supabase
    .from("user_profiles")
    .upsert(row, { onConflict: "user_id" });
  if (error) throw error;
}

export async function getOnboardingComplete(userId: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("user_profiles")
    .select("onboarding_complete")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data?.onboarding_complete);
}

// ---------------------------------------------------------------------------
// Investment preferences (per-user)
// ---------------------------------------------------------------------------

export interface InvestmentPreferences {
  rothIraAnnualTarget: number | null;
  rothIraYtdContributed: number;
  roth401kPercent: number | null;
  emergencyFundTarget: number | null;
  cashFloorBrokerage: number;
  singlePositionCapPercent: number | null;
  coreAllocationMinPercent: number | null;
  coreTickers: string[];
  sectorCaps: Record<string, number>;
  excludedTickers: string[];
  allowSellRecommendations: boolean;
  allowTaxLossHarvesting: boolean;
  rebalanceDriftThresholdPercent: number;
  notes: string | null;
}

export const DEFAULT_PREFERENCES: InvestmentPreferences = {
  rothIraAnnualTarget: 7000,
  rothIraYtdContributed: 0,
  roth401kPercent: null,
  emergencyFundTarget: null,
  cashFloorBrokerage: 0,
  singlePositionCapPercent: null,
  coreAllocationMinPercent: 50,
  coreTickers: ["VTI", "VOO", "QQQ", "SCHG"],
  sectorCaps: {},
  excludedTickers: [],
  allowSellRecommendations: true,
  allowTaxLossHarvesting: true,
  rebalanceDriftThresholdPercent: 5,
  notes: null,
};

export async function loadInvestmentPreferences(
  userId: string
): Promise<InvestmentPreferences> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("investment_preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return DEFAULT_PREFERENCES;
  return {
    rothIraAnnualTarget:
      data.roth_ira_annual_target != null ? num(data.roth_ira_annual_target) : null,
    rothIraYtdContributed: data.roth_ira_ytd_contributed
      ? num(data.roth_ira_ytd_contributed)
      : 0,
    roth401kPercent:
      data.roth_401k_percent != null ? num(data.roth_401k_percent) : null,
    emergencyFundTarget:
      data.emergency_fund_target != null ? num(data.emergency_fund_target) : null,
    cashFloorBrokerage: data.cash_floor_brokerage
      ? num(data.cash_floor_brokerage)
      : 0,
    singlePositionCapPercent:
      data.single_position_cap_percent != null
        ? num(data.single_position_cap_percent)
        : null,
    coreAllocationMinPercent:
      data.core_allocation_min_percent != null
        ? num(data.core_allocation_min_percent)
        : null,
    coreTickers: data.core_tickers ?? [],
    sectorCaps: (data.sector_caps as Record<string, number>) ?? {},
    excludedTickers: data.excluded_tickers ?? [],
    allowSellRecommendations: data.allow_sell_recommendations ?? true,
    allowTaxLossHarvesting: data.allow_tax_loss_harvesting ?? true,
    rebalanceDriftThresholdPercent: data.rebalance_drift_threshold_percent
      ? num(data.rebalance_drift_threshold_percent)
      : 5,
    notes: data.notes ?? null,
  };
}

export async function saveInvestmentPreferences(
  userId: string,
  prefs: Partial<InvestmentPreferences>
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const row: Record<string, unknown> = {
    user_id: userId,
    updated_at: new Date().toISOString(),
  };
  if (prefs.rothIraAnnualTarget !== undefined)
    row.roth_ira_annual_target = prefs.rothIraAnnualTarget;
  if (prefs.rothIraYtdContributed !== undefined)
    row.roth_ira_ytd_contributed = prefs.rothIraYtdContributed;
  if (prefs.roth401kPercent !== undefined)
    row.roth_401k_percent = prefs.roth401kPercent;
  if (prefs.emergencyFundTarget !== undefined)
    row.emergency_fund_target = prefs.emergencyFundTarget;
  if (prefs.cashFloorBrokerage !== undefined)
    row.cash_floor_brokerage = prefs.cashFloorBrokerage;
  if (prefs.singlePositionCapPercent !== undefined)
    row.single_position_cap_percent = prefs.singlePositionCapPercent;
  if (prefs.coreAllocationMinPercent !== undefined)
    row.core_allocation_min_percent = prefs.coreAllocationMinPercent;
  if (prefs.coreTickers !== undefined) row.core_tickers = prefs.coreTickers;
  if (prefs.sectorCaps !== undefined) row.sector_caps = prefs.sectorCaps;
  if (prefs.excludedTickers !== undefined)
    row.excluded_tickers = prefs.excludedTickers;
  if (prefs.allowSellRecommendations !== undefined)
    row.allow_sell_recommendations = prefs.allowSellRecommendations;
  if (prefs.allowTaxLossHarvesting !== undefined)
    row.allow_tax_loss_harvesting = prefs.allowTaxLossHarvesting;
  if (prefs.rebalanceDriftThresholdPercent !== undefined)
    row.rebalance_drift_threshold_percent = prefs.rebalanceDriftThresholdPercent;
  if (prefs.notes !== undefined) row.notes = prefs.notes;

  const { error } = await supabase
    .from("investment_preferences")
    .upsert(row, { onConflict: "user_id" });
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Snapshots
// ---------------------------------------------------------------------------

export async function createSnapshot(
  userId: string,
  analysis: AnalysisResult
): Promise<Snapshot> {
  const supabase = getSupabaseAdmin();

  const { data: snap, error } = await supabase
    .from("snapshots")
    .insert({
      user_id: userId,
      date: analysis.generatedAt,
      net_worth: analysis.netWorth,
      total_assets: analysis.totalAssets,
      total_liabilities: analysis.totalLiabilities,
      savings_rate: analysis.savingsRate,
    })
    .select()
    .single();
  if (error) throw error;

  const balances = analysis.accounts.map((a) => ({
    snapshot_id: snap.id,
    account_id: a.id,
    balance: a.balance,
  }));

  if (balances.length > 0) {
    const { error: balErr } = await supabase
      .from("snapshot_balances")
      .insert(balances);
    if (balErr) throw balErr;
  }

  return {
    id: snap.id,
    date: snap.date,
    netWorth: num(snap.net_worth),
    totalAssets: num(snap.total_assets),
    totalLiabilities: num(snap.total_liabilities),
    savingsRate: num(snap.savings_rate),
    accountBalances: analysis.accounts.map((a) => ({
      accountId: a.id,
      balance: a.balance,
    })),
  };
}

export async function loadSnapshots(userId: string): Promise<Snapshot[]> {
  const supabase = getSupabaseAdmin();

  const { data: snaps, error } = await supabase
    .from("snapshots")
    .select("*")
    .eq("user_id", userId)
    .order("date", { ascending: true });
  if (error) throw error;
  if (!snaps || snaps.length === 0) return [];

  const ids = snaps.map((s) => s.id as string);
  const { data: balances, error: balErr } = await supabase
    .from("snapshot_balances")
    .select("*")
    .in("snapshot_id", ids);
  if (balErr) throw balErr;

  const balancesBySnapshot = new Map<
    string,
    { accountId: string; balance: number }[]
  >();
  for (const b of balances ?? []) {
    const list = balancesBySnapshot.get(b.snapshot_id) ?? [];
    list.push({ accountId: b.account_id, balance: num(b.balance) });
    balancesBySnapshot.set(b.snapshot_id, list);
  }

  return snaps.map((s) => ({
    id: s.id,
    date: s.date,
    netWorth: num(s.net_worth),
    totalAssets: num(s.total_assets),
    totalLiabilities: num(s.total_liabilities),
    savingsRate: num(s.savings_rate),
    accountBalances: balancesBySnapshot.get(s.id) ?? [],
  }));
}

// ---------------------------------------------------------------------------
// Sync logs
// ---------------------------------------------------------------------------

export interface SyncLogEntry {
  id: string;
  source: string;
  status: "success" | "error" | "info";
  message: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export async function writeSyncLog(
  userId: string,
  entry: Omit<SyncLogEntry, "id" | "createdAt">
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("sync_logs").insert({
    user_id: userId,
    source: entry.source,
    status: entry.status,
    message: entry.message,
    metadata: entry.metadata ?? null,
  });
  if (error) throw error;
}

export async function loadSyncLogs(
  userId: string,
  limit = 50
): Promise<SyncLogEntry[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("sync_logs")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    source: r.source,
    status: r.status as SyncLogEntry["status"],
    message: r.message ?? "",
    metadata: r.metadata ?? undefined,
    createdAt: r.created_at,
  }));
}

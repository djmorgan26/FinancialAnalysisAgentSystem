import { promises as fs } from "fs";
import path from "path";
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
import { getSupabase } from "./supabase";

const USER_PROFILE_PATH = path.join(
  process.cwd(),
  "config",
  "user-profile.json"
);

// ---------------------------------------------------------------------------
// Row <-> domain mappers
// ---------------------------------------------------------------------------

interface AccountRow {
  id: string;
  platform: Platform;
  account_type: AccountType;
  name: string;
  balance: number | string;
  currency: string;
  last_updated: string;
}

interface TransactionRow {
  id: string;
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

function accountToRow(a: Account): AccountRow {
  return {
    id: a.id,
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

function transactionToRow(t: Transaction): TransactionRow {
  return {
    id: t.id,
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

function holdingToRow(h: Holding): HoldingRow {
  return {
    id: h.id,
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
// Public API
// ---------------------------------------------------------------------------

export async function loadFinancialData(): Promise<FinancialData> {
  const supabase = getSupabase();

  const [accountsRes, transactionsRes, holdingsRes] = await Promise.all([
    supabase.from("accounts").select("*"),
    supabase
      .from("transactions")
      .select("*")
      .order("date", { ascending: false }),
    supabase.from("holdings").select("*"),
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

export async function saveFinancialData(data: FinancialData): Promise<void> {
  const supabase = getSupabase();
  const now = new Date().toISOString();

  if (data.accounts.length > 0) {
    const rows = data.accounts.map((a) => ({
      ...accountToRow(a),
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
      .in("account_id", accountIds);
    if (delErr) throw delErr;

    const rows = data.holdings.map((h) => ({
      ...holdingToRow(h),
      last_updated: h.lastUpdated || now,
    }));
    const { error } = await supabase.from("holdings").insert(rows);
    if (error) throw error;
  }

  if (data.transactions.length > 0) {
    const rows = data.transactions.map(transactionToRow);
    const { error } = await supabase
      .from("transactions")
      .upsert(rows, { onConflict: "id" });
    if (error) throw error;
  }
}

export async function loadAnalysis(): Promise<AnalysisResult | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("analysis_cache")
    .select("result")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw error;
  return (data?.result as AnalysisResult) ?? null;
}

export async function saveAnalysis(result: AnalysisResult): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from("analysis_cache").upsert(
    {
      id: 1,
      result,
      generated_at: result.generatedAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );
  if (error) throw error;
}

export async function loadUserProfile(): Promise<UserProfile> {
  try {
    const raw = await fs.readFile(USER_PROFILE_PATH, "utf-8");
    return JSON.parse(raw) as UserProfile;
  } catch {
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
}

export async function createSnapshot(
  analysis: AnalysisResult
): Promise<Snapshot> {
  const supabase = getSupabase();

  const { data: snap, error } = await supabase
    .from("snapshots")
    .insert({
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

export async function loadSnapshots(): Promise<Snapshot[]> {
  const supabase = getSupabase();

  const { data: snaps, error } = await supabase
    .from("snapshots")
    .select("*")
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

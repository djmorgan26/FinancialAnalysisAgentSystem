import type {
  Account,
  AnalysisResult,
  FinancialData,
  Holding,
  Snapshot,
  Transaction,
  UserProfile,
} from "@/lib/types";
import type { ClassificationMap, Classification } from "@/lib/classification";
import type { InvestmentPreferences } from "@/lib/data-store";
import { DEFAULT_PREFERENCES } from "@/lib/data-store";
import { runAnalysis } from "@/lib/analysis";

/**
 * Mock portfolio for no-login demo mode.
 *
 * Everything here is fictional. It is shaped to look like a real, populated
 * multi-platform account so recruiters see the dashboard at its best: a Schwab
 * brokerage + Roth IRA, a 401(k), a checking + high-yield savings account, a
 * credit card (liability), and a Coinbase crypto wallet. No real balances,
 * no real holdings, no real person.
 */

// A fixed "now" keeps the build deterministic and the relative-time labels sane.
const NOW = new Date("2026-05-20T15:30:00.000Z");
const iso = (d: Date) => d.toISOString();
const daysAgo = (n: number) => iso(new Date(NOW.getTime() - n * 86_400_000));

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

export const DEMO_ACCOUNTS: Account[] = [
  {
    id: "demo-acct-schwab-brokerage",
    platform: "schwab",
    accountType: "brokerage",
    name: "Schwab Individual Brokerage",
    balance: 184_320.45,
    currency: "USD",
    lastUpdated: daysAgo(0),
  },
  {
    id: "demo-acct-schwab-roth",
    platform: "schwab",
    accountType: "roth_ira",
    name: "Schwab Roth IRA",
    balance: 62_540.18,
    currency: "USD",
    lastUpdated: daysAgo(0),
  },
  {
    id: "demo-acct-fidelity-401k",
    platform: "fidelity",
    accountType: "traditional_401k",
    name: "Fidelity 401(k)",
    balance: 138_905.7,
    currency: "USD",
    lastUpdated: daysAgo(2),
  },
  {
    id: "demo-acct-chase-checking",
    platform: "chase",
    accountType: "checking",
    name: "Chase Total Checking",
    balance: 9_240.33,
    currency: "USD",
    lastUpdated: daysAgo(1),
  },
  {
    id: "demo-acct-chase-savings",
    platform: "chase",
    accountType: "savings",
    name: "Chase High-Yield Savings",
    balance: 28_500.0,
    currency: "USD",
    lastUpdated: daysAgo(1),
  },
  {
    id: "demo-acct-coinbase",
    platform: "coinbase",
    accountType: "crypto",
    name: "Coinbase Wallet",
    balance: 21_870.6,
    currency: "USD",
    lastUpdated: daysAgo(0),
  },
  {
    id: "demo-acct-citi-card",
    platform: "citi",
    accountType: "credit_card",
    name: "Citi Double Cash",
    balance: 2_140.77, // positive = owed (liability)
    currency: "USD",
    lastUpdated: daysAgo(1),
  },
];

// ---------------------------------------------------------------------------
// Holdings
// ---------------------------------------------------------------------------

function holding(
  partial: Omit<Holding, "currentValue" | "gainLoss" | "gainLossPercent"> & {
    currentValue?: number;
  }
): Holding {
  const currentValue =
    partial.currentValue ?? partial.quantity * partial.currentPrice;
  const gainLoss = currentValue - partial.costBasis;
  const gainLossPercent =
    partial.costBasis > 0 ? (gainLoss / partial.costBasis) * 100 : 0;
  return {
    ...partial,
    currentValue,
    gainLoss,
    gainLossPercent: Math.round(gainLossPercent * 100) / 100,
  };
}

export const DEMO_HOLDINGS: Holding[] = [
  // --- Schwab brokerage ---
  holding({
    id: "demo-h-voo",
    accountId: "demo-acct-schwab-brokerage",
    platform: "schwab",
    symbol: "VOO",
    name: "Vanguard S&P 500 ETF",
    quantity: 92,
    costBasis: 38_640,
    currentPrice: 532.18,
    assetClass: "us_equity",
    sector: "broad_market",
    lastUpdated: daysAgo(0),
  }),
  holding({
    id: "demo-h-qqq",
    accountId: "demo-acct-schwab-brokerage",
    platform: "schwab",
    symbol: "QQQ",
    name: "Invesco QQQ Trust",
    quantity: 60,
    costBasis: 27_300,
    currentPrice: 521.4,
    assetClass: "us_equity",
    sector: "technology",
    lastUpdated: daysAgo(0),
  }),
  holding({
    id: "demo-h-nvda",
    accountId: "demo-acct-schwab-brokerage",
    platform: "schwab",
    symbol: "NVDA",
    name: "NVIDIA Corp",
    quantity: 140,
    costBasis: 11_200,
    currentPrice: 138.65,
    assetClass: "us_equity",
    sector: "semiconductors",
    lastUpdated: daysAgo(0),
  }),
  holding({
    id: "demo-h-aapl",
    accountId: "demo-acct-schwab-brokerage",
    platform: "schwab",
    symbol: "AAPL",
    name: "Apple Inc",
    quantity: 110,
    costBasis: 18_700,
    currentPrice: 227.3,
    assetClass: "us_equity",
    sector: "technology",
    lastUpdated: daysAgo(0),
  }),
  holding({
    id: "demo-h-msft",
    accountId: "demo-acct-schwab-brokerage",
    platform: "schwab",
    symbol: "MSFT",
    name: "Microsoft Corp",
    quantity: 48,
    costBasis: 17_280,
    currentPrice: 451.2,
    assetClass: "us_equity",
    sector: "technology",
    lastUpdated: daysAgo(0),
  }),
  holding({
    id: "demo-h-schwab-cash",
    accountId: "demo-acct-schwab-brokerage",
    platform: "schwab",
    symbol: "CASH",
    name: "Cash & Sweep",
    quantity: 1,
    costBasis: 6_500,
    currentPrice: 6_500,
    assetClass: "cash",
    sector: "other",
    lastUpdated: daysAgo(0),
  }),

  // --- Schwab Roth IRA ---
  holding({
    id: "demo-h-schg",
    accountId: "demo-acct-schwab-roth",
    platform: "schwab",
    symbol: "SCHG",
    name: "Schwab U.S. Large-Cap Growth ETF",
    quantity: 280,
    costBasis: 24_640,
    currentPrice: 109.85,
    assetClass: "us_equity",
    sector: "broad_market",
    lastUpdated: daysAgo(0),
  }),
  holding({
    id: "demo-h-vxus",
    accountId: "demo-acct-schwab-roth",
    platform: "schwab",
    symbol: "VXUS",
    name: "Vanguard Total International Stock ETF",
    quantity: 420,
    costBasis: 24_360,
    currentPrice: 64.9,
    assetClass: "intl_equity",
    sector: "broad_market",
    lastUpdated: daysAgo(0),
  }),
  holding({
    id: "demo-h-roth-cash",
    accountId: "demo-acct-schwab-roth",
    platform: "schwab",
    symbol: "CASH",
    name: "Cash & Sweep",
    quantity: 1,
    costBasis: 7_300,
    currentPrice: 7_300,
    assetClass: "cash",
    sector: "other",
    lastUpdated: daysAgo(0),
  }),

  // --- Fidelity 401(k) ---
  holding({
    id: "demo-h-vti",
    accountId: "demo-acct-fidelity-401k",
    platform: "fidelity",
    symbol: "VTI",
    name: "Vanguard Total Stock Market ETF",
    quantity: 330,
    costBasis: 78_540,
    currentPrice: 296.1,
    assetClass: "us_equity",
    sector: "broad_market",
    lastUpdated: daysAgo(2),
  }),
  holding({
    id: "demo-h-bnd",
    accountId: "demo-acct-fidelity-401k",
    platform: "fidelity",
    symbol: "BND",
    name: "Vanguard Total Bond Market ETF",
    quantity: 560,
    costBasis: 41_440,
    currentPrice: 72.55,
    assetClass: "fixed_income",
    sector: "other",
    lastUpdated: daysAgo(2),
  }),

  // --- Coinbase ---
  holding({
    id: "demo-h-btc",
    accountId: "demo-acct-coinbase",
    platform: "coinbase",
    symbol: "BTC",
    name: "Bitcoin",
    quantity: 0.165,
    costBasis: 9_900,
    currentPrice: 94_800,
    assetClass: "crypto",
    sector: "crypto",
    lastUpdated: daysAgo(0),
  }),
  holding({
    id: "demo-h-eth",
    accountId: "demo-acct-coinbase",
    platform: "coinbase",
    symbol: "ETH",
    name: "Ethereum",
    quantity: 1.85,
    costBasis: 4_625,
    currentPrice: 3_320,
    assetClass: "crypto",
    sector: "crypto",
    lastUpdated: daysAgo(0),
  }),
];

// ---------------------------------------------------------------------------
// Transactions (recent activity — income, spending, investing)
// ---------------------------------------------------------------------------

let txCounter = 0;
function tx(t: Omit<Transaction, "id">): Transaction {
  return { id: `demo-tx-${++txCounter}`, ...t };
}

export const DEMO_TRANSACTIONS: Transaction[] = [
  // Income (two paychecks/month)
  tx({ accountId: "demo-acct-chase-checking", platform: "chase", date: daysAgo(4), description: "ACME ROBOTICS PAYROLL", amount: 4_980.22, category: "income" }),
  tx({ accountId: "demo-acct-chase-checking", platform: "chase", date: daysAgo(19), description: "ACME ROBOTICS PAYROLL", amount: 4_980.22, category: "income" }),
  tx({ accountId: "demo-acct-chase-checking", platform: "chase", date: daysAgo(34), description: "ACME ROBOTICS PAYROLL", amount: 4_980.22, category: "income" }),

  // Rent
  tx({ accountId: "demo-acct-chase-checking", platform: "chase", date: daysAgo(20), description: "GREYSTONE APARTMENTS RENT", amount: -2_350, category: "rent" }),
  tx({ accountId: "demo-acct-chase-checking", platform: "chase", date: daysAgo(50), description: "GREYSTONE APARTMENTS RENT", amount: -2_350, category: "rent" }),

  // Utilities
  tx({ accountId: "demo-acct-citi-card", platform: "citi", date: daysAgo(8), description: "CITY POWER & LIGHT", amount: -142.6, category: "utilities" }),
  tx({ accountId: "demo-acct-citi-card", platform: "citi", date: daysAgo(11), description: "XFINITY INTERNET", amount: -84.99, category: "utilities" }),

  // Food / groceries / dining
  tx({ accountId: "demo-acct-citi-card", platform: "citi", date: daysAgo(2), description: "WHOLE FOODS MARKET", amount: -156.43, category: "food" }),
  tx({ accountId: "demo-acct-citi-card", platform: "citi", date: daysAgo(5), description: "TRADER JOES", amount: -88.12, category: "food" }),
  tx({ accountId: "demo-acct-citi-card", platform: "citi", date: daysAgo(6), description: "CHIPOTLE", amount: -19.74, category: "food" }),
  tx({ accountId: "demo-acct-citi-card", platform: "citi", date: daysAgo(13), description: "BLUE BOTTLE COFFEE", amount: -12.5, category: "food" }),

  // Transportation
  tx({ accountId: "demo-acct-citi-card", platform: "citi", date: daysAgo(3), description: "SHELL FUEL", amount: -58.2, category: "transportation" }),
  tx({ accountId: "demo-acct-citi-card", platform: "citi", date: daysAgo(9), description: "UBER TRIP", amount: -24.85, category: "transportation" }),

  // Subscriptions
  tx({ accountId: "demo-acct-citi-card", platform: "citi", date: daysAgo(7), description: "NETFLIX", amount: -22.99, category: "subscriptions" }),
  tx({ accountId: "demo-acct-citi-card", platform: "citi", date: daysAgo(7), description: "SPOTIFY", amount: -11.99, category: "subscriptions" }),
  tx({ accountId: "demo-acct-citi-card", platform: "citi", date: daysAgo(14), description: "ICLOUD+ STORAGE", amount: -2.99, category: "subscriptions" }),

  // Entertainment / shopping
  tx({ accountId: "demo-acct-citi-card", platform: "citi", date: daysAgo(10), description: "AMAZON ORDER", amount: -134.27, category: "shopping" }),
  tx({ accountId: "demo-acct-citi-card", platform: "citi", date: daysAgo(15), description: "AMC THEATERS", amount: -38.5, category: "entertainment" }),

  // Insurance
  tx({ accountId: "demo-acct-chase-checking", platform: "chase", date: daysAgo(12), description: "GEICO AUTO INSURANCE", amount: -128.4, category: "insurance" }),

  // Investing (recurring DCA into brokerage)
  tx({ accountId: "demo-acct-schwab-brokerage", platform: "schwab", date: daysAgo(5), description: "BUY VOO", amount: -1_500, category: "investment_buy" }),
  tx({ accountId: "demo-acct-coinbase", platform: "coinbase", date: daysAgo(5), description: "BUY BTC", amount: -300, category: "investment_buy" }),

  // Transfers to savings
  tx({ accountId: "demo-acct-chase-savings", platform: "chase", date: daysAgo(18), description: "TRANSFER TO SAVINGS", amount: 1_000, category: "transfer" }),

  // Dividend
  tx({ accountId: "demo-acct-schwab-brokerage", platform: "schwab", date: daysAgo(22), description: "VOO DIVIDEND", amount: 312.45, category: "investment_dividend" }),
];

// ---------------------------------------------------------------------------
// Profile & preferences
// ---------------------------------------------------------------------------

export const DEMO_PROFILE: UserProfile = {
  name: "Demo User",
  age: 31,
  annualIncome: 132_000,
  occupation: "Software Engineer",
  fixedExpenses: [
    { name: "Rent", amount: 2_350, frequency: "monthly" },
    { name: "Auto insurance", amount: 128.4, frequency: "monthly" },
    { name: "Utilities", amount: 230, frequency: "monthly" },
    { name: "Subscriptions", amount: 38, frequency: "monthly" },
  ],
  investmentPreferences: {
    sectorBias: ["ai_ml", "semiconductors", "technology"],
    riskTolerance: "aggressive",
    timeHorizon: "long",
  },
  accounts: [],
};

export const DEMO_PREFERENCES: InvestmentPreferences = {
  ...DEFAULT_PREFERENCES,
  rothIraAnnualTarget: 7_000,
  rothIraYtdContributed: 2_900,
  roth401kPercent: 12,
  emergencyFundTarget: 30_000,
  emergencyFundAccountIds: ["demo-acct-chase-savings"],
  emergencyFundCurrentOverride: null,
  coreAllocationMinPercent: 50,
  coreTickers: ["VTI", "VOO", "QQQ", "SCHG"],
  singlePositionCapPercent: 15,
  notes: "Demo portfolio — aggressive growth tilt toward AI/semis with a broad-market core.",
};

// ---------------------------------------------------------------------------
// Classification map (so sector exposure renders without any AI/Supabase call)
// ---------------------------------------------------------------------------

export function demoClassificationMap(): ClassificationMap {
  const map: ClassificationMap = new Map();
  const seen = new Set<string>();
  for (const h of DEMO_HOLDINGS) {
    const key = h.symbol.toUpperCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const c: Classification = {
      sector: h.sector,
      assetClass: h.assetClass,
      source: "heuristic",
      name: h.name,
    };
    map.set(key, c);
  }
  return map;
}

// ---------------------------------------------------------------------------
// Assembled financial data + analysis (computed once via the real pipeline)
// ---------------------------------------------------------------------------

export function demoFinancialData(): FinancialData {
  return {
    lastUpdated: daysAgo(0),
    accounts: DEMO_ACCOUNTS,
    transactions: DEMO_TRANSACTIONS,
    holdings: DEMO_HOLDINGS,
  };
}

let cachedAnalysis: AnalysisResult | null = null;

/**
 * Run the real analysis pipeline over the fixtures so the demo dashboard,
 * plan, and analysis pages all see a fully populated AnalysisResult — same
 * code path production uses, just fed mock data.
 */
export function demoAnalysis(): AnalysisResult {
  if (cachedAnalysis) return cachedAnalysis;
  cachedAnalysis = runAnalysis(
    demoFinancialData(),
    DEMO_PROFILE,
    demoClassificationMap(),
    {
      emergencyFundTarget: DEMO_PREFERENCES.emergencyFundTarget,
      emergencyFundAccountIds: DEMO_PREFERENCES.emergencyFundAccountIds,
      emergencyFundCurrentOverride: DEMO_PREFERENCES.emergencyFundCurrentOverride,
    }
  );
  return cachedAnalysis;
}

// ---------------------------------------------------------------------------
// Snapshots (net-worth history for the History page sparkline)
// ---------------------------------------------------------------------------

export function demoSnapshots(): Snapshot[] {
  const analysis = demoAnalysis();
  const series = [
    { d: 180, nw: 372_400 },
    { d: 150, nw: 388_900 },
    { d: 120, nw: 401_200 },
    { d: 90, nw: 396_500 },
    { d: 60, nw: 418_700 },
    { d: 30, nw: 432_100 },
    { d: 0, nw: Math.round(analysis.netWorth) },
  ];
  return series.map((pt, i) => {
    const assets = pt.nw + analysis.totalLiabilities;
    return {
      id: `demo-snap-${i}`,
      date: daysAgo(pt.d),
      netWorth: pt.nw,
      totalAssets: Math.round(assets),
      totalLiabilities: Math.round(analysis.totalLiabilities),
      savingsRate: analysis.savingsRate,
      accountBalances: DEMO_ACCOUNTS.map((a) => ({
        accountId: a.id,
        balance: a.balance,
      })),
    };
  });
}

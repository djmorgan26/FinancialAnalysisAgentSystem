// ============================================================
// Unified Financial Data Schema
// ============================================================

// --- Accounts ---
export type AccountType =
  | "checking"
  | "savings"
  | "brokerage"
  | "roth_401k"
  | "roth_ira"
  | "traditional_401k"
  | "traditional_ira"
  | "credit_card"
  | "crypto"
  | "other";

export type Platform =
  | "fidelity"
  | "schwab"
  | "robinhood"
  | "coinbase"
  | "chase"
  | "citi"
  | "manual";

export interface Account {
  id: string;
  platform: Platform;
  accountType: AccountType;
  name: string;
  balance: number;
  currency: string;
  lastUpdated: string; // ISO date
}

// --- Transactions ---
export type TransactionCategory =
  | "income"
  | "rent"
  | "utilities"
  | "insurance"
  | "food"
  | "transportation"
  | "healthcare"
  | "subscriptions"
  | "entertainment"
  | "shopping"
  | "investment_buy"
  | "investment_sell"
  | "investment_dividend"
  | "transfer"
  | "fee"
  | "other";

export interface Transaction {
  id: string;
  accountId: string;
  platform: Platform;
  date: string; // ISO date
  description: string;
  amount: number; // negative = debit, positive = credit
  category: TransactionCategory;
  subcategory?: string;
  originalCategory?: string; // from the platform
  memo?: string;
}

// --- Holdings ---
export type AssetClass =
  | "us_equity"
  | "intl_equity"
  | "fixed_income"
  | "cash"
  | "crypto"
  | "commodity"
  | "real_estate"
  | "other";

export type Sector =
  | "technology"
  | "healthcare"
  | "financials"
  | "consumer_discretionary"
  | "consumer_staples"
  | "industrials"
  | "energy"
  | "utilities"
  | "materials"
  | "real_estate"
  | "communication_services"
  | "semiconductors"
  | "ai_ml"
  | "quantum_computing"
  | "biotech"
  | "crypto"
  | "broad_market"
  | "other";

export interface Holding {
  id: string;
  accountId: string;
  platform: Platform;
  symbol: string;
  name: string;
  quantity: number;
  costBasis: number;
  currentPrice: number;
  currentValue: number;
  gainLoss: number;
  gainLossPercent: number;
  assetClass: AssetClass;
  sector: Sector;
  lastUpdated: string;
}

// --- User Profile & Config ---
export interface FixedExpense {
  name: string;
  amount: number;
  frequency: "monthly" | "annual" | "quarterly";
}

export interface BudgetOverrides {
  necessities?: number;
  investments?: number;
  discretionary?: number;
  savings?: number;
}

export interface UserProfile {
  name: string;
  age: number;
  annualIncome: number;
  occupation: string;
  fixedExpenses: FixedExpense[];
  budgetOverrides?: BudgetOverrides;
  investmentPreferences: {
    sectorBias: Sector[];
    riskTolerance: "conservative" | "moderate" | "aggressive";
    timeHorizon: "short" | "medium" | "long";
  };
  accounts: {
    platform: Platform;
    accountType: AccountType;
    name: string;
  }[];
}

// --- Analysis Results ---
export interface SpendingBreakdown {
  category: TransactionCategory;
  total: number;
  monthlyAverage: number;
  percentOfTotal: number;
  trend: "increasing" | "decreasing" | "stable";
}

export interface AllocationBreakdown {
  label: string;
  value: number;
  percent: number;
}

export interface AnalysisResult {
  generatedAt: string;
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
  monthlyIncome: number;
  monthlySpending: number;
  monthlySavings: number;
  savingsRate: number;
  accounts: Account[];
  spendingBreakdown: SpendingBreakdown[];
  assetAllocation: AllocationBreakdown[];
  sectorExposure: AllocationBreakdown[];
  accountBreakdown: AllocationBreakdown[];
  holdings: Holding[];
  insights: Insight[];
  strategy: InvestmentStrategy;
}

export interface Insight {
  type: "warning" | "opportunity" | "info";
  category: "spending" | "investment" | "savings" | "allocation";
  title: string;
  description: string;
  actionable: boolean;
  action?: string;
}

// --- Investment Strategy ---
export interface DCATarget {
  symbol: string;
  name: string;
  allocationPercent: number;
  monthlyAmount: number;
  rationale: string;
  sector: Sector;
}

export interface InvestmentStrategy {
  monthlyInvestmentBudget: number;
  emergencyFundTarget: number;
  emergencyFundCurrent: number;
  dcaTargets: DCATarget[];
  tacticalOpportunities: string[];
  monthlyBudget: {
    necessities: number;
    investments: number;
    discretionary: number;
    savings: number;
  };
}

// --- Snapshot ---
export interface Snapshot {
  id: string;
  date: string;
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
  savingsRate: number;
  accountBalances: { accountId: string; balance: number }[];
}

// --- Data Store ---
export interface FinancialData {
  lastUpdated: string;
  accounts: Account[];
  transactions: Transaction[];
  holdings: Holding[];
}

import type {
  Transaction,
  TransactionCategory,
  Account,
  SpendingBreakdown,
  FixedExpense,
  UserProfile,
} from "@/lib/types";

// ============================================================
// Spending Analysis Module
// ============================================================

/** Categories that represent real spending (excludes income, transfers, investments). */
const SPENDING_CATEGORIES: TransactionCategory[] = [
  "rent",
  "utilities",
  "insurance",
  "food",
  "transportation",
  "healthcare",
  "subscriptions",
  "entertainment",
  "shopping",
  "fee",
  "other",
];

/** Determine how many distinct months the transactions span. */
function getMonthSpan(transactions: Transaction[]): number {
  if (transactions.length === 0) return 1;

  const months = new Set<string>();
  for (const tx of transactions) {
    const d = new Date(tx.date);
    months.add(`${d.getFullYear()}-${d.getMonth()}`);
  }
  return Math.max(months.size, 1);
}

/** Group transactions by month key (YYYY-MM). */
function groupByMonth(
  transactions: Transaction[]
): Map<string, Transaction[]> {
  const groups = new Map<string, Transaction[]>();
  for (const tx of transactions) {
    const key = tx.date.slice(0, 7); // YYYY-MM
    const existing = groups.get(key) ?? [];
    existing.push(tx);
    groups.set(key, existing);
  }
  return groups;
}

/**
 * Compute a simple trend from monthly totals.
 * Uses a least-squares slope on the last 3+ months of data.
 * Falls back to "stable" if insufficient data.
 */
function computeTrend(
  monthlyTotals: number[]
): "increasing" | "decreasing" | "stable" {
  if (monthlyTotals.length < 3) return "stable";

  const recent = monthlyTotals.slice(-6); // look at last 6 months max
  const n = recent.length;
  const xMean = (n - 1) / 2;
  const yMean = recent.reduce((a, b) => a + b, 0) / n;

  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i++) {
    numerator += (i - xMean) * (recent[i] - yMean);
    denominator += (i - xMean) ** 2;
  }

  if (denominator === 0) return "stable";

  const slope = numerator / denominator;
  // Normalize slope relative to average spend to get a percentage change per month
  const relativeSlope = yMean !== 0 ? slope / yMean : 0;

  if (relativeSlope > 0.05) return "increasing";
  if (relativeSlope < -0.05) return "decreasing";
  return "stable";
}

/**
 * Compute total monthly income from transactions.
 * Falls back to profile annual income / 12 if no income transactions exist.
 */
export function computeMonthlyIncome(
  transactions: Transaction[],
  profile: UserProfile
): number {
  const incomeTransactions = transactions.filter(
    (tx) => tx.category === "income"
  );

  if (incomeTransactions.length > 0) {
    const monthSpan = getMonthSpan(incomeTransactions);
    const totalIncome = incomeTransactions.reduce(
      (sum, tx) => sum + Math.abs(tx.amount),
      0
    );
    return totalIncome / monthSpan;
  }

  // Fallback: derive from profile
  return profile.annualIncome / 12;
}

/**
 * Build spending breakdowns from real transactions.
 * Each spending category gets a total, monthly average, percent-of-total, and trend.
 */
export function analyzeSpendingFromTransactions(
  transactions: Transaction[]
): SpendingBreakdown[] {
  const spendingTx = transactions.filter((tx) =>
    SPENDING_CATEGORIES.includes(tx.category)
  );

  if (spendingTx.length === 0) return [];

  const monthSpan = getMonthSpan(spendingTx);
  const byMonth = groupByMonth(spendingTx);
  const sortedMonths = [...byMonth.keys()].sort();

  // Aggregate totals per category
  const categoryTotals = new Map<TransactionCategory, number>();
  const categoryMonthlyAmounts = new Map<TransactionCategory, number[]>();

  for (const cat of SPENDING_CATEGORIES) {
    categoryTotals.set(cat, 0);
    categoryMonthlyAmounts.set(cat, []);
  }

  // First pass: accumulate totals
  for (const tx of spendingTx) {
    const current = categoryTotals.get(tx.category) ?? 0;
    categoryTotals.set(tx.category, current + Math.abs(tx.amount));
  }

  // Second pass: build per-month totals for trend analysis
  for (const month of sortedMonths) {
    const monthTxs = byMonth.get(month) ?? [];
    const monthCatTotals = new Map<TransactionCategory, number>();

    for (const tx of monthTxs) {
      if (!SPENDING_CATEGORIES.includes(tx.category)) continue;
      const current = monthCatTotals.get(tx.category) ?? 0;
      monthCatTotals.set(tx.category, current + Math.abs(tx.amount));
    }

    for (const cat of SPENDING_CATEGORIES) {
      categoryMonthlyAmounts.get(cat)!.push(monthCatTotals.get(cat) ?? 0);
    }
  }

  const totalSpending = [...categoryTotals.values()].reduce(
    (a, b) => a + b,
    0
  );

  const breakdowns: SpendingBreakdown[] = [];

  for (const cat of SPENDING_CATEGORIES) {
    const total = categoryTotals.get(cat) ?? 0;
    if (total === 0) continue;

    breakdowns.push({
      category: cat,
      total: Math.round(total * 100) / 100,
      monthlyAverage: Math.round((total / monthSpan) * 100) / 100,
      percentOfTotal:
        totalSpending > 0
          ? Math.round((total / totalSpending) * 10000) / 100
          : 0,
      trend: computeTrend(categoryMonthlyAmounts.get(cat) ?? []),
    });
  }

  // Sort by total descending
  breakdowns.sort((a, b) => b.total - a.total);
  return breakdowns;
}

/**
 * Build estimated spending breakdowns from fixed expenses in the user profile.
 * Used as a fallback when no transaction data is available.
 */
export function estimateSpendingFromProfile(
  profile: UserProfile
): SpendingBreakdown[] {
  const monthlyExpenses = new Map<string, number>();

  for (const expense of profile.fixedExpenses) {
    let monthly: number;
    switch (expense.frequency) {
      case "monthly":
        monthly = expense.amount;
        break;
      case "annual":
        monthly = expense.amount / 12;
        break;
      case "quarterly":
        monthly = expense.amount / 3;
        break;
    }

    const category = mapExpenseNameToCategory(expense.name);
    const existing = monthlyExpenses.get(category) ?? 0;
    monthlyExpenses.set(category, existing + monthly);
  }

  const totalMonthly = [...monthlyExpenses.values()].reduce(
    (a, b) => a + b,
    0
  );

  const breakdowns: SpendingBreakdown[] = [];
  for (const [cat, monthly] of monthlyExpenses) {
    breakdowns.push({
      category: cat as TransactionCategory,
      total: Math.round(monthly * 100) / 100, // single month estimate
      monthlyAverage: Math.round(monthly * 100) / 100,
      percentOfTotal:
        totalMonthly > 0
          ? Math.round((monthly / totalMonthly) * 10000) / 100
          : 0,
      trend: "stable", // no historical data to determine trend
    });
  }

  breakdowns.sort((a, b) => b.monthlyAverage - a.monthlyAverage);
  return breakdowns;
}

/**
 * Compute total monthly spending from breakdowns.
 */
export function totalMonthlySpending(breakdowns: SpendingBreakdown[]): number {
  return breakdowns.reduce((sum, b) => sum + b.monthlyAverage, 0);
}

/**
 * Map a human-readable expense name to a TransactionCategory.
 * Uses simple keyword matching.
 */
function mapExpenseNameToCategory(name: string): TransactionCategory {
  const lower = name.toLowerCase();

  if (lower.includes("rent") || lower.includes("mortgage")) return "rent";
  if (lower.includes("utilit") || lower.includes("electric") || lower.includes("water") || lower.includes("gas") || lower.includes("internet") || lower.includes("phone"))
    return "utilities";
  if (lower.includes("insurance")) return "insurance";
  if (lower.includes("grocer") || lower.includes("food") || lower.includes("dining"))
    return "food";
  if (lower.includes("car") || lower.includes("transport") || lower.includes("gas") || lower.includes("uber") || lower.includes("lyft"))
    return "transportation";
  if (lower.includes("health") || lower.includes("medical") || lower.includes("doctor") || lower.includes("dental"))
    return "healthcare";
  if (
    lower.includes("subscri") ||
    lower.includes("netflix") ||
    lower.includes("spotify") ||
    lower.includes("gym") ||
    lower.includes("membership")
  )
    return "subscriptions";
  if (lower.includes("entertain")) return "entertainment";

  return "other";
}

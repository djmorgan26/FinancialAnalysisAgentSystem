import type {
  FinancialData,
  UserProfile,
  AnalysisResult,
  Account,
  Holding,
  SpendingBreakdown,
  AllocationBreakdown,
  Insight,
  InvestmentStrategy,
} from "@/lib/types";
import {
  computeMonthlyIncome,
  analyzeSpendingFromTransactions,
  estimateSpendingFromProfile,
  totalMonthlySpending,
} from "./spending";
import {
  computeAssetAllocation,
  computeSectorExposure,
  computeAccountBreakdown,
  totalPortfolioValue,
} from "./investments";
import { generateInsights } from "./insights";
import { generateStrategy } from "./strategy";
import {
  applyClassifications,
  type ClassificationMap,
} from "@/lib/classification";

// ============================================================
// Main Analysis Orchestrator
// ============================================================

/**
 * Run the complete financial analysis pipeline.
 *
 * Takes raw financial data (accounts, transactions, holdings) and a user profile,
 * then produces a comprehensive AnalysisResult including spending breakdowns,
 * asset allocation, sector exposure, insights, and an investment strategy.
 *
 * Gracefully handles missing data:
 * - No transactions: falls back to profile's fixedExpenses for spending estimates
 * - No holdings: produces empty allocation breakdowns, strategy still generates
 * - No accounts: uses profile.accounts metadata with zero balances
 */
export function runAnalysis(
  data: FinancialData,
  profile: UserProfile,
  classificationMap?: ClassificationMap,
  options?: { emergencyFundTarget?: number | null }
): AnalysisResult {
  // --- Step 1: Resolve accounts ---
  const accounts = resolveAccounts(data.accounts, profile);

  // --- Step 2: Compute income ---
  const monthlyIncome = computeMonthlyIncome(data.transactions, profile);

  // --- Step 3: Analyze spending ---
  const hasTransactions = data.transactions.length > 0;
  const spendingBreakdown: SpendingBreakdown[] = hasTransactions
    ? analyzeSpendingFromTransactions(data.transactions)
    : estimateSpendingFromProfile(profile);

  const monthlySpending = totalMonthlySpending(spendingBreakdown);

  // --- Step 4: Compute net worth ---
  const { totalAssets, totalLiabilities, netWorth } = computeNetWorth(accounts);

  // --- Step 5: Savings metrics ---
  const monthlySavings = Math.max(monthlyIncome - monthlySpending, 0);
  const savingsRate =
    monthlyIncome > 0
      ? Math.round((monthlySavings / monthlyIncome) * 10000) / 100
      : 0;

  // --- Step 6: Investment analysis ---
  const holdings = classificationMap
    ? applyClassifications(data.holdings, classificationMap)
    : data.holdings;
  const assetAllocation = computeAssetAllocation(holdings);
  const sectorExposure = computeSectorExposure(holdings, classificationMap);
  const accountBreakdown = computeAccountBreakdown(accounts);

  // --- Step 7: Generate strategy ---
  const strategy = generateStrategy({
    profile,
    monthlyIncome,
    monthlySpending,
    holdings,
    accounts,
    sectorExposure,
    emergencyFundTargetOverride: options?.emergencyFundTarget ?? null,
  });

  // --- Step 8: Generate insights ---
  const insights = generateInsights({
    profile,
    monthlyIncome,
    monthlySpending,
    savingsRate,
    spendingBreakdown,
    assetAllocation,
    sectorExposure,
    holdings,
    accounts,
    emergencyFundCurrent: strategy.emergencyFundCurrent,
    emergencyFundTarget: strategy.emergencyFundTarget,
  });

  return {
    generatedAt: new Date().toISOString(),
    netWorth,
    totalAssets,
    totalLiabilities,
    monthlyIncome: Math.round(monthlyIncome * 100) / 100,
    monthlySpending: Math.round(monthlySpending * 100) / 100,
    monthlySavings: Math.round(monthlySavings * 100) / 100,
    savingsRate,
    accounts,
    spendingBreakdown,
    assetAllocation,
    sectorExposure,
    accountBreakdown,
    holdings,
    insights,
    strategy,
  };
}

// ============================================================
// Internal Helpers
// ============================================================

/**
 * Merge real account data with profile metadata.
 * If no real accounts exist, create placeholder accounts from the profile
 * so the rest of the pipeline has something to work with.
 */
function resolveAccounts(
  dataAccounts: Account[],
  profile: UserProfile
): Account[] {
  if (dataAccounts.length > 0) {
    return dataAccounts;
  }

  // Create stub accounts from profile metadata
  return profile.accounts.map((pa, index) => ({
    id: `profile-${index}`,
    platform: pa.platform,
    accountType: pa.accountType,
    name: pa.name,
    balance: 0,
    currency: "USD",
    lastUpdated: new Date().toISOString(),
  }));
}

/**
 * Compute net worth from account balances.
 * Credit card balances are treated as liabilities (balance is negative or represents debt).
 */
function computeNetWorth(accounts: Account[]): {
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
} {
  let totalAssets = 0;
  let totalLiabilities = 0;

  for (const account of accounts) {
    if (account.accountType === "credit_card") {
      // Credit card balances represent debt (liability)
      // If balance is positive, it's owed; if negative, it's a credit
      if (account.balance > 0) {
        totalLiabilities += account.balance;
      } else {
        totalAssets += Math.abs(account.balance);
      }
    } else {
      if (account.balance >= 0) {
        totalAssets += account.balance;
      } else {
        totalLiabilities += Math.abs(account.balance);
      }
    }
  }

  return {
    totalAssets: Math.round(totalAssets * 100) / 100,
    totalLiabilities: Math.round(totalLiabilities * 100) / 100,
    netWorth: Math.round((totalAssets - totalLiabilities) * 100) / 100,
  };
}

// Re-export sub-modules for direct access when needed
export {
  computeMonthlyIncome,
  analyzeSpendingFromTransactions,
  estimateSpendingFromProfile,
  totalMonthlySpending,
} from "./spending";
export {
  computeAssetAllocation,
  computeSectorExposure,
  computeAccountBreakdown,
  aggregateHoldings,
  findOverlappingHoldings,
  findInefficiencies,
  totalPortfolioValue,
  totalGainLoss,
} from "./investments";
export { generateInsights } from "./insights";
export { generateStrategy } from "./strategy";

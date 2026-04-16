import type {
  Insight,
  SpendingBreakdown,
  AllocationBreakdown,
  Holding,
  Account,
  UserProfile,
} from "@/lib/types";
import {
  findOverlappingHoldings,
  findInefficiencies,
  aggregateHoldings,
  totalGainLoss,
} from "./investments";

// ============================================================
// Insight Generator Module
// ============================================================

/**
 * Generate all insights by analyzing spending, investments, and allocation data.
 * Returns an array of actionable (and informational) insights.
 */
export function generateInsights(params: {
  profile: UserProfile;
  monthlyIncome: number;
  monthlySpending: number;
  savingsRate: number;
  spendingBreakdown: SpendingBreakdown[];
  assetAllocation: AllocationBreakdown[];
  sectorExposure: AllocationBreakdown[];
  holdings: Holding[];
  accounts: Account[];
  emergencyFundCurrent: number;
  emergencyFundTarget: number;
}): Insight[] {
  const insights: Insight[] = [];

  insights.push(...analyzeSavingsRate(params.savingsRate, params.monthlyIncome));
  insights.push(
    ...analyzeSpendingPatterns(params.spendingBreakdown, params.monthlyIncome)
  );
  insights.push(
    ...analyzeEmergencyFund(
      params.emergencyFundCurrent,
      params.emergencyFundTarget
    )
  );
  insights.push(
    ...analyzeInvestmentAllocation(
      params.assetAllocation,
      params.sectorExposure,
      params.profile
    )
  );
  insights.push(...analyzeHoldingHealth(params.holdings));
  insights.push(
    ...analyzePortfolioOverlaps(params.holdings, params.sectorExposure)
  );
  insights.push(...analyzeAccountStructure(params.accounts, params.profile));
  insights.push(...analyzeRetirementContributions(params.accounts, params.profile));

  return insights;
}

// --- Savings Rate ---

function analyzeSavingsRate(
  savingsRate: number,
  monthlyIncome: number
): Insight[] {
  const insights: Insight[] = [];

  if (savingsRate >= 25) {
    insights.push({
      type: "info",
      category: "savings",
      title: "Strong savings rate",
      description: `Your savings rate of ${savingsRate.toFixed(1)}% exceeds the recommended 20-25% target. This positions you well for aggressive wealth building.`,
      actionable: false,
    });
  } else if (savingsRate >= 20) {
    insights.push({
      type: "info",
      category: "savings",
      title: "Solid savings rate",
      description: `Your savings rate of ${savingsRate.toFixed(1)}% is within the recommended 20-25% range. Maintain or increase to accelerate wealth growth.`,
      actionable: false,
    });
  } else if (savingsRate >= 10) {
    insights.push({
      type: "warning",
      category: "savings",
      title: "Below-target savings rate",
      description: `Your savings rate of ${savingsRate.toFixed(1)}% is below the recommended 20-25% for aggressive wealth building. You're leaving $${Math.round((0.2 - savingsRate / 100) * monthlyIncome)}/month on the table.`,
      actionable: true,
      action:
        "Review discretionary spending and redirect at least 5% more of income toward investments.",
    });
  } else {
    insights.push({
      type: "warning",
      category: "savings",
      title: "Critical: Low savings rate",
      description: `Your savings rate of ${savingsRate.toFixed(1)}% is well below target. At this rate, long-term financial goals will be very difficult to achieve.`,
      actionable: true,
      action:
        "Urgently review all spending categories and identify at least $500/month to redirect toward savings and investments.",
    });
  }

  return insights;
}

// --- Spending Patterns ---

function analyzeSpendingPatterns(
  breakdowns: SpendingBreakdown[],
  monthlyIncome: number
): Insight[] {
  const insights: Insight[] = [];

  // Flag categories with increasing trends
  const increasing = breakdowns.filter((b) => b.trend === "increasing");
  for (const b of increasing) {
    insights.push({
      type: "warning",
      category: "spending",
      title: `Rising ${b.category} spending`,
      description: `Your ${b.category} spending is trending upward at $${b.monthlyAverage.toFixed(0)}/month (${b.percentOfTotal.toFixed(1)}% of total spending).`,
      actionable: true,
      action: `Review recent ${b.category} transactions and set a monthly budget cap.`,
    });
  }

  // Flag rent > 30% of income
  const rent = breakdowns.find((b) => b.category === "rent");
  if (rent && monthlyIncome > 0) {
    const rentPercent = (rent.monthlyAverage / monthlyIncome) * 100;
    if (rentPercent > 30) {
      insights.push({
        type: "warning",
        category: "spending",
        title: "High housing cost ratio",
        description: `Rent at $${rent.monthlyAverage.toFixed(0)}/month is ${rentPercent.toFixed(1)}% of gross income, above the recommended 30% threshold.`,
        actionable: true,
        action:
          "Consider cost-sharing arrangements or look for housing that fits within 25-30% of gross income.",
      });
    }
  }

  // Flag subscription creep
  const subscriptions = breakdowns.find((b) => b.category === "subscriptions");
  if (subscriptions && subscriptions.monthlyAverage > 200) {
    insights.push({
      type: "opportunity",
      category: "spending",
      title: "Subscription audit opportunity",
      description: `You're spending $${subscriptions.monthlyAverage.toFixed(0)}/month on subscriptions. A quarterly audit typically finds 10-20% in unused or underused services.`,
      actionable: true,
      action:
        "Review all active subscriptions and cancel any you haven't used in the past 30 days.",
    });
  }

  // Flag food spending > 15% of income
  const food = breakdowns.find((b) => b.category === "food");
  if (food && monthlyIncome > 0) {
    const foodPercent = (food.monthlyAverage / monthlyIncome) * 100;
    if (foodPercent > 15) {
      insights.push({
        type: "opportunity",
        category: "spending",
        title: "Food spending optimization",
        description: `Food spending at $${food.monthlyAverage.toFixed(0)}/month (${foodPercent.toFixed(1)}% of income) is above average. Meal planning could save 20-30%.`,
        actionable: true,
        action:
          "Try meal prepping 3-4 meals per week and reduce dining out to 2x/week.",
      });
    }
  }

  return insights;
}

// --- Emergency Fund ---

function analyzeEmergencyFund(
  current: number,
  target: number
): Insight[] {
  const insights: Insight[] = [];
  const ratio = target > 0 ? current / target : 0;

  if (ratio >= 1) {
    insights.push({
      type: "info",
      category: "savings",
      title: "Emergency fund fully funded",
      description: `Your emergency fund of $${current.toLocaleString()} meets or exceeds the $${target.toLocaleString()} target (${(ratio * 100).toFixed(0)}% funded).`,
      actionable: false,
    });
  } else if (ratio >= 0.5) {
    insights.push({
      type: "warning",
      category: "savings",
      title: "Emergency fund partially funded",
      description: `Your emergency fund is $${current.toLocaleString()} of the $${target.toLocaleString()} target (${(ratio * 100).toFixed(0)}% funded). You need $${(target - current).toLocaleString()} more.`,
      actionable: true,
      action: `Allocate a portion of monthly savings to reach the target. At $500/month, you'll be fully funded in ${Math.ceil((target - current) / 500)} months.`,
    });
  } else {
    insights.push({
      type: "warning",
      category: "savings",
      title: "Critical: Emergency fund underfunded",
      description: `Your emergency fund of $${current.toLocaleString()} covers less than half the $${target.toLocaleString()} target. This leaves you vulnerable to unexpected expenses.`,
      actionable: true,
      action:
        "Prioritize building the emergency fund before increasing investment contributions. Redirect discretionary spending here.",
    });
  }

  return insights;
}

// --- Investment Allocation ---

function analyzeInvestmentAllocation(
  assetAllocation: AllocationBreakdown[],
  sectorExposure: AllocationBreakdown[],
  profile: UserProfile
): Insight[] {
  const insights: Insight[] = [];

  // Check equity allocation for age-appropriate aggressiveness
  const equityAlloc = assetAllocation
    .filter((a) => a.label.includes("Equity"))
    .reduce((sum, a) => sum + a.percent, 0);

  const isAggressive = profile.investmentPreferences.riskTolerance === "aggressive";
  const isLongHorizon = profile.investmentPreferences.timeHorizon === "long";

  if (isAggressive && isLongHorizon && equityAlloc < 70 && assetAllocation.length > 0) {
    insights.push({
      type: "opportunity",
      category: "allocation",
      title: "Equity allocation below aggressive target",
      description: `At ${equityAlloc.toFixed(1)}% equities, your portfolio is more conservative than your aggressive risk profile suggests. With a long time horizon, you could target 80-90% equities.`,
      actionable: true,
      action:
        "Rebalance by shifting fixed income and cash positions into equity ETFs aligned with your sector preferences.",
    });
  }

  // Check for preferred sector underexposure
  const preferredSectors = profile.investmentPreferences.sectorBias;
  for (const sector of preferredSectors) {
    const exposure = sectorExposure.find(
      (s) => s.label.toLowerCase().includes(sector.replace("_", " "))
    );
    if (!exposure || exposure.percent < 5) {
      const sectorLabel = sector.replace("_", " ");
      insights.push({
        type: "opportunity",
        category: "allocation",
        title: `Low exposure to preferred sector: ${sectorLabel}`,
        description: `You have ${exposure ? exposure.percent.toFixed(1) : "0"}% exposure to ${sectorLabel}, which is one of your preferred sectors. Consider adding targeted ETFs.`,
        actionable: true,
        action: `Research and add ETFs with ${sectorLabel} exposure to your DCA plan.`,
      });
    }
  }

  // Check for zero international exposure
  const intlExposure = assetAllocation.find((a) =>
    a.label.includes("International")
  );
  if ((!intlExposure || intlExposure.percent < 5) && assetAllocation.length > 0) {
    insights.push({
      type: "opportunity",
      category: "allocation",
      title: "No international diversification",
      description:
        "Your portfolio has minimal international exposure. Even aggressive US-focused portfolios benefit from 10-20% international allocation for diversification.",
      actionable: true,
      action:
        "Consider adding VXUS (Total International) or VEA (Developed Markets) at 10-15% of portfolio.",
    });
  }

  return insights;
}

// --- Holding Health ---

function analyzeHoldingHealth(holdings: Holding[]): Insight[] {
  const insights: Insight[] = [];

  if (holdings.length === 0) return insights;

  const { amount, percent } = totalGainLoss(holdings);

  if (amount > 0) {
    insights.push({
      type: "info",
      category: "investment",
      title: "Portfolio in the green",
      description: `Your portfolio has $${amount.toLocaleString()} in unrealized gains (${percent.toFixed(1)}% return on cost basis).`,
      actionable: false,
    });
  }

  // Find top gainers and losers
  const sorted = [...holdings]
    .filter((h) => h.currentValue > 100)
    .sort((a, b) => b.gainLossPercent - a.gainLossPercent);

  if (sorted.length >= 1) {
    const topGainer = sorted[0];
    if (topGainer.gainLossPercent > 50) {
      insights.push({
        type: "info",
        category: "investment",
        title: `Strong performer: ${topGainer.symbol}`,
        description: `${topGainer.symbol} is up ${topGainer.gainLossPercent.toFixed(1)}% ($${topGainer.gainLoss.toFixed(0)} gain). Consider if this changes your target allocation.`,
        actionable: false,
      });
    }
  }

  // Check for concentrated single-position risk
  const totalValue = holdings.reduce((sum, h) => sum + h.currentValue, 0);
  for (const h of holdings) {
    const positionPercent = totalValue > 0 ? (h.currentValue / totalValue) * 100 : 0;
    if (positionPercent > 25 && h.assetClass !== "cash") {
      insights.push({
        type: "warning",
        category: "investment",
        title: `Concentrated position: ${h.symbol}`,
        description: `${h.symbol} is ${positionPercent.toFixed(1)}% of your portfolio ($${h.currentValue.toLocaleString()}). A single position above 25% creates significant concentration risk.`,
        actionable: true,
        action: `Consider trimming ${h.symbol} and diversifying into other holdings to reduce single-stock risk.`,
      });
    }
  }

  return insights;
}

// --- Portfolio Overlaps ---

function analyzePortfolioOverlaps(
  holdings: Holding[],
  sectorExposure: AllocationBreakdown[]
): Insight[] {
  const insights: Insight[] = [];

  const aggregated = aggregateHoldings(holdings);
  const overlaps = findOverlappingHoldings(aggregated);

  if (overlaps.length > 0) {
    const overlapSymbols = overlaps.map((h) => h.symbol).join(", ");
    insights.push({
      type: "info",
      category: "investment",
      title: "Cross-account holding overlap",
      description: `The following holdings appear in multiple accounts: ${overlapSymbols}. This isn't necessarily bad, but may complicate rebalancing and tax planning.`,
      actionable: true,
      action:
        "Consider consolidating duplicate holdings into a single account for simpler management and better tax-lot control.",
    });
  }

  const inefficiencies = findInefficiencies(holdings, sectorExposure);
  for (const issue of inefficiencies) {
    insights.push({
      type: "warning",
      category: "investment",
      title: "Portfolio inefficiency detected",
      description: issue,
      actionable: true,
      action: "Review and consolidate or rebalance as noted.",
    });
  }

  return insights;
}

// --- Account Structure ---

function analyzeAccountStructure(
  accounts: Account[],
  profile: UserProfile
): Insight[] {
  const insights: Insight[] = [];

  const accountTypes = new Set(accounts.map((a) => a.accountType));
  const profileTypes = new Set(profile.accounts.map((a) => a.accountType));

  // Check for Roth IRA
  const hasRothIRA =
    accountTypes.has("roth_ira") || profileTypes.has("roth_ira");
  if (!hasRothIRA && profile.age < 40) {
    insights.push({
      type: "opportunity",
      category: "savings",
      title: "Open a Roth IRA",
      description:
        "You don't appear to have a Roth IRA. At your age, tax-free growth in a Roth is one of the most powerful wealth-building tools available.",
      actionable: true,
      action:
        "Open a Roth IRA (Fidelity or Schwab recommended) and max the $7,000 annual contribution.",
    });
  }

  // Check for employer retirement account
  const hasEmployerRetirement =
    accountTypes.has("roth_401k") ||
    accountTypes.has("traditional_401k") ||
    profileTypes.has("roth_401k") ||
    profileTypes.has("traditional_401k");

  if (!hasEmployerRetirement) {
    insights.push({
      type: "opportunity",
      category: "savings",
      title: "Maximize employer retirement plan",
      description:
        "No employer 401(k) detected. If your employer offers a match, you're leaving free money on the table.",
      actionable: true,
      action:
        "Enroll in your employer's 401(k) and contribute at least enough to get the full match.",
    });
  }

  return insights;
}

// --- Retirement Contributions ---

function analyzeRetirementContributions(
  accounts: Account[],
  profile: UserProfile
): Insight[] {
  const insights: Insight[] = [];

  // For young, high-income earners: prioritize Roth
  if (profile.age < 35 && profile.annualIncome < 161000) {
    // Under Roth IRA income limit (2024 single filer phase-out starts ~$146k)
    insights.push({
      type: "opportunity",
      category: "savings",
      title: "Maximize Roth contributions",
      description: `At age ${profile.age} with $${(profile.annualIncome / 1000).toFixed(0)}k income, you're in the sweet spot for Roth contributions. Tax-free growth for 30+ years is enormously valuable. Prioritize maxing Roth IRA ($7,000) and Roth 401(k) if available.`,
      actionable: true,
      action:
        "Ensure Roth IRA is maxed ($7,000/year). If employer offers Roth 401(k), direct contributions there over traditional.",
    });
  }

  return insights;
}

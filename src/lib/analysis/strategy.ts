import type {
  UserProfile,
  Holding,
  Account,
  AllocationBreakdown,
  InvestmentStrategy,
  DCATarget,
  Sector,
} from "@/lib/types";

// ============================================================
// Investment Strategy Engine
// ============================================================

// --- Recommended ETFs by Sector ---

interface ETFRecommendation {
  symbol: string;
  name: string;
  sector: Sector;
  /** Base allocation weight before adjustment (higher = more core). */
  baseWeight: number;
  rationale: string;
}

const RECOMMENDED_ETFS: ETFRecommendation[] = [
  {
    symbol: "VTI",
    name: "Vanguard Total Stock Market ETF",
    sector: "broad_market",
    baseWeight: 25,
    rationale:
      "Core broad-market US equity position. Provides diversified baseline exposure to the entire US stock market.",
  },
  {
    symbol: "QQQ",
    name: "Invesco QQQ Trust (Nasdaq-100)",
    sector: "technology",
    baseWeight: 15,
    rationale:
      "Heavy tech/growth tilt with top-100 Nasdaq exposure. Overlaps with VGT but broader growth exposure.",
  },
  {
    symbol: "VGT",
    name: "Vanguard Information Technology ETF",
    sector: "technology",
    baseWeight: 12,
    rationale:
      "Concentrated technology sector exposure. Captures the full IT sector including software, hardware, and services.",
  },
  {
    symbol: "SOXX",
    name: "iShares Semiconductor ETF",
    sector: "semiconductors",
    baseWeight: 10,
    rationale:
      "Direct semiconductor exposure covering CPUs, GPUs, and chip infrastructure. Critical for AI/ML hardware thesis.",
  },
  {
    symbol: "SMH",
    name: "VanEck Semiconductor ETF",
    sector: "semiconductors",
    baseWeight: 8,
    rationale:
      "Complementary semiconductor play with slightly different weighting. Heavier in TSMC and ASML for supply chain coverage.",
  },
  {
    symbol: "IBB",
    name: "iShares Biotechnology ETF",
    sector: "biotech",
    baseWeight: 8,
    rationale:
      "Diversified biotech exposure spanning large-cap pharma to growth-stage biotech. Healthcare innovation play.",
  },
  {
    symbol: "ARKK",
    name: "ARK Innovation ETF",
    sector: "ai_ml",
    baseWeight: 5,
    rationale:
      "High-conviction disruptive innovation fund. Volatile but captures AI, genomics, and next-gen technology themes.",
  },
  {
    symbol: "QTUM",
    name: "Defiance Quantum Computing ETF",
    sector: "quantum_computing",
    baseWeight: 5,
    rationale:
      "Targeted quantum computing and machine learning exposure. Early-stage thematic play on next-generation computing.",
  },
];

// --- Budget Constants ---

/** Target savings rate range for a 25-year-old aggressive growth profile. */
const TARGET_SAVINGS_RATE_MIN = 0.2;
const TARGET_SAVINGS_RATE_MAX = 0.25;

/** Emergency fund target: months of expenses. */
const EMERGENCY_FUND_MONTHS_MIN = 3;
const EMERGENCY_FUND_MONTHS_MAX = 6;

/** Roth IRA annual contribution limit (2024/2025). */
const ROTH_IRA_ANNUAL_LIMIT = 7000;

/** Roth 401(k) annual employee contribution limit (2024/2025). */
const ROTH_401K_ANNUAL_LIMIT = 23500;

// ============================================================
// Public API
// ============================================================

/**
 * Generate a complete investment strategy including DCA plan, budget, and
 * emergency fund targets.
 */
export function generateStrategy(params: {
  profile: UserProfile;
  monthlyIncome: number;
  monthlySpending: number;
  holdings: Holding[];
  accounts: Account[];
  sectorExposure: AllocationBreakdown[];
}): InvestmentStrategy {
  const { profile, monthlyIncome, monthlySpending, holdings, accounts, sectorExposure } =
    params;

  const monthlyBudget = buildMonthlyBudget(profile, monthlyIncome, monthlySpending);
  const emergencyFund = computeEmergencyFund(monthlySpending, accounts);
  const dcaTargets = buildDCAPlan(
    profile,
    monthlyBudget.investments,
    holdings,
    sectorExposure
  );
  const tacticalOpportunities = generateTacticalOpportunities(
    profile,
    holdings,
    sectorExposure,
    accounts,
    monthlyIncome
  );

  return {
    monthlyInvestmentBudget: monthlyBudget.investments,
    emergencyFundTarget: emergencyFund.target,
    emergencyFundCurrent: emergencyFund.current,
    dcaTargets,
    tacticalOpportunities,
    monthlyBudget,
  };
}

// ============================================================
// Budget Allocation
// ============================================================

/**
 * Build a monthly budget breakdown.
 * Allocates income across necessities, investments, discretionary, and savings.
 *
 * For a young high-income engineer:
 * - Necessities: rent + fixed expenses + estimated variable needs
 * - Investments: target 15-20% of gross into market investments
 * - Savings: target 5-10% of gross into cash savings / emergency fund
 * - Discretionary: remainder
 */
function buildMonthlyBudget(
  profile: UserProfile,
  monthlyIncome: number,
  monthlySpending: number
): InvestmentStrategy["monthlyBudget"] {
  // Calculate necessities from fixed expenses
  let necessities = 0;
  for (const exp of profile.fixedExpenses) {
    switch (exp.frequency) {
      case "monthly":
        necessities += exp.amount;
        break;
      case "annual":
        necessities += exp.amount / 12;
        break;
      case "quarterly":
        necessities += exp.amount / 3;
        break;
    }
  }

  // If actual spending data exceeds fixed expenses, use the higher number as the
  // necessities floor (actual spending captures variable costs like food/transport).
  if (monthlySpending > necessities) {
    // Split the overage: assume 70% is necessity, 30% is discretionary
    const overage = monthlySpending - necessities;
    necessities += overage * 0.7;
  }

  // Target allocation of remaining income
  const afterNecessities = Math.max(monthlyIncome - necessities, 0);

  // For aggressive growth: invest as much as possible
  // Target: investments = 60% of surplus, savings = 15% of surplus, discretionary = 25%
  let investments: number;
  let savings: number;
  let discretionary: number;

  if (afterNecessities > 0) {
    investments = Math.round(afterNecessities * 0.6);
    savings = Math.round(afterNecessities * 0.15);
    discretionary = Math.round(afterNecessities * 0.25);
  } else {
    // Income doesn't cover necessities - still try to save something
    investments = 0;
    savings = 0;
    discretionary = 0;
  }

  // Ensure total savings rate (investments + savings) hits target range
  const totalSavingsRate =
    monthlyIncome > 0 ? (investments + savings) / monthlyIncome : 0;

  if (totalSavingsRate < TARGET_SAVINGS_RATE_MIN && monthlyIncome > 0) {
    // Boost investments by pulling from discretionary
    const targetSavingsAmount = monthlyIncome * TARGET_SAVINGS_RATE_MIN;
    const deficit = targetSavingsAmount - (investments + savings);
    const pullFromDiscretionary = Math.min(deficit, discretionary * 0.5);
    investments += Math.round(pullFromDiscretionary);
    discretionary -= Math.round(pullFromDiscretionary);
  }

  return {
    necessities: Math.round(necessities),
    investments: Math.round(investments),
    discretionary: Math.round(discretionary),
    savings: Math.round(savings),
  };
}

// ============================================================
// Emergency Fund
// ============================================================

/**
 * Compute emergency fund target and current balance.
 * Target = 3-6 months of expenses (use 4 months as default).
 * Current = sum of savings and checking account balances.
 */
function computeEmergencyFund(
  monthlySpending: number,
  accounts: Account[]
): { target: number; current: number } {
  // Use the midpoint of 3-6 months for young earners with stable employment
  const targetMonths = 4;
  const target = Math.round(monthlySpending * targetMonths);

  // Emergency fund = cash in savings + checking accounts
  const current = accounts
    .filter((a) => a.accountType === "savings" || a.accountType === "checking")
    .reduce((sum, a) => sum + a.balance, 0);

  return { target, current };
}

// ============================================================
// DCA Plan
// ============================================================

/**
 * Build a Dollar Cost Averaging plan.
 * Allocates the monthly investment budget across recommended ETFs,
 * weighted by user's sector preferences and current portfolio gaps.
 */
function buildDCAPlan(
  profile: UserProfile,
  monthlyInvestmentBudget: number,
  holdings: Holding[],
  sectorExposure: AllocationBreakdown[]
): DCATarget[] {
  if (monthlyInvestmentBudget <= 0) return [];

  const preferredSectors = new Set(profile.investmentPreferences.sectorBias);

  // Compute adjusted weights based on preferences and current exposure
  const adjustedETFs = RECOMMENDED_ETFS.map((etf) => {
    let weight = etf.baseWeight;

    // Boost weight for preferred sectors
    if (preferredSectors.has(etf.sector)) {
      weight *= 1.3;
    }

    // Slight underweight for sectors already heavily represented
    const currentExposure = sectorExposure.find((s) =>
      s.label.toLowerCase().includes(etf.sector.replace("_", " "))
    );
    if (currentExposure && currentExposure.percent > 20) {
      // Already heavily exposed - reduce new DCA allocation slightly
      weight *= 0.8;
    }

    // Boost for sectors with very low current exposure (< 3%)
    if (!currentExposure || currentExposure.percent < 3) {
      weight *= 1.2;
    }

    return { ...etf, adjustedWeight: weight };
  });

  // Normalize weights to sum to 100%
  const totalWeight = adjustedETFs.reduce((sum, e) => sum + e.adjustedWeight, 0);

  const dcaTargets: DCATarget[] = adjustedETFs.map((etf) => {
    const allocationPercent =
      Math.round((etf.adjustedWeight / totalWeight) * 10000) / 100;
    const monthlyAmount =
      Math.round((allocationPercent / 100) * monthlyInvestmentBudget * 100) /
      100;

    return {
      symbol: etf.symbol,
      name: etf.name,
      allocationPercent,
      monthlyAmount,
      rationale: etf.rationale,
      sector: etf.sector,
    };
  });

  // Sort by allocation descending
  dcaTargets.sort((a, b) => b.allocationPercent - a.allocationPercent);

  return dcaTargets;
}

// ============================================================
// Tactical Opportunities
// ============================================================

/**
 * Generate non-DCA tactical recommendations.
 * These are one-time or conditional actions rather than recurring investments.
 */
function generateTacticalOpportunities(
  profile: UserProfile,
  holdings: Holding[],
  sectorExposure: AllocationBreakdown[],
  accounts: Account[],
  monthlyIncome: number
): string[] {
  const opportunities: string[] = [];

  // 1. Max Roth IRA contribution
  const hasRothIRA = accounts.some((a) => a.accountType === "roth_ira");
  if (hasRothIRA) {
    opportunities.push(
      `Max Roth IRA contribution: $${ROTH_IRA_ANNUAL_LIMIT.toLocaleString()}/year ($${Math.round(ROTH_IRA_ANNUAL_LIMIT / 12)}/month). This should be your first investment priority for tax-free growth.`
    );
  } else {
    opportunities.push(
      `Open and max a Roth IRA ($${ROTH_IRA_ANNUAL_LIMIT.toLocaleString()}/year). At your income level and age, tax-free growth is the single best wealth accelerator available.`
    );
  }

  // 2. Roth 401(k) recommendation
  const has401k = accounts.some(
    (a) =>
      a.accountType === "roth_401k" || a.accountType === "traditional_401k"
  );
  if (has401k) {
    opportunities.push(
      `Maximize Roth 401(k) contributions up to $${ROTH_401K_ANNUAL_LIMIT.toLocaleString()}/year. At age ${profile.age}, the decades of tax-free compounding outweigh the current-year tax deduction of traditional.`
    );
  } else {
    opportunities.push(
      `Enroll in employer 401(k) if available. At minimum, contribute enough to capture the full employer match - it's an instant 50-100% return.`
    );
  }

  // 3. Tax-loss harvesting opportunities
  const losers = holdings.filter(
    (h) => h.gainLossPercent < -10 && h.currentValue > 500
  );
  if (losers.length > 0) {
    const loserSymbols = losers.map((h) => h.symbol).join(", ");
    opportunities.push(
      `Tax-loss harvesting opportunity: ${loserSymbols} have unrealized losses exceeding 10%. Sell and replace with similar-but-not-identical ETFs to capture the tax benefit while maintaining exposure.`
    );
  }

  // 4. Sector-specific tactical calls based on preferences
  const semiExposure = sectorExposure.find(
    (s) => s.label === "Semiconductors"
  );
  if (!semiExposure || semiExposure.percent < 10) {
    opportunities.push(
      `Semiconductor thesis underweight: Consider a lump-sum position in SOXX or SMH to build semiconductor exposure. The AI infrastructure buildout is driving multi-year demand for chips, GPUs, and advanced packaging.`
    );
  }

  const quantumExposure = sectorExposure.find(
    (s) => s.label === "Quantum Computing"
  );
  if (!quantumExposure || quantumExposure.percent < 3) {
    opportunities.push(
      `Quantum computing is a high-risk/high-reward early-stage play. Allocate a small satellite position (2-5% of portfolio) via QTUM or individual picks like IONQ. This is speculative - size accordingly.`
    );
  }

  // 5. Lifestyle planning: upcoming rent change
  const currentRent = profile.fixedExpenses.find((e) =>
    e.name.toLowerCase().includes("rent")
  );
  if (currentRent) {
    // Reference known upcoming change: moving in with girlfriend, $1600 rent
    const projectedRent = 1600;
    if (currentRent.amount !== projectedRent) {
      const monthlySaving = currentRent.amount - projectedRent;
      if (monthlySaving > 0) {
        opportunities.push(
          `Upcoming rent change to $${projectedRent}/month (splitting with partner) saves $${monthlySaving}/month. Redirect the full savings to investments to boost your DCA by ${((monthlySaving / monthlyIncome) * 100).toFixed(1)}% of income.`
        );
      } else {
        opportunities.push(
          `Upcoming rent change to $${projectedRent}/month increases housing by $${Math.abs(monthlySaving)}/month. Adjust discretionary budget to absorb without reducing investment contributions.`
        );
      }
    }
  }

  // 6. HSA recommendation for software engineers
  opportunities.push(
    `If your employer offers an HSA-eligible health plan, max the HSA ($4,300/year single). It's the only triple-tax-advantaged account: deductible contributions, tax-free growth, and tax-free qualified withdrawals. Invest the balance in growth funds.`
  );

  // 7. I-Bond or HYSA for emergency fund portion
  opportunities.push(
    `Park emergency fund in a high-yield savings account (5%+ APY) or short-term Treasury ETF (e.g., SHV, BIL). Don't leave cash idle in a 0.01% checking account.`
  );

  return opportunities;
}

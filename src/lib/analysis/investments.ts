import type {
  Holding,
  Account,
  AssetClass,
  Sector,
  AllocationBreakdown,
} from "@/lib/types";

// ============================================================
// Investment Analysis Module
// ============================================================

/**
 * Known ETF/fund-to-sector mappings.
 * Extends beyond what the platform reports, catching common thematic ETFs.
 */
const SYMBOL_SECTOR_MAP: Record<string, Sector> = {
  VGT: "technology",
  QQQ: "technology",
  XLK: "technology",
  ARKK: "technology",
  ARKW: "technology",
  SOXX: "semiconductors",
  SMH: "semiconductors",
  PSI: "semiconductors",
  IBB: "biotech",
  XBI: "biotech",
  ARKG: "biotech",
  XLV: "healthcare",
  VHT: "healthcare",
  QTUM: "quantum_computing",
  IONQ: "quantum_computing",
  BOTZ: "ai_ml",
  ROBO: "ai_ml",
  AIQ: "ai_ml",
  VTI: "broad_market",
  VOO: "broad_market",
  SPY: "broad_market",
  IVV: "broad_market",
  VXUS: "broad_market",
  IXUS: "broad_market",
  VEA: "broad_market",
  VWO: "broad_market",
  BND: "broad_market",
  AGG: "broad_market",
  VBTLX: "broad_market",
  BTC: "crypto",
  ETH: "crypto",
  SOL: "crypto",
  GBTC: "crypto",
  IBIT: "crypto",
  XLF: "financials",
  XLE: "energy",
  XLI: "industrials",
  XLY: "consumer_discretionary",
  XLP: "consumer_staples",
  XLU: "utilities",
  XLRE: "real_estate",
  VNQ: "real_estate",
  XLC: "communication_services",
};

/**
 * Enrich a holding's sector using our known symbol map.
 * Returns the mapped sector if the symbol is recognized, otherwise uses the holding's own sector.
 */
function resolveSector(holding: Holding): Sector {
  const upperSymbol = holding.symbol.toUpperCase();
  return SYMBOL_SECTOR_MAP[upperSymbol] ?? holding.sector;
}

/**
 * Aggregate holdings by symbol across all accounts.
 * Returns a map of symbol -> merged holding data.
 */
export function aggregateHoldings(
  holdings: Holding[]
): Map<string, AggregatedHolding> {
  const map = new Map<string, AggregatedHolding>();

  for (const h of holdings) {
    const symbol = h.symbol.toUpperCase();
    const existing = map.get(symbol);

    if (existing) {
      existing.totalQuantity += h.quantity;
      existing.totalCostBasis += h.costBasis;
      existing.totalValue += h.currentValue;
      existing.totalGainLoss += h.gainLoss;
      existing.accountIds.add(h.accountId);
      existing.platforms.add(h.platform);
    } else {
      map.set(symbol, {
        symbol,
        name: h.name,
        totalQuantity: h.quantity,
        totalCostBasis: h.costBasis,
        totalValue: h.currentValue,
        totalGainLoss: h.gainLoss,
        currentPrice: h.currentPrice,
        assetClass: h.assetClass,
        sector: resolveSector(h),
        accountIds: new Set([h.accountId]),
        platforms: new Set([h.platform]),
      });
    }
  }

  return map;
}

export interface AggregatedHolding {
  symbol: string;
  name: string;
  totalQuantity: number;
  totalCostBasis: number;
  totalValue: number;
  totalGainLoss: number;
  currentPrice: number;
  assetClass: AssetClass;
  sector: Sector;
  accountIds: Set<string>;
  platforms: Set<string>;
}

/**
 * Compute asset allocation breakdown (US equity, intl equity, fixed income, etc.).
 */
export function computeAssetAllocation(
  holdings: Holding[]
): AllocationBreakdown[] {
  const totalValue = holdings.reduce((sum, h) => sum + h.currentValue, 0);
  if (totalValue === 0) return [];

  const classMap = new Map<AssetClass, number>();
  for (const h of holdings) {
    const current = classMap.get(h.assetClass) ?? 0;
    classMap.set(h.assetClass, current + h.currentValue);
  }

  const labels: Record<AssetClass, string> = {
    us_equity: "US Equity",
    intl_equity: "International Equity",
    fixed_income: "Fixed Income",
    cash: "Cash & Equivalents",
    crypto: "Cryptocurrency",
    commodity: "Commodities",
    real_estate: "Real Estate",
    other: "Other",
  };

  return [...classMap.entries()]
    .map(([cls, value]) => ({
      label: labels[cls] ?? cls,
      value: Math.round(value * 100) / 100,
      percent: Math.round((value / totalValue) * 10000) / 100,
    }))
    .sort((a, b) => b.value - a.value);
}

/**
 * Compute sector exposure breakdown.
 * Uses enriched sector data from the symbol map where available.
 */
export function computeSectorExposure(
  holdings: Holding[]
): AllocationBreakdown[] {
  const totalValue = holdings.reduce((sum, h) => sum + h.currentValue, 0);
  if (totalValue === 0) return [];

  const sectorMap = new Map<Sector, number>();
  for (const h of holdings) {
    const sector = resolveSector(h);
    const current = sectorMap.get(sector) ?? 0;
    sectorMap.set(sector, current + h.currentValue);
  }

  const labels: Record<Sector, string> = {
    technology: "Technology",
    healthcare: "Healthcare",
    financials: "Financials",
    consumer_discretionary: "Consumer Discretionary",
    consumer_staples: "Consumer Staples",
    industrials: "Industrials",
    energy: "Energy",
    utilities: "Utilities",
    materials: "Materials",
    real_estate: "Real Estate",
    communication_services: "Communication Services",
    semiconductors: "Semiconductors",
    ai_ml: "AI / Machine Learning",
    quantum_computing: "Quantum Computing",
    biotech: "Biotech",
    crypto: "Cryptocurrency",
    broad_market: "Broad Market",
    other: "Other",
  };

  return [...sectorMap.entries()]
    .map(([sector, value]) => ({
      label: labels[sector] ?? sector,
      value: Math.round(value * 100) / 100,
      percent: Math.round((value / totalValue) * 10000) / 100,
    }))
    .sort((a, b) => b.value - a.value);
}

/**
 * Compute account-level allocation breakdown.
 */
export function computeAccountBreakdown(
  accounts: Account[]
): AllocationBreakdown[] {
  const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);
  if (totalBalance === 0) return [];

  return accounts
    .map((a) => ({
      label: `${a.name} (${a.platform})`,
      value: Math.round(a.balance * 100) / 100,
      percent: Math.round((a.balance / totalBalance) * 10000) / 100,
    }))
    .sort((a, b) => b.value - a.value);
}

/**
 * Identify holdings that appear in multiple accounts (potential duplicates/overlaps).
 */
export function findOverlappingHoldings(
  aggregated: Map<string, AggregatedHolding>
): AggregatedHolding[] {
  return [...aggregated.values()].filter((h) => h.accountIds.size > 1);
}

/**
 * Identify potential inefficiencies in the portfolio:
 * - Overlapping broad-market funds (e.g., VTI + VOO)
 * - Over-concentration in a single sector (> 40%)
 * - Holdings with significant unrealized losses
 */
export function findInefficiencies(
  holdings: Holding[],
  sectorExposure: AllocationBreakdown[]
): string[] {
  const issues: string[] = [];

  // Check for overlapping broad-market funds
  const broadMarketSymbols = holdings
    .filter((h) => {
      const sector = resolveSector(h);
      return sector === "broad_market" && h.assetClass === "us_equity";
    })
    .map((h) => h.symbol.toUpperCase());

  const uniqueBroadMarket = [...new Set(broadMarketSymbols)];
  if (uniqueBroadMarket.length > 2) {
    issues.push(
      `Holding ${uniqueBroadMarket.length} overlapping broad-market US equity funds (${uniqueBroadMarket.join(", ")}). Consider consolidating to reduce redundancy.`
    );
  }

  // Check for over-concentration
  for (const sector of sectorExposure) {
    if (sector.percent > 40 && sector.label !== "Broad Market") {
      issues.push(
        `Over-concentrated in ${sector.label} at ${sector.percent}% of portfolio. Consider diversifying to reduce sector-specific risk.`
      );
    }
  }

  // Check for significant unrealized losses (> 20%)
  for (const h of holdings) {
    if (h.gainLossPercent < -20 && h.currentValue > 500) {
      issues.push(
        `${h.symbol} is down ${Math.abs(h.gainLossPercent).toFixed(1)}% (unrealized loss of $${Math.abs(h.gainLoss).toFixed(0)}). Consider tax-loss harvesting.`
      );
    }
  }

  return issues;
}

/**
 * Compute the total investment portfolio value.
 */
export function totalPortfolioValue(holdings: Holding[]): number {
  return holdings.reduce((sum, h) => sum + h.currentValue, 0);
}

/**
 * Compute total unrealized gain/loss across all holdings.
 */
export function totalGainLoss(holdings: Holding[]): {
  amount: number;
  percent: number;
} {
  const totalValue = holdings.reduce((sum, h) => sum + h.currentValue, 0);
  const totalCost = holdings.reduce((sum, h) => sum + h.costBasis, 0);
  const gain = totalValue - totalCost;

  return {
    amount: Math.round(gain * 100) / 100,
    percent: totalCost > 0 ? Math.round((gain / totalCost) * 10000) / 100 : 0,
  };
}

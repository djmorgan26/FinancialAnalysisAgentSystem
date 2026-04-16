import type {
  Account,
  Transaction,
  Holding,
  AssetClass,
  Sector,
  TransactionCategory,
} from "../types";
import {
  parseCSV,
  parseDollar,
  parseQuantity,
  normalizeDate,
  deterministicId,
  todayISO,
} from "./utils";

// ---------------------------------------------------------------------------
// CSV row shapes
// ---------------------------------------------------------------------------

/** Coinbase standard transaction export */
interface CoinbaseTransactionRow {
  Timestamp?: string;
  "Transaction Type"?: string;
  Asset?: string;
  "Quantity Transacted"?: string;
  "Spot Price at Transaction"?: string;
  Subtotal?: string;
  "Total (inclusive of fees)"?: string;
  "Fees and/or Spread"?: string;
  Notes?: string;
}

/** Coinbase portfolio / balance export (some versions) */
interface CoinbaseBalanceRow {
  Asset?: string;
  Symbol?: string;
  Balance?: string;
  "Spot Price"?: string;
  Value?: string;
  "Cost Basis"?: string;
  "Gain/Loss"?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Coinbase CSV files sometimes start with informational lines or different
 * header formats. Detect and skip non-CSV preamble.
 */
function countLeadingNonCSVLines(content: string): number {
  const lines = content.trim().split(/\r?\n/);
  let skip = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (
      trimmed === "" ||
      trimmed.startsWith("You can") ||
      trimmed.startsWith("Coinbase") ||
      trimmed.startsWith("https://") ||
      (trimmed.startsWith('"') === false && !trimmed.includes(",Timestamp"))
    ) {
      // Check if this looks like our expected header
      if (
        trimmed.includes("Timestamp") ||
        trimmed.includes("Transaction Type") ||
        trimmed.includes("Asset") ||
        trimmed.includes("Symbol")
      ) {
        break;
      }
      skip++;
    } else {
      break;
    }
  }
  return skip;
}

function coinbaseTypeToCategory(type: string): TransactionCategory {
  const t = type.toLowerCase().trim();

  if (t === "buy" || t === "advanced trade buy" || t === "receive" || t === "rewards income" || t === "learning reward") {
    return "investment_buy";
  }
  if (t === "sell" || t === "advanced trade sell") {
    return "investment_sell";
  }
  if (
    t === "staking income" || t === "interest" || t === "reward" ||
    t === "inflation reward" || t === "coinbase earn"
  ) {
    return "investment_dividend";
  }
  if (
    t === "send" || t === "deposit" || t === "withdrawal" ||
    t === "convert"
  ) {
    return "transfer";
  }
  if (t === "fee") {
    return "fee";
  }
  return "other";
}

function cryptoSector(asset: string): Sector {
  const a = asset.toUpperCase();

  // Layer 1 blockchains and major coins
  if (["BTC", "ETH", "SOL", "ADA", "DOT", "AVAX", "ATOM", "NEAR", "APT", "SUI"].includes(a)) {
    return "crypto";
  }
  // DeFi
  if (["UNI", "AAVE", "MKR", "COMP", "CRV", "SNX", "SUSHI", "YFI"].includes(a)) {
    return "crypto";
  }
  // AI / ML related crypto
  if (["FET", "RNDR", "AGIX", "OCEAN", "TAO"].includes(a)) {
    return "ai_ml";
  }

  return "crypto";
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Extract Coinbase accounts from transaction CSV.
 * Coinbase exports don't always separate accounts, so we create one crypto account.
 */
export function importAccounts(csvContent: string): Account[] {
  const skip = countLeadingNonCSVLines(csvContent);
  const rows = parseCSV<CoinbaseTransactionRow>(csvContent, {
    skipLines: skip,
  });

  // Compute approximate current value from transactions
  // (Buy adds value, Sell subtracts, fees are costs)
  let estimatedValue = 0;
  for (const row of rows) {
    const type = (row["Transaction Type"] ?? "").toLowerCase();
    const total = parseDollar(row["Total (inclusive of fees)"] ?? row["Subtotal"]);

    if (type === "buy" || type === "receive" || type === "advanced trade buy") {
      estimatedValue += Math.abs(total);
    } else if (type === "sell" || type === "send" || type === "advanced trade sell") {
      estimatedValue -= Math.abs(total);
    } else if (type === "staking income" || type === "rewards income" || type === "learning reward") {
      estimatedValue += Math.abs(total);
    }
  }

  return [
    {
      id: deterministicId("coinbase-account-crypto"),
      platform: "coinbase",
      accountType: "crypto",
      name: "Coinbase",
      balance: estimatedValue,
      currency: "USD",
      lastUpdated: todayISO(),
    },
  ];
}

/**
 * Parse Coinbase transaction CSV.
 */
export function importTransactions(csvContent: string): Transaction[] {
  const skip = countLeadingNonCSVLines(csvContent);
  const rows = parseCSV<CoinbaseTransactionRow>(csvContent, {
    skipLines: skip,
  });
  const transactions: Transaction[] = [];

  const accountId = deterministicId("coinbase-account-crypto");

  for (const row of rows) {
    const timestamp = row["Timestamp"] ?? "";
    const txType = row["Transaction Type"] ?? "";
    const asset = row["Asset"] ?? "";
    const quantity = parseQuantity(row["Quantity Transacted"]);
    const spotPrice = parseDollar(row["Spot Price at Transaction"]);
    const subtotal = parseDollar(row["Subtotal"]);
    const total = parseDollar(row["Total (inclusive of fees)"]);
    const fees = parseDollar(row["Fees and/or Spread"]);
    const notes = row["Notes"] ?? "";

    if (!timestamp && !txType) continue;

    const category = coinbaseTypeToCategory(txType);

    // For buys, the amount is negative (money leaving bank). For sells, positive.
    let amount = total || subtotal;
    const lowerType = txType.toLowerCase();
    if (lowerType === "buy" || lowerType === "advanced trade buy") {
      amount = -Math.abs(amount);
    } else if (lowerType === "sell" || lowerType === "advanced trade sell") {
      amount = Math.abs(amount);
    }

    const description = `${txType} ${quantity} ${asset}${spotPrice ? ` @ $${spotPrice.toFixed(2)}` : ""}`;

    const memo: string[] = [];
    if (fees) memo.push(`Fees: $${fees.toFixed(2)}`);
    if (notes) memo.push(notes);

    transactions.push({
      id: deterministicId(
        `coinbase-tx-${timestamp}-${txType}-${asset}-${quantity}-${total}`
      ),
      accountId,
      platform: "coinbase",
      date: normalizeDate(timestamp),
      description,
      amount,
      category,
      originalCategory: txType,
      memo: memo.length > 0 ? memo.join(" | ") : undefined,
    });
  }

  return transactions;
}

/**
 * Parse Coinbase balance / portfolio CSV into holdings.
 * If a dedicated balance CSV is not available, this can also derive holdings
 * from the transaction history by aggregating buys/sells per asset.
 */
export function importHoldings(csvContent: string): Holding[] {
  const skip = countLeadingNonCSVLines(csvContent);

  // Detect if this is a balance export or transaction export
  const headerLine = csvContent.trim().split(/\r?\n/)[skip] ?? "";
  const isBalanceExport =
    headerLine.includes("Balance") ||
    headerLine.includes("Spot Price") ||
    headerLine.includes("Value");

  if (isBalanceExport) {
    return parseBalanceHoldings(csvContent, skip);
  }

  return deriveHoldingsFromTransactions(csvContent, skip);
}

function parseBalanceHoldings(csvContent: string, skip: number): Holding[] {
  const rows = parseCSV<CoinbaseBalanceRow>(csvContent, { skipLines: skip });
  const holdings: Holding[] = [];
  const accountId = deterministicId("coinbase-account-crypto");

  for (const row of rows) {
    const asset = (row["Asset"] ?? row["Symbol"] ?? "").trim().toUpperCase();
    if (!asset) continue;

    const quantity = parseQuantity(row["Balance"]);
    const spotPrice = parseDollar(row["Spot Price"]);
    const value = parseDollar(row["Value"]);
    const costBasis = parseDollar(row["Cost Basis"]);
    const gainLoss = parseDollar(row["Gain/Loss"]);

    const currentValue = value || spotPrice * quantity;
    const computedGainLoss = gainLoss || (costBasis ? currentValue - costBasis : 0);
    const gainLossPercent =
      costBasis > 0 ? (computedGainLoss / costBasis) * 100 : 0;

    holdings.push({
      id: deterministicId(`coinbase-holding-${asset}`),
      accountId,
      platform: "coinbase",
      symbol: asset,
      name: asset,
      quantity,
      costBasis: costBasis || 0,
      currentPrice: spotPrice,
      currentValue,
      gainLoss: computedGainLoss,
      gainLossPercent,
      assetClass: "crypto",
      sector: cryptoSector(asset),
      lastUpdated: todayISO(),
    });
  }

  return holdings;
}

/**
 * Derive holdings from a Coinbase transaction history by aggregating per asset.
 * This is an approximation: quantities are summed, cost basis estimated from buys.
 */
function deriveHoldingsFromTransactions(
  csvContent: string,
  skip: number
): Holding[] {
  const rows = parseCSV<CoinbaseTransactionRow>(csvContent, {
    skipLines: skip,
  });
  const accountId = deterministicId("coinbase-account-crypto");

  // Accumulate per asset
  const assetMap = new Map<
    string,
    { quantity: number; totalCost: number; lastSpot: number }
  >();

  for (const row of rows) {
    const asset = (row["Asset"] ?? "").trim().toUpperCase();
    const txType = (row["Transaction Type"] ?? "").toLowerCase();
    const quantity = parseQuantity(row["Quantity Transacted"]);
    const spotPrice = parseDollar(row["Spot Price at Transaction"]);
    const total = parseDollar(
      row["Total (inclusive of fees)"] ?? row["Subtotal"]
    );

    if (!asset) continue;

    if (!assetMap.has(asset)) {
      assetMap.set(asset, { quantity: 0, totalCost: 0, lastSpot: 0 });
    }
    const entry = assetMap.get(asset)!;

    if (spotPrice) entry.lastSpot = spotPrice;

    if (
      txType === "buy" || txType === "advanced trade buy" ||
      txType === "receive" || txType === "staking income" ||
      txType === "rewards income" || txType === "learning reward"
    ) {
      entry.quantity += quantity;
      entry.totalCost += Math.abs(total);
    } else if (
      txType === "sell" || txType === "advanced trade sell" ||
      txType === "send"
    ) {
      entry.quantity -= quantity;
    } else if (txType === "convert") {
      // Convert reduces this asset's quantity
      entry.quantity -= quantity;
    }
  }

  const holdings: Holding[] = [];
  for (const [asset, data] of assetMap) {
    if (data.quantity <= 0) continue;

    const currentValue = data.lastSpot * data.quantity;
    const gainLoss = currentValue - data.totalCost;
    const gainLossPercent =
      data.totalCost > 0 ? (gainLoss / data.totalCost) * 100 : 0;

    holdings.push({
      id: deterministicId(`coinbase-holding-${asset}`),
      accountId,
      platform: "coinbase",
      symbol: asset,
      name: asset,
      quantity: data.quantity,
      costBasis: data.totalCost,
      currentPrice: data.lastSpot,
      currentValue,
      gainLoss,
      gainLossPercent,
      assetClass: "crypto",
      sector: cryptoSector(asset),
      lastUpdated: todayISO(),
    });
  }

  return holdings;
}

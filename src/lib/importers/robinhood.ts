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
  inferSubcategory,
  todayISO,
} from "./utils";

// ---------------------------------------------------------------------------
// CSV row shapes
// ---------------------------------------------------------------------------

/** Robinhood account activity / transaction history CSV */
interface RobinhoodTransactionRow {
  "Activity Date"?: string;
  "Process Date"?: string;
  "Settle Date"?: string;
  Instrument?: string;
  Description?: string;
  "Trans Code"?: string;
  Quantity?: string;
  Price?: string;
  Amount?: string;
}

/** Robinhood portfolio / positions export (some users have this format) */
interface RobinhoodPositionRow {
  Symbol?: string;
  Instrument?: string;
  Name?: string;
  Description?: string;
  Quantity?: string;
  Shares?: string;
  "Average Cost"?: string;
  "Current Price"?: string;
  Price?: string;
  "Total Return"?: string;
  "Equity"?: string;
  "Percent Change"?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function robinhoodTransCodeToCategory(
  transCode: string,
  description: string
): TransactionCategory {
  const code = transCode.toUpperCase().trim();
  const desc = description.toLowerCase();

  // Buy codes
  if (code === "BUY" || code === "BTOT" || desc.includes("buy")) {
    return "investment_buy";
  }
  // Sell codes
  if (code === "SELL" || code === "STOT" || desc.includes("sell")) {
    return "investment_sell";
  }
  // Dividends
  if (
    code === "CDIV" || code === "DIV" || code === "DFEE" ||
    desc.includes("dividend") || desc.includes("interest")
  ) {
    return "investment_dividend";
  }
  // Transfers (ACH, deposits, withdrawals)
  if (
    code === "ACH" || code === "ACATS" ||
    desc.includes("transfer") || desc.includes("deposit") ||
    desc.includes("withdrawal") || desc.includes("ach")
  ) {
    return "transfer";
  }
  // Fees
  if (
    code === "FEE" || code === "GOLD" ||
    desc.includes("fee") || desc.includes("gold subscription") ||
    desc.includes("margin")
  ) {
    return "fee";
  }
  // Stock splits, mergers, etc.
  if (
    code === "SPL" || code === "MRGS" || code === "SSP" ||
    desc.includes("split") || desc.includes("merger")
  ) {
    return "other";
  }

  return "other";
}

function inferAssetClass(symbol: string, description: string): AssetClass {
  const s = symbol.toUpperCase();
  const d = description.toLowerCase();

  // Crypto via Robinhood
  if (
    s.endsWith("USD") && s.length > 4 ||
    d.includes("crypto") || d.includes("bitcoin") ||
    d.includes("ethereum") || d.includes("dogecoin")
  ) {
    return "crypto";
  }

  // International ETFs
  if (
    d.includes("international") || d.includes("emerging") ||
    s === "VXUS" || s === "EFA" || s === "EEM" || s === "IEFA"
  ) {
    return "intl_equity";
  }

  // Bonds
  if (d.includes("bond") || d.includes("treasury") || s === "AGG" || s === "BND" || s === "TLT") {
    return "fixed_income";
  }

  // REIT
  if (d.includes("real estate") || d.includes("reit") || s === "VNQ" || s === "O") {
    return "real_estate";
  }

  return "us_equity";
}

function inferSector(symbol: string, description: string): Sector {
  const s = symbol.toUpperCase();
  const d = description.toLowerCase();

  if (d.includes("500") || d.includes("total market") || d.includes("index") || s === "SPY" || s === "VOO" || s === "VTI") {
    return "broad_market";
  }
  if (d.includes("technology") || s === "QQQ") return "technology";
  if (d.includes("semiconductor") || s === "SMH" || s === "SOXX") return "semiconductors";
  if (d.includes("health")) return "healthcare";
  if (d.includes("energy")) return "energy";
  if (d.includes("biotech")) return "biotech";
  if (d.includes("real estate") || d.includes("reit")) return "real_estate";
  if (/\bai\b/.test(d) || d.includes("artificial intelligence") || d.includes("machine learning")) return "ai_ml";

  const semiStocks = ["NVDA", "AMD", "INTC", "TSM", "AVGO", "QCOM", "MU", "MRVL", "ASML"];
  if (semiStocks.includes(s)) return "semiconductors";
  const techStocks = ["AAPL", "MSFT", "GOOGL", "GOOG", "META", "AMZN", "TSLA", "NFLX", "CRM", "ORCL", "ADBE", "PLTR", "SNOW", "NET", "CRWD"];
  if (techStocks.includes(s)) return "technology";
  const healthStocks = ["JNJ", "UNH", "PFE", "ABBV", "MRK", "LLY"];
  if (healthStocks.includes(s)) return "healthcare";
  const finStocks = ["JPM", "BAC", "WFC", "GS", "MS", "V", "MA", "SQ", "PYPL", "COIN"];
  if (finStocks.includes(s)) return "financials";

  return "other";
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Extract a single Robinhood brokerage account from CSV data.
 */
export function importAccounts(csvContent: string): Account[] {
  // Robinhood doesn't clearly delineate multiple accounts in CSV exports.
  // We create a single brokerage account. Prefer positions-CSV (Equity column sum)
  // over transactions-CSV (Amount sum) because most users export positions, and
  // Amount-sum yields 0 for a positions-only CSV.
  const posRows = parseCSV<RobinhoodPositionRow>(csvContent);
  const posEquitySum = posRows.reduce(
    (s, r) => s + parseDollar((r as { Equity?: string }).Equity ?? "0"),
    0
  );

  const balance = posEquitySum;
  if (balance === 0) {
    console.warn(
      "[robinhood.importAccounts] positions CSV has no Equity column or zero equity; " +
        "returning balance=0. Export a positions CSV (not transactions-only) for accurate balances."
    );
  }

  return [
    {
      id: deterministicId("robinhood-account-brokerage"),
      platform: "robinhood",
      accountType: "brokerage",
      name: "Robinhood Brokerage",
      balance,
      currency: "USD",
      lastUpdated: todayISO(),
    },
  ];
}

/**
 * Parse Robinhood transaction / activity CSV.
 */
export function importTransactions(csvContent: string): Transaction[] {
  const rows = parseCSV<RobinhoodTransactionRow>(csvContent);
  const transactions: Transaction[] = [];

  const accountId = deterministicId("robinhood-account-brokerage");

  for (const row of rows) {
    const activityDate = row["Activity Date"] ?? "";
    const instrument = row["Instrument"] ?? "";
    const description = row["Description"] ?? "";
    const transCode = row["Trans Code"] ?? "";
    const amount = parseDollar(row["Amount"]);
    const quantity = parseQuantity(row["Quantity"]);
    const price = parseDollar(row["Price"]);

    if (!activityDate && !transCode && !description) continue;

    const category = robinhoodTransCodeToCategory(transCode, description);
    const fullDesc = [transCode, instrument, description].filter(Boolean).join(" - ");

    const memo: string[] = [];
    if (quantity) memo.push(`Qty: ${quantity}`);
    if (price) memo.push(`Price: $${price}`);
    if (row["Settle Date"]) memo.push(`Settled: ${row["Settle Date"]}`);

    transactions.push({
      id: deterministicId(
        `robinhood-tx-${activityDate}-${transCode}-${instrument}-${amount}-${description}`
      ),
      accountId,
      platform: "robinhood",
      date: normalizeDate(activityDate),
      description: fullDesc,
      amount,
      category,
      subcategory: inferSubcategory(fullDesc),
      originalCategory: transCode,
      memo: memo.length > 0 ? memo.join(" | ") : undefined,
    });
  }

  return transactions;
}

/**
 * Parse Robinhood positions CSV into holdings.
 * Note: Robinhood positions can come from either a dedicated positions export
 * or be derived from the transaction history. This handles the positions format.
 */
export function importHoldings(csvContent: string): Holding[] {
  const rows = parseCSV<RobinhoodPositionRow>(csvContent);
  const holdings: Holding[] = [];

  const accountId = deterministicId("robinhood-account-brokerage");

  for (const row of rows) {
    const symbol = (row["Symbol"] ?? row["Instrument"] ?? "").trim().toUpperCase();
    const name = row["Name"] ?? row["Description"] ?? "";

    if (!symbol) continue;

    const quantity = parseQuantity(row["Quantity"] ?? row["Shares"]);
    const avgCost = parseDollar(row["Average Cost"]);
    const currentPrice = parseDollar(row["Current Price"] ?? row["Price"]);
    const equity = parseDollar(row["Equity"]);
    const totalReturn = parseDollar(row["Total Return"]);

    const costBasis = avgCost * quantity;
    const currentValue = equity || currentPrice * quantity;
    const gainLoss = totalReturn || (currentValue - costBasis);
    const gainLossPercent = costBasis > 0 ? (gainLoss / costBasis) * 100 : 0;

    holdings.push({
      id: deterministicId(`robinhood-holding-${symbol}`),
      accountId,
      platform: "robinhood",
      symbol,
      name: name || symbol,
      quantity,
      costBasis,
      currentPrice,
      currentValue,
      gainLoss,
      gainLossPercent,
      assetClass: inferAssetClass(symbol, name),
      sector: inferSector(symbol, name),
      lastUpdated: todayISO(),
    });
  }

  return holdings;
}

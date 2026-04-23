import type {
  Account,
  AccountType,
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
  parsePercent,
  normalizeDate,
  deterministicId,
  inferCategory,
  inferSubcategory,
  todayISO,
} from "./utils";

// ---------------------------------------------------------------------------
// CSV row shapes for Fidelity exports
// ---------------------------------------------------------------------------

/** Fidelity Positions / Holdings CSV columns */
interface FidelityPositionRow {
  "Account Name"?: string;
  "Account Number"?: string;
  Symbol?: string;
  Description?: string;
  Quantity?: string;
  "Last Price"?: string;
  "Last Price Change"?: string;
  "Current Value"?: string;
  "Today's Gain/Loss Dollar"?: string;
  "Today's Gain/Loss Percent"?: string;
  "Total Gain/Loss Dollar"?: string;
  "Total Gain/Loss Percent"?: string;
  "Percent Of Account"?: string;
  "Cost Basis Total"?: string;
  "Average Cost Basis"?: string;
  Type?: string;
}

/** Fidelity Transaction History CSV columns */
interface FidelityTransactionRow {
  "Run Date"?: string;
  Date?: string;
  Account?: string;
  "Account Name"?: string;
  Action?: string;
  Symbol?: string;
  "Security Description"?: string;
  Description?: string;
  "Security Type"?: string;
  Quantity?: string;
  Price?: string;
  Commission?: string;
  Fees?: string;
  "Accrued Interest"?: string;
  Amount?: string;
  "Settlement Date"?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function inferFidelityAccountType(name: string): AccountType {
  const n = name.toLowerCase();
  if (n.includes("roth") && n.includes("401")) return "roth_401k";
  if (n.includes("roth") && n.includes("ira")) return "roth_ira";
  if (n.includes("traditional") && n.includes("401")) return "traditional_401k";
  if (n.includes("traditional") && n.includes("ira")) return "traditional_ira";
  if (n.includes("401")) return "traditional_401k"; // most employer 401(k)s are traditional; rename the account to include "roth" to override
  if (n.includes("brokeragelink")) return "brokerage";
  if (n.includes("brokerage")) return "brokerage";
  if (n.includes("individual")) return "brokerage";
  return "other";
}

function inferAssetClass(symbol: string, description: string): AssetClass {
  const s = symbol.toUpperCase();
  const d = description.toLowerCase();

  if (
    s === "SPAXX" || s === "FDRXX" || s === "FCASH" || s === "CORE" || s === "CASH" ||
    d === "cash" || d.includes("money market") || d.includes("government cash")
  ) {
    return "cash";
  }
  if (
    d.includes("bond") || d.includes("fixed income") ||
    d.includes("treasury") || d.includes("income fund") ||
    s === "FXNAX" || s === "AGG" || s === "BND" || s === "TLT"
  ) {
    return "fixed_income";
  }
  if (
    d.includes("international") || d.includes("intl") ||
    d.includes("foreign") || d.includes("emerging") ||
    d.includes("ex-us") || d.includes("world ex") ||
    s === "FZILX" || s === "VXUS" || s === "IXUS" || s === "EFA" || s === "EEM"
  ) {
    return "intl_equity";
  }
  if (
    d.includes("real estate") || d.includes("reit") ||
    s === "VNQ" || s === "SCHH" || s === "FREL"
  ) {
    return "real_estate";
  }
  if (
    d.includes("commodity") || d.includes("gold") ||
    s === "GLD" || s === "IAU" || s === "SLV"
  ) {
    return "commodity";
  }
  return "us_equity";
}

function inferSector(symbol: string, description: string): Sector {
  const s = symbol.toUpperCase();
  const d = description.toLowerCase();

  if (d.includes("500") || d.includes("total market") || d.includes("index") || d.includes("s&p")) {
    return "broad_market";
  }
  if (d.includes("technology") || s === "QQQ" || s === "VGT" || s === "XLK") return "technology";
  if (d.includes("semiconductor") || s === "SMH" || s === "SOXX") return "semiconductors";
  if (d.includes("health") || s === "XLV" || s === "VHT") return "healthcare";
  if (d.includes("financ") || s === "XLF" || s === "VFH") return "financials";
  if (d.includes("energy") || s === "XLE" || s === "VDE") return "energy";
  if (d.includes("utilities") || s === "XLU" || s === "VPU") return "utilities";
  if (d.includes("consumer disc") || s === "XLY" || s === "VCR") return "consumer_discretionary";
  if (d.includes("consumer stap") || s === "XLP" || s === "VDC") return "consumer_staples";
  if (d.includes("industrial") || s === "XLI" || s === "VIS") return "industrials";
  if (d.includes("material") || s === "XLB" || s === "VAW") return "materials";
  if (d.includes("real estate") || d.includes("reit")) return "real_estate";
  if (d.includes("communication") || s === "XLC" || s === "VOX") return "communication_services";
  if (d.includes("biotech") || s === "XBI" || s === "IBB") return "biotech";
  if (d.includes("artificial intelligence") || d.includes("ai ") || d.includes("machine learning")) return "ai_ml";
  if (d.includes("quantum")) return "quantum_computing";

  // Individual large-cap stocks
  const techStocks = ["AAPL", "MSFT", "GOOGL", "GOOG", "META", "AMZN", "NVDA", "TSLA", "NFLX", "CRM", "ORCL", "ADBE", "INTC", "AMD"];
  if (techStocks.includes(s)) return "technology";

  const healthStocks = ["JNJ", "UNH", "PFE", "ABBV", "MRK", "LLY", "TMO", "ABT"];
  if (healthStocks.includes(s)) return "healthcare";

  const finStocks = ["JPM", "BAC", "WFC", "GS", "MS", "BRK.A", "BRK.B", "V", "MA"];
  if (finStocks.includes(s)) return "financials";

  return "other";
}

function fidelityActionToCategory(action: string): TransactionCategory {
  const a = action.toLowerCase();
  if (a.includes("bought") || a.includes("buy") || a.includes("purchase") || a.includes("reinvestment")) {
    return "investment_buy";
  }
  if (a.includes("sold") || a.includes("sell") || a.includes("redemption")) {
    return "investment_sell";
  }
  if (a.includes("dividend") || a.includes("interest") || a.includes("capital gain") || a.includes("distribution")) {
    return "investment_dividend";
  }
  if (a.includes("transfer") || a.includes("contribution") || a.includes("rollover")) {
    return "transfer";
  }
  if (a.includes("fee") || a.includes("commission")) {
    return "fee";
  }
  return "other";
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse Fidelity Positions CSV and extract unique accounts.
 */
export function importAccounts(csvContent: string): Account[] {
  const rows = parseCSV<FidelityPositionRow>(csvContent);
  const accountMap = new Map<string, Account>();

  for (const row of rows) {
    const name = row["Account Name"] ?? "";
    const acctNum = row["Account Number"] ?? "";
    if (!name && !acctNum) continue;

    const key = acctNum || name;
    if (accountMap.has(key)) {
      // Accumulate balance
      const existing = accountMap.get(key)!;
      existing.balance += parseDollar(row["Current Value"]);
      continue;
    }

    accountMap.set(key, {
      id: deterministicId(`fidelity-account-${key}`),
      platform: "fidelity",
      accountType: inferFidelityAccountType(name),
      name: name || `Fidelity ${acctNum}`,
      balance: parseDollar(row["Current Value"]),
      currency: "USD",
      lastUpdated: todayISO(),
    });
  }

  return Array.from(accountMap.values());
}

/**
 * Parse Fidelity Transaction History CSV.
 */
export function importTransactions(csvContent: string): Transaction[] {
  const rows = parseCSV<FidelityTransactionRow>(csvContent);
  const transactions: Transaction[] = [];

  for (const row of rows) {
    const date = row["Run Date"] ?? row["Date"] ?? "";
    const action = row["Action"] ?? "";
    const symbol = row["Symbol"] ?? "";
    const description = row["Security Description"] ?? row["Description"] ?? "";
    const amount = parseDollar(row["Amount"]);
    const acctName = row["Account"] ?? row["Account Name"] ?? "";

    if (!date && !action && !amount) continue;

    const accountId = deterministicId(
      `fidelity-account-${acctName}`
    );

    const category = fidelityActionToCategory(action);
    const fullDesc = [action, symbol, description].filter(Boolean).join(" - ");

    transactions.push({
      id: deterministicId(
        `fidelity-tx-${date}-${action}-${symbol}-${amount}-${description}`
      ),
      accountId,
      platform: "fidelity",
      date: normalizeDate(date),
      description: fullDesc,
      amount,
      category,
      subcategory: inferSubcategory(fullDesc),
      originalCategory: action,
      memo: row["Settlement Date"]
        ? `Settlement: ${row["Settlement Date"]}`
        : undefined,
    });
  }

  return transactions;
}

/**
 * Parse Fidelity Positions CSV into holdings.
 */
export function importHoldings(csvContent: string): Holding[] {
  const rows = parseCSV<FidelityPositionRow>(csvContent);
  const holdings: Holding[] = [];

  for (const row of rows) {
    const symbol = (row["Symbol"] ?? "").replace(/[*+]/g, "").trim();
    const description = row["Description"] ?? "";
    const quantity = parseQuantity(row["Quantity"]);
    const currentValue = parseDollar(row["Current Value"]);
    const acctName = row["Account Name"] ?? "";

    // Skip empty rows, cash summary rows with no symbol, and totals
    if (!symbol || symbol.toLowerCase() === "pending activity") continue;

    const currentPrice = parseDollar(row["Last Price"]);
    const costBasis = parseDollar(row["Cost Basis Total"]);
    const gainLoss = parseDollar(row["Total Gain/Loss Dollar"]);
    const gainLossPercent = parsePercent(row["Total Gain/Loss Percent"]);

    const accountId = deterministicId(`fidelity-account-${acctName}`);

    holdings.push({
      id: deterministicId(
        `fidelity-holding-${acctName}-${symbol}`
      ),
      accountId,
      platform: "fidelity",
      symbol,
      name: description || symbol,
      quantity,
      costBasis,
      currentPrice,
      currentValue,
      gainLoss,
      gainLossPercent,
      assetClass: inferAssetClass(symbol, description),
      sector: inferSector(symbol, description),
      lastUpdated: todayISO(),
    });
  }

  return holdings;
}

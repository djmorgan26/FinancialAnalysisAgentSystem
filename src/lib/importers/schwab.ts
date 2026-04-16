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
// CSV row shapes
// ---------------------------------------------------------------------------

/** Schwab Positions CSV */
interface SchwabPositionRow {
  Symbol?: string;
  Description?: string;
  Quantity?: string;
  Price?: string;
  "Price Change $"?: string;
  "Price Change %"?: string;
  "Market Value"?: string;
  "Day Change $"?: string;
  "Day Change %"?: string;
  "Cost Basis"?: string;
  "Gain/Loss $"?: string;
  "Gain/Loss %"?: string;
  Ratings?: string;
  "Reinvest Dividends?"?: string;
  "Capital Gains?"?: string;
  "% Of Account"?: string;
  "Security Type"?: string;
}

/** Schwab Transaction History CSV */
interface SchwabTransactionRow {
  Date?: string;
  Action?: string;
  Symbol?: string;
  Description?: string;
  Quantity?: string;
  Price?: string;
  "Fees & Comm"?: string;
  Amount?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Schwab CSVs sometimes include a header line like
 *   "Positions for account XXXX-1234 as of 04/15/2026"
 * or "Transactions for account ...".
 * We detect and skip those leading lines.
 */
function countLeadingNonCSVLines(content: string): number {
  const lines = content.trim().split(/\r?\n/);
  let skip = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    // Schwab header lines typically start with a descriptive phrase, not a quoted CSV header
    if (
      trimmed === "" ||
      /^"?(Positions|Transactions|Account) /i.test(trimmed)
    ) {
      skip++;
    } else {
      break;
    }
  }
  return skip;
}

function inferSchwabAccountType(
  accountLabel: string,
  csvContent: string
): AccountType {
  const label = accountLabel.toLowerCase();
  const content = csvContent.toLowerCase();

  if (label.includes("roth ira") || content.includes("roth ira")) return "roth_ira";
  if (label.includes("roth") && label.includes("401")) return "roth_401k";
  if (label.includes("traditional ira") || content.includes("traditional ira"))
    return "traditional_ira";
  if (label.includes("401")) return "traditional_401k";
  if (label.includes("savings") || label.includes("high yield") || content.includes("savings"))
    return "savings";
  if (label.includes("checking")) return "checking";
  if (
    label.includes("brokerage") ||
    label.includes("individual") ||
    content.includes("brokerage")
  ) {
    return "brokerage";
  }
  return "brokerage";
}

function extractSchwabAccountLabel(csvContent: string): string {
  const firstLine = csvContent.trim().split(/\r?\n/)[0] ?? "";
  // e.g. "Positions for account Roth IRA XXXX-1234 as of ..."
  const match = firstLine.match(
    /(?:Positions|Transactions)\s+for\s+account\s+(.+?)(?:\s+as of|\s*$)/i
  );
  return match ? match[1].trim() : "Schwab Account";
}

function inferAssetClass(symbol: string, description: string): AssetClass {
  const s = symbol.toUpperCase();
  const d = description.toLowerCase();

  if (
    s === "SWVXX" || s === "SNVXX" || s === "SNSXX" ||
    d.includes("money market") || d.includes("cash") || s === "CASH"
  ) {
    return "cash";
  }
  if (
    d.includes("bond") || d.includes("fixed income") ||
    d.includes("treasury") || d.includes("aggregate") ||
    s === "SCHZ" || s === "AGG" || s === "BND"
  ) {
    return "fixed_income";
  }
  if (
    d.includes("international") || d.includes("intl") ||
    d.includes("foreign") || d.includes("emerging") ||
    s === "SCHF" || s === "SCHE" || s === "VXUS" || s === "SWISX"
  ) {
    return "intl_equity";
  }
  if (d.includes("real estate") || d.includes("reit") || s === "SCHH") {
    return "real_estate";
  }
  if (d.includes("commodity") || d.includes("gold") || s === "GLD") {
    return "commodity";
  }
  return "us_equity";
}

function inferSector(symbol: string, description: string): Sector {
  const s = symbol.toUpperCase();
  const d = description.toLowerCase();

  if (d.includes("500") || d.includes("total") || d.includes("broad") || d.includes("index")) {
    return "broad_market";
  }
  if (d.includes("technology") || s === "SCHG" || s === "QQQ") return "technology";
  if (d.includes("semiconductor") || s === "SOXX" || s === "SMH") return "semiconductors";
  if (d.includes("health") || s === "XLV") return "healthcare";
  if (d.includes("financ") || s === "XLF") return "financials";
  if (d.includes("energy") || s === "XLE") return "energy";
  if (d.includes("real estate") || d.includes("reit")) return "real_estate";
  if (d.includes("biotech")) return "biotech";

  const techStocks = ["AAPL", "MSFT", "GOOGL", "GOOG", "META", "AMZN", "NVDA", "TSLA", "NFLX", "CRM", "ORCL", "ADBE", "INTC", "AMD"];
  if (techStocks.includes(s)) return "technology";
  const healthStocks = ["JNJ", "UNH", "PFE", "ABBV", "MRK", "LLY"];
  if (healthStocks.includes(s)) return "healthcare";
  const finStocks = ["JPM", "BAC", "WFC", "GS", "MS", "V", "MA"];
  if (finStocks.includes(s)) return "financials";

  return "other";
}

function schwabActionToCategory(action: string): TransactionCategory {
  const a = action.toLowerCase();
  if (a.includes("buy") || a.includes("reinvest shares")) return "investment_buy";
  if (a.includes("sell")) return "investment_sell";
  if (
    a.includes("dividend") || a.includes("interest") ||
    a.includes("capital gain") || a.includes("qual div") ||
    a.includes("cash div") || a.includes("reinvest dividend")
  ) {
    return "investment_dividend";
  }
  if (
    a.includes("transfer") || a.includes("journal") ||
    a.includes("wire") || a.includes("moneylink") ||
    a.includes("ach") || a.includes("contribution")
  ) {
    return "transfer";
  }
  if (a.includes("fee") || a.includes("commission") || a.includes("adj")) return "fee";
  return "other";
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse Schwab Positions CSV and extract unique accounts.
 */
export function importAccounts(csvContent: string): Account[] {
  const label = extractSchwabAccountLabel(csvContent);
  const skip = countLeadingNonCSVLines(csvContent);
  const rows = parseCSV<SchwabPositionRow>(csvContent, { skipLines: skip });

  let totalValue = 0;
  for (const row of rows) {
    const val = parseDollar(row["Market Value"]);
    if (val) totalValue += val;
  }

  const accountType = inferSchwabAccountType(label, csvContent);

  return [
    {
      id: deterministicId(`schwab-account-${label}`),
      platform: "schwab",
      accountType,
      name: label,
      balance: totalValue,
      currency: "USD",
      lastUpdated: todayISO(),
    },
  ];
}

/**
 * Parse Schwab Transaction History CSV.
 */
export function importTransactions(csvContent: string): Transaction[] {
  const label = extractSchwabAccountLabel(csvContent);
  const skip = countLeadingNonCSVLines(csvContent);
  const rows = parseCSV<SchwabTransactionRow>(csvContent, { skipLines: skip });
  const transactions: Transaction[] = [];

  const accountId = deterministicId(`schwab-account-${label}`);

  for (const row of rows) {
    const date = row["Date"] ?? "";
    const action = row["Action"] ?? "";
    const symbol = row["Symbol"] ?? "";
    const description = row["Description"] ?? "";
    const amount = parseDollar(row["Amount"]);

    // Skip rows that appear to be totals or empty
    if (!date && !action) continue;
    if (date.toLowerCase().includes("total")) continue;

    const category = schwabActionToCategory(action);
    const fullDesc = [action, symbol, description].filter(Boolean).join(" - ");

    transactions.push({
      id: deterministicId(
        `schwab-tx-${date}-${action}-${symbol}-${amount}-${description}`
      ),
      accountId,
      platform: "schwab",
      date: normalizeDate(date),
      description: fullDesc,
      amount,
      category,
      subcategory: inferSubcategory(fullDesc),
      originalCategory: action,
    });
  }

  return transactions;
}

/**
 * Parse Schwab Positions CSV into holdings.
 */
export function importHoldings(csvContent: string): Holding[] {
  const label = extractSchwabAccountLabel(csvContent);
  const skip = countLeadingNonCSVLines(csvContent);
  const rows = parseCSV<SchwabPositionRow>(csvContent, { skipLines: skip });
  const holdings: Holding[] = [];

  const accountId = deterministicId(`schwab-account-${label}`);

  for (const row of rows) {
    const symbol = (row["Symbol"] ?? "").replace(/[*+]/g, "").trim();
    const description = row["Description"] ?? "";

    // Skip empty, totals, or account total rows
    if (
      !symbol ||
      symbol.toLowerCase() === "account total" ||
      description.toLowerCase().includes("account total")
    ) {
      continue;
    }

    const quantity = parseQuantity(row["Quantity"]);
    const currentPrice = parseDollar(row["Price"]);
    const currentValue = parseDollar(row["Market Value"]);
    const costBasis = parseDollar(row["Cost Basis"]);
    const gainLoss = parseDollar(row["Gain/Loss $"]);
    const gainLossPercent = parsePercent(row["Gain/Loss %"]);

    holdings.push({
      id: deterministicId(`schwab-holding-${label}-${symbol}`),
      accountId,
      platform: "schwab",
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

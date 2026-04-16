import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import { v4 as uuidv4 } from "uuid";
import { loadFinancialData, saveFinancialData } from "@/lib/data-store";
import type {
  Platform,
  Account,
  Transaction,
  Holding,
  TransactionCategory,
  AccountType,
  AssetClass,
  Sector,
} from "@/lib/types";

const SUPPORTED_PLATFORMS: Platform[] = [
  "fidelity",
  "schwab",
  "robinhood",
  "coinbase",
  "chase",
  "citi",
  "manual",
];

/**
 * POST /api/import
 *
 * Accepts a multipart FormData upload with:
 *   - file: CSV file
 *   - platform: one of the supported Platform values
 *
 * Parses the CSV, normalizes rows into the unified schema, merges with
 * existing data, and persists the result.
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const platform = formData.get("platform") as string | null;

    // --- Validation ---
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "Missing or invalid 'file' field. Expected a CSV file." },
        { status: 400 },
      );
    }

    if (!platform || !SUPPORTED_PLATFORMS.includes(platform as Platform)) {
      return NextResponse.json(
        {
          error: `Invalid 'platform'. Must be one of: ${SUPPORTED_PLATFORMS.join(", ")}`,
        },
        { status: 400 },
      );
    }

    if (!file.name.endsWith(".csv")) {
      return NextResponse.json(
        { error: "Only CSV files are supported." },
        { status: 400 },
      );
    }

    // --- Parse CSV ---
    const csvText = await file.text();
    const { data: rows, errors } = Papa.parse<Record<string, string>>(
      csvText,
      {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h: string) => h.trim(),
      },
    );

    if (errors.length > 0 && rows.length === 0) {
      return NextResponse.json(
        { error: "Failed to parse CSV", details: errors.slice(0, 5) },
        { status: 400 },
      );
    }

    // --- Normalize ---
    const importer = getImporter(platform as Platform);
    const imported = importer(rows, platform as Platform);

    // --- Merge into existing data ---
    const existing = await loadFinancialData();
    const merged = mergeData(existing, imported);
    await saveFinancialData(merged);

    return NextResponse.json({
      success: true,
      platform,
      imported: {
        accounts: imported.accounts.length,
        transactions: imported.transactions.length,
        holdings: imported.holdings.length,
      },
      totals: {
        accounts: merged.accounts.length,
        transactions: merged.transactions.length,
        holdings: merged.holdings.length,
      },
    });
  } catch (error) {
    console.error("[POST /api/import] Import failed:", error);
    return NextResponse.json(
      { error: "Import failed", detail: String(error) },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// Import result container
// ---------------------------------------------------------------------------

interface ImportResult {
  accounts: Account[];
  transactions: Transaction[];
  holdings: Holding[];
}

// ---------------------------------------------------------------------------
// Platform importers
// ---------------------------------------------------------------------------

type Importer = (
  rows: Record<string, string>[],
  platform: Platform,
) => ImportResult;

function getImporter(platform: Platform): Importer {
  switch (platform) {
    case "chase":
      return importChase;
    case "citi":
      return importCiti;
    case "fidelity":
      return importFidelity;
    case "schwab":
      return importSchwab;
    case "robinhood":
      return importRobinhood;
    case "coinbase":
      return importCoinbase;
    case "manual":
      return importManual;
    default:
      return importManual;
  }
}

// --- Chase (credit card / checking transactions) ---
function importChase(
  rows: Record<string, string>[],
  platform: Platform,
): ImportResult {
  const accountId = `chase-${uuidv4().slice(0, 8)}`;
  const transactions: Transaction[] = rows
    .filter((r) => r["Transaction Date"] || r["Posting Date"] || r["Date"])
    .map((r) => ({
      id: uuidv4(),
      accountId,
      platform,
      date: normalizeDate(
        r["Transaction Date"] ?? r["Posting Date"] ?? r["Date"] ?? "",
      ),
      description: r["Description"] ?? r["Memo"] ?? "",
      amount: parseAmount(r["Amount"] ?? "0"),
      category: categorize(r["Category"] ?? r["Type"] ?? "", r["Description"] ?? ""),
      originalCategory: r["Category"] ?? r["Type"] ?? undefined,
      memo: r["Memo"] ?? undefined,
    }));

  const account = inferAccount(accountId, platform, transactions);
  return { accounts: account ? [account] : [], transactions, holdings: [] };
}

// --- Citi (credit card transactions) ---
function importCiti(
  rows: Record<string, string>[],
  platform: Platform,
): ImportResult {
  const accountId = `citi-${uuidv4().slice(0, 8)}`;
  const transactions: Transaction[] = rows
    .filter((r) => r["Date"] || r["Status"])
    .map((r) => ({
      id: uuidv4(),
      accountId,
      platform,
      date: normalizeDate(r["Date"] ?? ""),
      description: r["Description"] ?? "",
      amount: parseAmount(r["Debit"] ?? "0") * -1 || parseAmount(r["Credit"] ?? "0"),
      category: categorize("", r["Description"] ?? ""),
      originalCategory: undefined,
      memo: r["Member Name"] ?? undefined,
    }));

  const account = inferAccount(accountId, platform, transactions);
  return { accounts: account ? [account] : [], transactions, holdings: [] };
}

// --- Fidelity (positions / transactions) ---
function importFidelity(
  rows: Record<string, string>[],
  platform: Platform,
): ImportResult {
  // Detect whether this is a positions export or a transactions export
  const isPositions = rows.some(
    (r) => r["Symbol"] && (r["Current Value"] || r["Quantity"]),
  );

  if (isPositions) {
    return importFidelityPositions(rows, platform);
  }
  return importFidelityTransactions(rows, platform);
}

function importFidelityPositions(
  rows: Record<string, string>[],
  platform: Platform,
): ImportResult {
  const accountId = `fidelity-${uuidv4().slice(0, 8)}`;
  const holdings: Holding[] = rows
    .filter((r) => r["Symbol"] && r["Symbol"] !== "Pending Activity")
    .map((r) => ({
      id: uuidv4(),
      accountId,
      platform,
      symbol: r["Symbol"]?.trim() ?? "",
      name: r["Description"] ?? r["Security Name"] ?? "",
      quantity: parseAmount(r["Quantity"] ?? r["Shares"] ?? "0"),
      costBasis: parseAmount(r["Cost Basis Total"] ?? r["Cost Basis"] ?? "0"),
      currentPrice: parseAmount(
        r["Last Price"] ?? r["Current Price"] ?? "0",
      ),
      currentValue: parseAmount(r["Current Value"] ?? r["Market Value"] ?? "0"),
      gainLoss: parseAmount(r["Gain/Loss Dollar"] ?? r["Total Gain/Loss Dollar"] ?? "0"),
      gainLossPercent: parseAmount(
        r["Gain/Loss Percent"] ?? r["Total Gain/Loss Percent"] ?? "0",
      ),
      assetClass: classifyAsset(r["Symbol"] ?? "", r["Type"] ?? ""),
      sector: classifySector(r["Symbol"] ?? ""),
      lastUpdated: new Date().toISOString(),
    }));

  const totalValue = holdings.reduce((s, h) => s + h.currentValue, 0);
  const account: Account = {
    id: accountId,
    platform,
    accountType: "brokerage",
    name: rows[0]?.["Account Name"] ?? rows[0]?.["Account Number"] ?? "Fidelity Account",
    balance: totalValue,
    currency: "USD",
    lastUpdated: new Date().toISOString(),
  };

  return { accounts: [account], transactions: [], holdings };
}

function importFidelityTransactions(
  rows: Record<string, string>[],
  platform: Platform,
): ImportResult {
  const accountId = `fidelity-${uuidv4().slice(0, 8)}`;
  const transactions: Transaction[] = rows
    .filter((r) => r["Run Date"] || r["Date"] || r["Settlement Date"])
    .map((r) => ({
      id: uuidv4(),
      accountId,
      platform,
      date: normalizeDate(
        r["Run Date"] ?? r["Date"] ?? r["Settlement Date"] ?? "",
      ),
      description:
        r["Action"] ?? r["Description"] ?? r["Transaction Type"] ?? "",
      amount: parseAmount(r["Amount"] ?? r["Price"] ?? "0"),
      category: categorizeBrokerage(r["Action"] ?? r["Transaction Type"] ?? ""),
      originalCategory: r["Action"] ?? r["Transaction Type"] ?? undefined,
      memo: r["Symbol"] ?? undefined,
    }));

  const account = inferAccount(accountId, platform, transactions);
  return { accounts: account ? [account] : [], transactions, holdings: [] };
}

// --- Schwab (similar to Fidelity) ---
function importSchwab(
  rows: Record<string, string>[],
  platform: Platform,
): ImportResult {
  const isPositions = rows.some(
    (r) => r["Symbol"] && (r["Market Value"] || r["Quantity"]),
  );

  if (isPositions) {
    const accountId = `schwab-${uuidv4().slice(0, 8)}`;
    const holdings: Holding[] = rows
      .filter((r) => r["Symbol"] && r["Symbol"] !== "--")
      .map((r) => ({
        id: uuidv4(),
        accountId,
        platform,
        symbol: r["Symbol"]?.trim() ?? "",
        name: r["Description"] ?? r["Name"] ?? "",
        quantity: parseAmount(r["Quantity"] ?? r["Shares"] ?? "0"),
        costBasis: parseAmount(r["Cost Basis"] ?? "0"),
        currentPrice: parseAmount(r["Price"] ?? r["Last Price"] ?? "0"),
        currentValue: parseAmount(r["Market Value"] ?? "0"),
        gainLoss: parseAmount(r["Gain/Loss $"] ?? r["Day Change $"] ?? "0"),
        gainLossPercent: parseAmount(r["Gain/Loss %"] ?? r["Day Change %"] ?? "0"),
        assetClass: classifyAsset(r["Symbol"] ?? "", r["Security Type"] ?? ""),
        sector: classifySector(r["Symbol"] ?? ""),
        lastUpdated: new Date().toISOString(),
      }));

    const totalValue = holdings.reduce((s, h) => s + h.currentValue, 0);
    const account: Account = {
      id: accountId,
      platform,
      accountType: "brokerage",
      name: rows[0]?.["Account"] ?? "Schwab Account",
      balance: totalValue,
      currency: "USD",
      lastUpdated: new Date().toISOString(),
    };
    return { accounts: [account], transactions: [], holdings };
  }

  // Transaction export
  const accountId = `schwab-${uuidv4().slice(0, 8)}`;
  const transactions: Transaction[] = rows
    .filter((r) => r["Date"])
    .map((r) => ({
      id: uuidv4(),
      accountId,
      platform,
      date: normalizeDate(r["Date"] ?? ""),
      description: r["Description"] ?? r["Action"] ?? "",
      amount: parseAmount(r["Amount"] ?? "0"),
      category: categorizeBrokerage(r["Action"] ?? r["Type"] ?? ""),
      originalCategory: r["Action"] ?? r["Type"] ?? undefined,
      memo: r["Symbol"] ?? undefined,
    }));

  const account = inferAccount(accountId, platform, transactions);
  return { accounts: account ? [account] : [], transactions, holdings: [] };
}

// --- Robinhood ---
function importRobinhood(
  rows: Record<string, string>[],
  platform: Platform,
): ImportResult {
  const isPositions = rows.some(
    (r) => r["Instrument"] || (r["Symbol"] && r["Equity"]),
  );

  if (isPositions) {
    const accountId = `robinhood-${uuidv4().slice(0, 8)}`;
    const holdings: Holding[] = rows
      .filter((r) => (r["Instrument"] || r["Symbol"]))
      .map((r) => ({
        id: uuidv4(),
        accountId,
        platform,
        symbol: (r["Symbol"] ?? r["Instrument"] ?? "").trim(),
        name: r["Name"] ?? r["Instrument"] ?? "",
        quantity: parseAmount(r["Quantity"] ?? r["Shares"] ?? "0"),
        costBasis: parseAmount(r["Average Cost"] ?? r["Cost Basis"] ?? "0"),
        currentPrice: parseAmount(r["Current Price"] ?? r["Last Price"] ?? "0"),
        currentValue: parseAmount(r["Equity"] ?? r["Market Value"] ?? "0"),
        gainLoss: parseAmount(r["Total Return"] ?? "0"),
        gainLossPercent: parseAmount(r["Percent Return"] ?? "0"),
        assetClass: classifyAsset(r["Symbol"] ?? r["Instrument"] ?? "", ""),
        sector: classifySector(r["Symbol"] ?? r["Instrument"] ?? ""),
        lastUpdated: new Date().toISOString(),
      }));

    const totalValue = holdings.reduce((s, h) => s + h.currentValue, 0);
    const account: Account = {
      id: accountId,
      platform,
      accountType: "brokerage",
      name: "Robinhood Brokerage",
      balance: totalValue,
      currency: "USD",
      lastUpdated: new Date().toISOString(),
    };
    return { accounts: [account], transactions: [], holdings };
  }

  const accountId = `robinhood-${uuidv4().slice(0, 8)}`;
  const transactions: Transaction[] = rows
    .filter((r) => r["Activity Date"] || r["Date"])
    .map((r) => ({
      id: uuidv4(),
      accountId,
      platform,
      date: normalizeDate(r["Activity Date"] ?? r["Date"] ?? ""),
      description: r["Description"] ?? r["Trans Code"] ?? "",
      amount: parseAmount(r["Amount"] ?? r["Price"] ?? "0"),
      category: categorizeBrokerage(r["Trans Code"] ?? r["Description"] ?? ""),
      originalCategory: r["Trans Code"] ?? undefined,
      memo: r["Instrument"] ?? undefined,
    }));

  const account = inferAccount(accountId, platform, transactions);
  return { accounts: account ? [account] : [], transactions, holdings: [] };
}

// --- Coinbase ---
function importCoinbase(
  rows: Record<string, string>[],
  platform: Platform,
): ImportResult {
  const accountId = `coinbase-${uuidv4().slice(0, 8)}`;

  // Coinbase exports can be transaction history
  const isHoldings = rows.some((r) => r["Asset"] && r["Balance"]);

  if (isHoldings) {
    const holdings: Holding[] = rows
      .filter((r) => r["Asset"] && parseAmount(r["Balance"] ?? "0") > 0)
      .map((r) => ({
        id: uuidv4(),
        accountId,
        platform,
        symbol: r["Asset"] ?? "",
        name: r["Name"] ?? r["Asset"] ?? "",
        quantity: parseAmount(r["Balance"] ?? r["Quantity"] ?? "0"),
        costBasis: parseAmount(r["Cost Basis"] ?? "0"),
        currentPrice: parseAmount(r["Spot Price"] ?? r["Price"] ?? "0"),
        currentValue: parseAmount(r["Value"] ?? r["Native Value"] ?? "0"),
        gainLoss: parseAmount(r["Gain"] ?? "0"),
        gainLossPercent: 0,
        assetClass: "crypto" as const,
        sector: "crypto" as const,
        lastUpdated: new Date().toISOString(),
      }));

    const totalValue = holdings.reduce((s, h) => s + h.currentValue, 0);
    const account: Account = {
      id: accountId,
      platform,
      accountType: "crypto",
      name: "Coinbase",
      balance: totalValue,
      currency: "USD",
      lastUpdated: new Date().toISOString(),
    };
    return { accounts: [account], transactions: [], holdings };
  }

  const transactions: Transaction[] = rows
    .filter((r) => r["Timestamp"] || r["Date"])
    .map((r) => ({
      id: uuidv4(),
      accountId,
      platform,
      date: normalizeDate(r["Timestamp"] ?? r["Date"] ?? ""),
      description: `${r["Transaction Type"] ?? r["Type"] ?? ""} ${r["Asset"] ?? ""}`.trim(),
      amount: parseAmount(
        r["Quantity Transacted"] ??
          r["Total (inclusive of fees and/or spread)"] ??
          r["Amount"] ??
          "0",
      ),
      category: categorizeCrypto(r["Transaction Type"] ?? r["Type"] ?? ""),
      originalCategory: r["Transaction Type"] ?? r["Type"] ?? undefined,
      memo: r["Notes"] ?? undefined,
    }));

  const account: Account = {
    id: accountId,
    platform,
    accountType: "crypto",
    name: "Coinbase",
    balance: 0,
    currency: "USD",
    lastUpdated: new Date().toISOString(),
  };

  return { accounts: [account], transactions, holdings: [] };
}

// --- Manual / generic ---
function importManual(
  rows: Record<string, string>[],
  platform: Platform,
): ImportResult {
  const accountId = `manual-${uuidv4().slice(0, 8)}`;
  const transactions: Transaction[] = rows.map((r) => ({
    id: uuidv4(),
    accountId,
    platform,
    date: normalizeDate(
      r["date"] ?? r["Date"] ?? r["DATE"] ?? new Date().toISOString(),
    ),
    description:
      r["description"] ?? r["Description"] ?? r["memo"] ?? r["Memo"] ?? "",
    amount: parseAmount(
      r["amount"] ?? r["Amount"] ?? r["AMOUNT"] ?? "0",
    ),
    category: categorize(
      r["category"] ?? r["Category"] ?? "",
      r["description"] ?? r["Description"] ?? "",
    ),
    originalCategory: r["category"] ?? r["Category"] ?? undefined,
    memo: r["memo"] ?? r["Memo"] ?? r["notes"] ?? r["Notes"] ?? undefined,
  }));

  const account = inferAccount(accountId, platform, transactions);
  return { accounts: account ? [account] : [], transactions, holdings: [] };
}

// ---------------------------------------------------------------------------
// Merge logic
// ---------------------------------------------------------------------------

function mergeData(
  existing: import("@/lib/types").FinancialData,
  imported: ImportResult,
): import("@/lib/types").FinancialData {
  // De-duplicate accounts by platform + name
  const accountKey = (a: Account) => `${a.platform}:${a.name}`;
  const existingAccountKeys = new Set(existing.accounts.map(accountKey));
  const newAccounts = imported.accounts.filter(
    (a) => !existingAccountKeys.has(accountKey(a)),
  );

  // For holdings, replace all holdings for matching accounts (fresh snapshot)
  const importedAccountIds = new Set(imported.accounts.map((a) => a.id));
  const keptHoldings = existing.holdings.filter(
    (h) => !importedAccountIds.has(h.accountId),
  );

  return {
    lastUpdated: new Date().toISOString(),
    accounts: [...existing.accounts, ...newAccounts],
    transactions: [...existing.transactions, ...imported.transactions],
    holdings: [...keptHoldings, ...imported.holdings],
  };
}

// ---------------------------------------------------------------------------
// Classification helpers
// ---------------------------------------------------------------------------

function categorize(
  rawCategory: string,
  description: string,
): TransactionCategory {
  const cat = rawCategory.toLowerCase();
  const desc = description.toLowerCase();

  if (cat.includes("income") || cat.includes("payroll") || cat.includes("salary"))
    return "income";
  if (cat.includes("rent") || cat.includes("mortgage")) return "rent";
  if (cat.includes("utilit")) return "utilities";
  if (cat.includes("insurance")) return "insurance";
  if (cat.includes("food") || cat.includes("grocer") || cat.includes("restaurant") || cat.includes("dining"))
    return "food";
  if (cat.includes("transport") || cat.includes("gas") || cat.includes("auto") || cat.includes("parking"))
    return "transportation";
  if (cat.includes("health") || cat.includes("medical") || cat.includes("pharmacy"))
    return "healthcare";
  if (cat.includes("subscri") || cat.includes("streaming")) return "subscriptions";
  if (cat.includes("entertain")) return "entertainment";
  if (cat.includes("shop") || cat.includes("merch")) return "shopping";
  if (cat.includes("fee")) return "fee";
  if (cat.includes("transfer") || cat.includes("payment")) return "transfer";

  // Fall back to description-based classification
  if (desc.includes("payroll") || desc.includes("direct dep") || desc.includes("salary"))
    return "income";
  if (desc.includes("rent") || desc.includes("mortgage")) return "rent";
  if (desc.includes("electric") || desc.includes("water") || desc.includes("gas bill") || desc.includes("internet"))
    return "utilities";
  if (desc.includes("uber") || desc.includes("lyft") || desc.includes("gas station"))
    return "transportation";
  if (desc.includes("grocery") || desc.includes("restaurant") || desc.includes("doordash") || desc.includes("grubhub"))
    return "food";
  if (desc.includes("netflix") || desc.includes("spotify") || desc.includes("hulu") || desc.includes("apple.com/bill"))
    return "subscriptions";
  if (desc.includes("amazon") || desc.includes("target") || desc.includes("walmart"))
    return "shopping";
  if (desc.includes("transfer") || desc.includes("zelle") || desc.includes("venmo"))
    return "transfer";

  return "other";
}

function categorizeBrokerage(action: string): TransactionCategory {
  const a = action.toLowerCase();
  if (a.includes("buy") || a.includes("bought")) return "investment_buy";
  if (a.includes("sell") || a.includes("sold")) return "investment_sell";
  if (a.includes("dividend") || a.includes("div")) return "investment_dividend";
  if (a.includes("fee") || a.includes("commission")) return "fee";
  if (a.includes("transfer") || a.includes("deposit") || a.includes("withdrawal"))
    return "transfer";
  return "other";
}

function categorizeCrypto(type: string): TransactionCategory {
  const t = type.toLowerCase();
  if (t.includes("buy") || t.includes("receive") || t.includes("advanced trade buy"))
    return "investment_buy";
  if (t.includes("sell") || t.includes("send") || t.includes("advanced trade sell"))
    return "investment_sell";
  if (t.includes("reward") || t.includes("earn") || t.includes("staking"))
    return "investment_dividend";
  if (t.includes("fee")) return "fee";
  if (t.includes("convert")) return "transfer";
  return "other";
}

function classifyAsset(symbol: string, type: string): AssetClass {
  const s = symbol.toUpperCase();
  const t = type.toLowerCase();

  // Crypto
  const cryptoSymbols = new Set([
    "BTC", "ETH", "SOL", "ADA", "DOT", "MATIC", "AVAX", "LINK",
    "DOGE", "XRP", "BNB", "UNI", "AAVE", "ATOM",
  ]);
  if (cryptoSymbols.has(s) || t.includes("crypto")) return "crypto";

  // Fixed income
  if (s.includes("BOND") || s.includes("AGG") || s.includes("BND") || t.includes("bond") || t.includes("fixed"))
    return "fixed_income";

  // Cash equivalents
  if (s.includes("SPAXX") || s.includes("VMFXX") || s === "CASH" || t.includes("money market"))
    return "cash";

  // International
  if (s.includes("VXUS") || s.includes("EFA") || s.includes("EEM") || s.includes("IXUS") || t.includes("international"))
    return "intl_equity";

  // Commodities
  if (s.includes("GLD") || s.includes("SLV") || s.includes("IAU") || t.includes("commodity"))
    return "commodity";

  // Real estate
  if (s.includes("VNQ") || s.includes("REIT") || t.includes("real estate"))
    return "real_estate";

  // Default to US equity
  return "us_equity";
}

function classifySector(symbol: string): Sector {
  const s = symbol.toUpperCase();

  // Well-known mappings (non-exhaustive, covers popular holdings)
  const sectorMap: Record<string, Sector> = {
    AAPL: "technology",
    MSFT: "technology",
    GOOGL: "technology",
    GOOG: "technology",
    AMZN: "consumer_discretionary",
    META: "communication_services",
    TSLA: "consumer_discretionary",
    NVDA: "semiconductors",
    AMD: "semiconductors",
    INTC: "semiconductors",
    AVGO: "semiconductors",
    JPM: "financials",
    BAC: "financials",
    V: "financials",
    MA: "financials",
    JNJ: "healthcare",
    UNH: "healthcare",
    PFE: "healthcare",
    LLY: "healthcare",
    XOM: "energy",
    CVX: "energy",
    PG: "consumer_staples",
    KO: "consumer_staples",
    PEP: "consumer_staples",
    VTI: "broad_market",
    VOO: "broad_market",
    SPY: "broad_market",
    QQQ: "technology",
    IWM: "broad_market",
    VXUS: "broad_market",
    BTC: "crypto",
    ETH: "crypto",
    SOL: "crypto",
  };

  return sectorMap[s] ?? "other";
}

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

function normalizeDate(raw: string): string {
  if (!raw) return new Date().toISOString();

  const trimmed = raw.trim();

  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return new Date(trimmed).toISOString();
  }

  // MM/DD/YYYY or M/D/YYYY
  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slashMatch) {
    const [, m, d, y] = slashMatch;
    const year = y!.length === 2 ? `20${y}` : y;
    return new Date(`${year}-${m!.padStart(2, "0")}-${d!.padStart(2, "0")}`).toISOString();
  }

  // Try native Date parse as last resort
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }

  return new Date().toISOString();
}

function parseAmount(raw: string): number {
  if (!raw) return 0;
  // Strip currency symbols, commas, spaces, and percentage signs
  const cleaned = raw.replace(/[$,\s%]/g, "").replace(/[()]/g, (m) =>
    m === "(" ? "-" : "",
  );
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function inferAccount(
  accountId: string,
  platform: Platform,
  transactions: Transaction[],
): Account | null {
  if (transactions.length === 0) return null;

  const hasBrokerageActivity = transactions.some((t) =>
    ["investment_buy", "investment_sell", "investment_dividend"].includes(
      t.category,
    ),
  );

  const accountType: AccountType = hasBrokerageActivity
    ? "brokerage"
    : platform === "coinbase"
      ? "crypto"
      : platform === "chase" || platform === "citi"
        ? "credit_card"
        : "checking";

  const balance = transactions.reduce((sum, t) => sum + t.amount, 0);

  return {
    id: accountId,
    platform,
    accountType,
    name: `${platform.charAt(0).toUpperCase() + platform.slice(1)} ${accountType.replace(/_/g, " ")}`,
    balance: Math.round(balance * 100) / 100,
    currency: "USD",
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Barrel export for all CSV importers.
 *
 * Usage:
 *   import { fidelity, schwab, robinhood, coinbase, chase, citi } from "@/lib/importers";
 *   const accounts = fidelity.importAccounts(csvContent);
 *   const holdings = fidelity.importHoldings(csvContent);
 *
 * Or import individual utilities:
 *   import { inferCategory, deterministicId, parseCSV } from "@/lib/importers";
 */

import * as fidelity from "./fidelity";
import * as schwab from "./schwab";
import * as robinhood from "./robinhood";
import * as coinbase from "./coinbase";
import * as chase from "./chase";
import * as citi from "./citi";

export { fidelity, schwab, robinhood, coinbase, chase, citi };

// Re-export shared utilities for direct access
export {
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

// Re-export types from the main types file for convenience
export type {
  Account,
  AccountType,
  Transaction,
  TransactionCategory,
  Holding,
  AssetClass,
  Sector,
  Platform,
} from "../types";

// ---------------------------------------------------------------------------
// Multi-platform helpers
// ---------------------------------------------------------------------------

import type { Account, Transaction, Holding, Platform } from "../types";

interface ImportResult {
  accounts: Account[];
  transactions: Transaction[];
  holdings: Holding[];
}

/**
 * Auto-detect the platform from CSV content and run the appropriate importer.
 * Returns null if the platform cannot be determined.
 */
export function detectPlatform(csvContent: string): Platform | null {
  const sample = csvContent.slice(0, 1000).toLowerCase();

  // Fidelity: "Account Name" + "Current Value" or "Run Date" + "Action"
  if (
    (sample.includes("account name") && sample.includes("current value")) ||
    (sample.includes("run date") && sample.includes("action"))
  ) {
    return "fidelity";
  }

  // Coinbase: "Transaction Type" + "Quantity Transacted" or "Spot Price"
  if (
    sample.includes("transaction type") &&
    (sample.includes("quantity transacted") || sample.includes("spot price"))
  ) {
    return "coinbase";
  }

  // Robinhood: "Activity Date" + "Trans Code"
  if (sample.includes("activity date") && sample.includes("trans code")) {
    return "robinhood";
  }

  // Chase: "Transaction Date" + "Post Date" + "Category"
  if (
    sample.includes("transaction date") &&
    sample.includes("post date") &&
    sample.includes("category")
  ) {
    return "chase";
  }

  // Citi: "Status" + "Debit" + "Credit"
  if (
    sample.includes("status") &&
    sample.includes("debit") &&
    sample.includes("credit")
  ) {
    return "citi";
  }

  // Schwab: "Action" + "Symbol" + "Fees & Comm" or "Market Value" + "Cost Basis"
  if (
    (sample.includes("action") && sample.includes("fees & comm")) ||
    (sample.includes("market value") && sample.includes("cost basis") && sample.includes("gain/loss"))
  ) {
    return "schwab";
  }

  return null;
}

/**
 * Import all data from a CSV file, auto-detecting the platform.
 * The csvType hint ("positions" | "transactions") helps choose the right parser.
 */
export function importFromCSV(
  csvContent: string,
  options?: {
    platform?: Platform;
    csvType?: "positions" | "transactions";
  }
): ImportResult {
  const platform = options?.platform ?? detectPlatform(csvContent);

  if (!platform) {
    return { accounts: [], transactions: [], holdings: [] };
  }

  const importerMap: Record<
    string,
    {
      importAccounts: (csv: string) => Account[];
      importTransactions: (csv: string) => Transaction[];
      importHoldings?: (csv: string) => Holding[];
    }
  > = {
    fidelity,
    schwab,
    robinhood,
    coinbase,
    chase,
    citi,
  };

  const importer = importerMap[platform];
  if (!importer) {
    return { accounts: [], transactions: [], holdings: [] };
  }

  const result: ImportResult = {
    accounts: [],
    transactions: [],
    holdings: [],
  };

  try {
    result.accounts = importer.importAccounts(csvContent);
  } catch {
    // Non-fatal: file might not be in the expected format for accounts
  }

  try {
    result.transactions = importer.importTransactions(csvContent);
  } catch {
    // Non-fatal
  }

  if (importer.importHoldings) {
    try {
      result.holdings = importer.importHoldings(csvContent);
    } catch {
      // Non-fatal
    }
  }

  return result;
}

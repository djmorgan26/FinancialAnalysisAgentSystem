import type { Account, Transaction } from "../types";
import {
  parseCSV,
  parseDollar,
  normalizeDate,
  deterministicId,
  inferCategory,
  inferSubcategory,
  todayISO,
} from "./utils";

// ---------------------------------------------------------------------------
// CSV row shapes
// ---------------------------------------------------------------------------

/** Chase credit card CSV export */
interface ChaseTransactionRow {
  "Transaction Date"?: string;
  "Post Date"?: string;
  Description?: string;
  Category?: string;
  Type?: string;
  Amount?: string;
  Memo?: string;
}

/**
 * Chase checking/savings CSV export
 * (slightly different format: "Details","Posting Date","Description","Amount","Type","Balance","Check or Slip #")
 */
interface ChaseBankRow {
  Details?: string;
  "Posting Date"?: string;
  Description?: string;
  Amount?: string;
  Type?: string;
  Balance?: string;
  "Check or Slip #"?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Detect whether the CSV is a credit card export or a bank account export
 * based on the headers present.
 */
function isCreditCardExport(csvContent: string): boolean {
  const firstLines = csvContent.slice(0, 500).toLowerCase();
  return (
    firstLines.includes("transaction date") ||
    firstLines.includes("category") ||
    firstLines.includes("post date")
  );
}

function isBankExport(csvContent: string): boolean {
  const firstLines = csvContent.slice(0, 500).toLowerCase();
  return (
    firstLines.includes("details") &&
    firstLines.includes("posting date") &&
    firstLines.includes("balance")
  );
}

/**
 * Map Chase's built-in category strings to our unified categories.
 */
function mapChaseCategory(
  chaseCategory: string,
  description: string,
  amount: number
): { category: ReturnType<typeof inferCategory>; subcategory?: string } {
  const cat = (chaseCategory ?? "").toLowerCase();

  // Chase provides categories like: "Food & Drink", "Shopping", "Travel", etc.
  switch (cat) {
    case "food & drink":
      return {
        category: "food",
        subcategory: inferSubcategory(description) || "dining",
      };
    case "groceries":
      return { category: "food", subcategory: "groceries" };
    case "gas":
    case "travel":
    case "automotive":
      return {
        category: "transportation",
        subcategory: inferSubcategory(description),
      };
    case "bills & utilities":
      return { category: "utilities" };
    case "shopping":
    case "merchandise":
      return {
        category: "shopping",
        subcategory: inferSubcategory(description),
      };
    case "entertainment":
    case "recreation":
      return { category: "entertainment" };
    case "health & wellness":
    case "medical":
      return { category: "healthcare" };
    case "professional services":
    case "personal":
      return { category: "other" };
    case "home":
    case "rent":
      return { category: "rent" };
    case "fees & adjustments":
      return { category: "fee" };
    case "gifts & donations":
      return { category: "other", subcategory: "gifts" };
    case "education":
      return { category: "other", subcategory: "education" };
    case "insurance":
      return { category: "insurance" };
    default:
      // Fall back to description-based inference
      return {
        category: inferCategory(description, amount),
        subcategory: inferSubcategory(description),
      };
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Extract Chase account(s) from CSV content.
 * Since Chase CSVs don't include account metadata directly,
 * we create a single credit card account.
 */
export function importAccounts(csvContent: string): Account[] {
  const rows = isCreditCardExport(csvContent)
    ? parseCSV<ChaseTransactionRow>(csvContent)
    : parseCSV<ChaseBankRow>(csvContent);

  // Sum all transaction amounts to approximate the balance
  let totalSpend = 0;
  for (const row of rows) {
    totalSpend += parseDollar(
      (row as ChaseTransactionRow)["Amount"] ??
        (row as ChaseBankRow)["Amount"]
    );
  }

  const isBank = isBankExport(csvContent);

  // If bank export, try to grab the latest balance from the first row
  let balance = 0;
  if (isBank) {
    const bankRows = parseCSV<ChaseBankRow>(csvContent);
    if (bankRows.length > 0) {
      balance = parseDollar(bankRows[0]["Balance"]);
    }
  } else {
    // For credit cards, the "balance" is what's owed (negative of total spend)
    balance = totalSpend;
  }

  const accountType = isBank ? "checking" : "credit_card";
  const name = isBank ? "Chase Checking" : "Chase Credit Card";

  return [
    {
      id: deterministicId(`chase-account-${accountType}`),
      platform: "chase",
      accountType,
      name,
      balance,
      currency: "USD",
      lastUpdated: todayISO(),
    },
  ];
}

/**
 * Parse Chase credit card or bank CSV into transactions.
 */
export function importTransactions(csvContent: string): Transaction[] {
  if (isBankExport(csvContent)) {
    return importBankTransactions(csvContent);
  }
  return importCreditCardTransactions(csvContent);
}

function importCreditCardTransactions(csvContent: string): Transaction[] {
  const rows = parseCSV<ChaseTransactionRow>(csvContent);
  const transactions: Transaction[] = [];

  const accountId = deterministicId("chase-account-credit_card");

  for (const row of rows) {
    const txDate = row["Transaction Date"] ?? "";
    const postDate = row["Post Date"] ?? "";
    const description = row["Description"] ?? "";
    const chaseCategory = row["Category"] ?? "";
    const type = row["Type"] ?? "";
    const amount = parseDollar(row["Amount"]);

    if (!txDate && !description) continue;

    // Chase credit card amounts: negative = purchase, positive = payment/credit
    // Our schema: negative = debit, positive = credit (same convention)
    const { category, subcategory } = mapChaseCategory(
      chaseCategory,
      description,
      amount
    );

    // Detect payments (positive amounts on credit cards are usually payments)
    const finalCategory =
      amount > 0 && type?.toLowerCase() === "payment" ? "transfer" : category;

    const memo: string[] = [];
    if (postDate && postDate !== txDate) memo.push(`Posted: ${postDate}`);
    if (type) memo.push(`Type: ${type}`);

    transactions.push({
      id: deterministicId(
        `chase-tx-${txDate}-${description}-${amount}`
      ),
      accountId,
      platform: "chase",
      date: normalizeDate(txDate),
      description,
      amount,
      category: finalCategory,
      subcategory,
      originalCategory: chaseCategory || undefined,
      memo: memo.length > 0 ? memo.join(" | ") : undefined,
    });
  }

  return transactions;
}

function importBankTransactions(csvContent: string): Transaction[] {
  const rows = parseCSV<ChaseBankRow>(csvContent);
  const transactions: Transaction[] = [];

  const accountId = deterministicId("chase-account-checking");

  for (const row of rows) {
    const date = row["Posting Date"] ?? "";
    const description = row["Description"] ?? "";
    const amount = parseDollar(row["Amount"]);
    const details = row["Details"] ?? "";
    const type = row["Type"] ?? "";
    const checkNum = row["Check or Slip #"] ?? "";

    if (!date && !description) continue;

    const category = inferCategory(description, amount);
    const subcategory = inferSubcategory(description);

    const memo: string[] = [];
    if (details) memo.push(details);
    if (type) memo.push(`Type: ${type}`);
    if (checkNum) memo.push(`Check #: ${checkNum}`);

    transactions.push({
      id: deterministicId(
        `chase-bank-tx-${date}-${description}-${amount}`
      ),
      accountId,
      platform: "chase",
      date: normalizeDate(date),
      description,
      amount,
      category,
      subcategory,
      memo: memo.length > 0 ? memo.join(" | ") : undefined,
    });
  }

  return transactions;
}

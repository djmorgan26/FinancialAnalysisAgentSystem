import type { Account, Transaction, TransactionCategory } from "../types";
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

/**
 * Citi credit card CSV export.
 * Columns: Status, Date, Description, Debit, Credit
 *
 * Debit = money you spent (positive number in the Debit column)
 * Credit = payments or refunds (positive number in the Credit column)
 */
interface CitiTransactionRow {
  Status?: string;
  Date?: string;
  Description?: string;
  Debit?: string;
  Credit?: string;
  "Member Name"?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Citi CSVs may include leading lines or BOM characters. Clean and detect.
 */
function cleanCitiCSV(csvContent: string): string {
  // Remove BOM
  let content = csvContent.replace(/^\uFEFF/, "");

  // Some Citi exports have a blank line or a date range line before headers
  const lines = content.trim().split(/\r?\n/);
  const headerIdx = lines.findIndex(
    (line) =>
      line.includes("Status") &&
      line.includes("Date") &&
      line.includes("Description")
  );

  if (headerIdx > 0) {
    content = lines.slice(headerIdx).join("\n");
  }

  return content;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Extract Citi account from CSV.
 * Citi CSVs don't include account metadata, so we create a single credit card account.
 */
export function importAccounts(csvContent: string): Account[] {
  const cleaned = cleanCitiCSV(csvContent);
  const rows = parseCSV<CitiTransactionRow>(cleaned);

  // Approximate balance: sum debits (negative) and credits (positive)
  let balance = 0;
  for (const row of rows) {
    const debit = parseDollar(row["Debit"]);
    const credit = parseDollar(row["Credit"]);
    balance += -debit + credit;
  }

  return [
    {
      id: deterministicId("citi-account-credit_card"),
      platform: "citi",
      accountType: "credit_card",
      name: "Citi Credit Card",
      balance,
      currency: "USD",
      lastUpdated: todayISO(),
    },
  ];
}

/**
 * Parse Citi credit card CSV into transactions.
 */
export function importTransactions(csvContent: string): Transaction[] {
  const cleaned = cleanCitiCSV(csvContent);
  const rows = parseCSV<CitiTransactionRow>(cleaned);
  const transactions: Transaction[] = [];

  const accountId = deterministicId("citi-account-credit_card");

  for (const row of rows) {
    const status = (row["Status"] ?? "").trim();
    const date = row["Date"] ?? "";
    const description = row["Description"] ?? "";
    const debit = parseDollar(row["Debit"]);
    const credit = parseDollar(row["Credit"]);

    if (!date && !description) continue;

    // Skip pending transactions if you only want cleared
    // (but we'll include them with a note)
    const isPending = status.toLowerCase() === "pending";

    // In our schema: negative = debit (money out), positive = credit (money in)
    // Citi puts debits and credits in separate columns, both as positive numbers.
    let amount: number;
    if (debit && !credit) {
      amount = -Math.abs(debit); // Purchase: negative
    } else if (credit && !debit) {
      amount = Math.abs(credit); // Payment/refund: positive
    } else if (debit && credit) {
      // Both present (unusual) -- net them
      amount = credit - debit;
    } else {
      amount = 0;
    }

    // Determine category
    let category: TransactionCategory;
    if (credit && !debit) {
      // Credits are usually payments or refunds
      if (description.toLowerCase().includes("payment")) {
        category = "transfer";
      } else {
        category = inferCategory(description, amount);
      }
    } else {
      category = inferCategory(description, amount);
    }

    const subcategory = inferSubcategory(description);

    const memo: string[] = [];
    if (isPending) memo.push("PENDING");
    if (row["Member Name"]) memo.push(`Member: ${row["Member Name"]}`);

    transactions.push({
      id: deterministicId(
        `citi-tx-${date}-${description}-${debit}-${credit}`
      ),
      accountId,
      platform: "citi",
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

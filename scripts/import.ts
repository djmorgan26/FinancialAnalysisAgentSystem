#!/usr/bin/env tsx
/**
 * Import script: reads CSVs from data/raw/{platform}/ and normalizes into data/normalized/
 * Usage: npx tsx scripts/import.ts [platform]
 * If no platform specified, imports all platforms.
 */

import fs from "fs/promises";
import path from "path";
import * as fidelity from "../src/lib/importers/fidelity";
import * as schwab from "../src/lib/importers/schwab";
import * as robinhood from "../src/lib/importers/robinhood";
import * as coinbase from "../src/lib/importers/coinbase";
import * as chase from "../src/lib/importers/chase";
import * as citi from "../src/lib/importers/citi";
import type { Account, Transaction, Holding, FinancialData, Platform } from "../src/lib/types";

const DATA_DIR = path.join(process.cwd(), "data");
const RAW_DIR = path.join(DATA_DIR, "raw");
const NORMALIZED_DIR = path.join(DATA_DIR, "normalized");

type PlatformImporter = {
  importAccounts: (csv: string) => Account[];
  importTransactions: (csv: string) => Transaction[];
  importHoldings?: (csv: string) => Holding[];
};

const importers: Record<Platform, PlatformImporter | undefined> = {
  fidelity,
  schwab,
  robinhood,
  coinbase,
  chase,
  citi,
  manual: undefined,
};

async function readCSVFiles(platformDir: string): Promise<string[]> {
  try {
    const files = await fs.readdir(platformDir);
    const csvFiles = files.filter((f) => f.toLowerCase().endsWith(".csv"));
    const contents: string[] = [];
    for (const file of csvFiles) {
      const content = await fs.readFile(path.join(platformDir, file), "utf-8");
      contents.push(content);
    }
    return contents;
  } catch {
    return [];
  }
}

async function loadExistingData(): Promise<FinancialData> {
  try {
    const raw = await fs.readFile(path.join(NORMALIZED_DIR, "financial-data.json"), "utf-8");
    return JSON.parse(raw);
  } catch {
    return { lastUpdated: new Date().toISOString(), accounts: [], transactions: [], holdings: [] };
  }
}

async function importPlatform(platform: Platform, data: FinancialData): Promise<{ accounts: number; transactions: number; holdings: number }> {
  const importer = importers[platform];
  if (!importer) return { accounts: 0, transactions: 0, holdings: 0 };

  const platformDir = path.join(RAW_DIR, platform);
  const csvContents = await readCSVFiles(platformDir);

  if (csvContents.length === 0) {
    console.log(`  ⏭ No CSV files found in data/raw/${platform}/`);
    return { accounts: 0, transactions: 0, holdings: 0 };
  }

  let newAccounts = 0, newTransactions = 0, newHoldings = 0;
  const existingAccountIds = new Set(data.accounts.map((a) => a.id));
  const existingTransactionIds = new Set(data.transactions.map((t) => t.id));
  const existingHoldingIds = new Set(data.holdings.map((h) => h.id));

  for (const csv of csvContents) {
    const accounts = importer.importAccounts(csv);
    for (const account of accounts) {
      if (!existingAccountIds.has(account.id)) {
        data.accounts.push(account);
        existingAccountIds.add(account.id);
        newAccounts++;
      } else {
        const idx = data.accounts.findIndex((a) => a.id === account.id);
        if (idx !== -1) data.accounts[idx] = account; // update balance
      }
    }

    const transactions = importer.importTransactions(csv);
    for (const tx of transactions) {
      if (!existingTransactionIds.has(tx.id)) {
        data.transactions.push(tx);
        existingTransactionIds.add(tx.id);
        newTransactions++;
      }
    }

    if (importer.importHoldings) {
      const holdings = importer.importHoldings(csv);
      // For holdings, replace all for this platform (positions change)
      data.holdings = data.holdings.filter((h) => h.platform !== platform);
      data.holdings.push(...holdings);
      newHoldings = holdings.length;
    }
  }

  return { accounts: newAccounts, transactions: newTransactions, holdings: newHoldings };
}

async function main() {
  const targetPlatform = process.argv[2] as Platform | undefined;
  const platforms: Platform[] = targetPlatform
    ? [targetPlatform]
    : ["fidelity", "schwab", "robinhood", "coinbase", "chase", "citi"];

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  Financial Data Import");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  await fs.mkdir(NORMALIZED_DIR, { recursive: true });
  const data = await loadExistingData();

  for (const platform of platforms) {
    console.log(`\n▸ Importing ${platform}...`);
    const result = await importPlatform(platform, data);
    console.log(`  ✓ ${result.accounts} accounts, ${result.transactions} transactions, ${result.holdings} holdings`);
  }

  data.lastUpdated = new Date().toISOString();
  await fs.writeFile(path.join(NORMALIZED_DIR, "financial-data.json"), JSON.stringify(data, null, 2));

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`  Done. ${data.accounts.length} accounts, ${data.transactions.length} transactions, ${data.holdings.length} holdings`);
  console.log(`  Saved to data/normalized/financial-data.json`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

main().catch(console.error);

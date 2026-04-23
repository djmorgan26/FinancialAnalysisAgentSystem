#!/usr/bin/env tsx
/**
 * Import script: reads CSVs from data/raw/{platform}/ and normalizes into data/normalized/
 * Usage: npx tsx scripts/import.ts [platform]
 * If no platform specified, imports all platforms.
 */

import fs from "fs/promises";
import path from "path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
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
  console.log(`  Normalized. ${data.accounts.length} accounts, ${data.transactions.length} transactions, ${data.holdings.length} holdings`);
  console.log(`  Saved to data/normalized/financial-data.json`);

  // Push non-Schwab platforms to Supabase. Schwab is API-driven — don't clobber.
  try {
    await loadEnv();
    const userId = process.env.TARGET_USER_ID;
    if (!userId) {
      throw new Error(
        "TARGET_USER_ID is required. Set it to your auth user_id (from Supabase) and re-run."
      );
    }
    const supabase = getSupabase();
    const pushedPlatforms: Platform[] = platforms.filter(
      (p): p is Platform => p !== "schwab"
    );
    const hlds = data.holdings.filter((h) => pushedPlatforms.includes(h.platform));
    // Only push accounts that are referenced by at least one holding. Skips
    // ghost accounts that may linger in the normalized JSON from prior runs.
    const referencedAcctIds = new Set(hlds.map((h) => h.accountId));
    const accts = data.accounts.filter(
      (a) => pushedPlatforms.includes(a.platform) && referencedAcctIds.has(a.id)
    );

    if (accts.length > 0) {
      const rows = accts.map((a) => ({
        id: a.id,
        user_id: userId,
        platform: a.platform,
        account_type: a.accountType,
        name: a.name,
        balance: a.balance,
        currency: a.currency,
        last_updated: a.lastUpdated,
      }));
      const { error } = await supabase.from("accounts").upsert(rows, { onConflict: "id" });
      if (error) throw error;
    }

    if (hlds.length > 0) {
      // Replace all non-Schwab holdings to match current CSV snapshot
      const { error: delErr } = await supabase
        .from("holdings")
        .delete()
        .eq("user_id", userId)
        .in("platform", pushedPlatforms);
      if (delErr) throw delErr;

      const rows = hlds.map((h) => ({
        id: h.id,
        user_id: userId,
        account_id: h.accountId,
        platform: h.platform,
        symbol: h.symbol,
        name: h.name,
        quantity: h.quantity,
        cost_basis: h.costBasis,
        current_price: h.currentPrice,
        current_value: h.currentValue,
        gain_loss: h.gainLoss,
        gain_loss_percent: h.gainLossPercent,
        asset_class: h.assetClass,
        sector: h.sector,
        last_updated: h.lastUpdated,
      }));
      const { error } = await supabase.from("holdings").insert(rows);
      if (error) throw error;
    }

    console.log(`  Pushed to Supabase: ${accts.length} accounts, ${hlds.length} holdings (non-Schwab)`);
  } catch (e) {
    console.warn(`  ⚠ Supabase sync skipped: ${(e as Error).message}`);
  }

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

async function loadEnv(): Promise<void> {
  try {
    const raw = await fs.readFile(path.join(process.cwd(), ".env.local"), "utf-8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 0) continue;
      const k = trimmed.slice(0, eq).trim();
      const v = trimmed.slice(eq + 1).trim();
      if (!(k in process.env)) process.env[k] = v;
    }
  } catch { /* optional */ }
}

function getSupabase(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

main().catch(console.error);

#!/usr/bin/env tsx
/**
 * Analysis script: runs the full financial analysis pipeline
 * Usage: npx tsx scripts/analyze.ts
 */

import fs from "fs/promises";
import path from "path";
import type { FinancialData, UserProfile, AnalysisResult, Snapshot } from "../src/lib/types";
import { runAnalysis } from "../src/lib/analysis";

const DATA_DIR = path.join(process.cwd(), "data");
const NORMALIZED_DIR = path.join(DATA_DIR, "normalized");
const SNAPSHOTS_DIR = path.join(DATA_DIR, "snapshots");
const CONFIG_DIR = path.join(process.cwd(), "config");

async function loadFinancialData(): Promise<FinancialData> {
  try {
    const raw = await fs.readFile(path.join(NORMALIZED_DIR, "financial-data.json"), "utf-8");
    return JSON.parse(raw);
  } catch {
    console.log("  ⚠ No financial data found. Run 'npm run import' first, or analysis will use profile defaults.");
    return { lastUpdated: new Date().toISOString(), accounts: [], transactions: [], holdings: [] };
  }
}

async function loadUserProfile(): Promise<UserProfile> {
  const raw = await fs.readFile(path.join(CONFIG_DIR, "user-profile.json"), "utf-8");
  return JSON.parse(raw);
}

async function saveAnalysis(result: AnalysisResult): Promise<void> {
  await fs.mkdir(NORMALIZED_DIR, { recursive: true });
  await fs.writeFile(path.join(NORMALIZED_DIR, "analysis.json"), JSON.stringify(result, null, 2));
}

async function createSnapshot(result: AnalysisResult): Promise<void> {
  await fs.mkdir(SNAPSHOTS_DIR, { recursive: true });
  const snapshot: Snapshot = {
    id: `snap-${Date.now()}`,
    date: new Date().toISOString(),
    netWorth: result.netWorth,
    totalAssets: result.totalAssets,
    totalLiabilities: result.totalLiabilities,
    savingsRate: result.savingsRate,
    accountBalances: result.accounts.map((a) => ({ accountId: a.id, balance: a.balance })),
  };
  const filename = `snapshot-${new Date().toISOString().split("T")[0]}.json`;
  await fs.writeFile(path.join(SNAPSHOTS_DIR, filename), JSON.stringify(snapshot, null, 2));
}

function printDashboard(r: AnalysisResult): void {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  FINANCIAL ANALYSIS REPORT");
  console.log(`  Generated: ${new Date(r.generatedAt).toLocaleDateString()}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  console.log("  NET WORTH");
  console.log(`  $${r.netWorth.toLocaleString("en-US", { minimumFractionDigits: 2 })}`);
  console.log(`  Assets: $${r.totalAssets.toLocaleString()} | Liabilities: $${r.totalLiabilities.toLocaleString()}\n`);

  console.log("  CASH FLOW (Monthly)");
  console.log(`  Income:   $${r.monthlyIncome.toLocaleString()}`);
  console.log(`  Spending: $${r.monthlySpending.toLocaleString()}`);
  console.log(`  Savings:  $${r.monthlySavings.toLocaleString()} (${(r.savingsRate * 100).toFixed(1)}%)\n`);

  console.log("  ACCOUNTS");
  for (const a of r.accounts) {
    const sign = a.accountType === "credit_card" ? "-" : "";
    console.log(`  ${a.name.padEnd(30)} ${sign}$${Math.abs(a.balance).toLocaleString()}`);
  }

  if (r.spendingBreakdown.length > 0) {
    console.log("\n  TOP SPENDING CATEGORIES");
    for (const s of r.spendingBreakdown.slice(0, 8)) {
      const bar = "█".repeat(Math.round(s.percentOfTotal / 2));
      console.log(`  ${s.category.padEnd(22)} $${s.monthlyAverage.toLocaleString().padStart(8)} ${bar} ${(s.percentOfTotal).toFixed(0)}%`);
    }
  }

  if (r.assetAllocation.length > 0) {
    console.log("\n  ASSET ALLOCATION");
    for (const a of r.assetAllocation) {
      console.log(`  ${a.label.padEnd(20)} $${a.value.toLocaleString().padStart(10)} (${a.percent.toFixed(1)}%)`);
    }
  }

  if (r.insights.length > 0) {
    console.log("\n  INSIGHTS");
    for (const i of r.insights) {
      const icon = i.type === "warning" ? "⚠" : i.type === "opportunity" ? "💡" : "ℹ";
      console.log(`  ${icon} ${i.title}`);
      console.log(`    ${i.description}`);
      if (i.action) console.log(`    → ${i.action}`);
    }
  }

  if (r.strategy.dcaTargets.length > 0) {
    console.log("\n  DCA STRATEGY");
    console.log(`  Monthly Investment Budget: $${r.strategy.monthlyInvestmentBudget.toLocaleString()}`);
    for (const d of r.strategy.dcaTargets) {
      console.log(`  ${d.symbol.padEnd(8)} $${d.monthlyAmount.toLocaleString().padStart(6)}/mo (${d.allocationPercent}%) - ${d.rationale}`);
    }
  }

  console.log("\n  MONTHLY BUDGET");
  const b = r.strategy.monthlyBudget;
  console.log(`  Necessities:   $${b.necessities.toLocaleString()}`);
  console.log(`  Investments:   $${b.investments.toLocaleString()}`);
  console.log(`  Savings:       $${b.savings.toLocaleString()}`);
  console.log(`  Discretionary: $${b.discretionary.toLocaleString()}`);

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

async function main() {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  Running Financial Analysis...");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const [financialData, userProfile] = await Promise.all([
    loadFinancialData(),
    loadUserProfile(),
  ]);

  console.log(`  Data: ${financialData.accounts.length} accounts, ${financialData.transactions.length} transactions, ${financialData.holdings.length} holdings`);

  const result = runAnalysis(financialData, userProfile);

  await Promise.all([
    saveAnalysis(result),
    createSnapshot(result),
  ]);

  printDashboard(result);

  console.log("  Analysis saved to data/normalized/analysis.json");
  console.log("  Snapshot saved to data/snapshots/\n");
}

main().catch(console.error);

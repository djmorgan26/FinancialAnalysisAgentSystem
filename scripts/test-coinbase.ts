#!/usr/bin/env tsx
/**
 * Smoke-test the Coinbase Advanced Trade client.
 * Usage: npm run test:coinbase
 */

import fs from "fs/promises";
import path from "path";

async function loadEnv(): Promise<void> {
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
}

async function main() {
  await loadEnv();
  const cb = await import("../src/lib/coinbase-api");

  console.log("Coinbase configured:", cb.isConfigured());
  if (!cb.isConfigured()) process.exit(1);

  console.log("\nFetching accounts...");
  const accounts = await cb.getAccounts();
  console.log(`Retrieved ${accounts.length} accounts total`);

  const nonZero = accounts.filter(
    (a) =>
      parseFloat(a.available_balance?.value ?? "0") +
        parseFloat(a.hold?.value ?? "0") >
      0
  );
  console.log(`Non-zero balances: ${nonZero.length}`);

  for (const a of nonZero) {
    const bal = parseFloat(a.available_balance?.value ?? "0");
    console.log(`  ${a.currency.padEnd(8)} ${bal.toFixed(8).padStart(18)}  ${a.name}`);
  }

  console.log("\nFetching holdings with USD values...");
  const holdings = await cb.getHoldings();
  let total = 0;
  for (const h of holdings) {
    console.log(
      `  ${h.symbol.padEnd(8)} qty ${h.quantity.toFixed(6).padStart(14)}  @ $${h.currentPrice.toFixed(2).padStart(10)}  = $${h.valueUSD.toFixed(2).padStart(10)}`
    );
    total += h.valueUSD;
  }
  console.log(`\nTotal Coinbase USD value: $${total.toFixed(2)}`);
}

main().catch((e) => {
  console.error("FAILED:", e.message || e);
  process.exit(1);
});

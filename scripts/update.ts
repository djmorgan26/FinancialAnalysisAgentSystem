#!/usr/bin/env tsx
/**
 * Update script: the "Update my financial analysis" entry point
 * Runs import → analyze → snapshot in sequence
 * Usage: npx tsx scripts/update.ts
 */

import { execSync } from "child_process";
import path from "path";

const SCRIPTS_DIR = path.join(process.cwd(), "scripts");

function run(script: string, label: string): void {
  console.log(`\n▸ ${label}...`);
  try {
    execSync(`npx tsx ${path.join(SCRIPTS_DIR, script)}`, {
      stdio: "inherit",
      cwd: process.cwd(),
    });
  } catch (error) {
    console.error(`  ✗ ${label} failed`);
    throw error;
  }
}

async function main() {
  console.log("╔══════════════════════════════════════════╗");
  console.log("║  Financial Analysis System — Full Update ║");
  console.log("╚══════════════════════════════════════════╝");

  const start = Date.now();

  run("import.ts", "Step 1: Importing data from all platforms");
  run("analyze.ts", "Step 2: Running analysis and generating insights");

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  console.log("╔══════════════════════════════════════════╗");
  console.log(`║  Update complete in ${elapsed}s`.padEnd(43) + "║");
  console.log("║  Open http://localhost:3000 for dashboard ║");
  console.log("╚══════════════════════════════════════════╝\n");
}

main().catch(console.error);

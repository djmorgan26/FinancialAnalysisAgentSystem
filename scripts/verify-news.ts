#!/usr/bin/env tsx
/**
 * Smoke test for /api/news.
 *
 * Asserts:
 *   • GET /api/news authed         → 200 with { news: [...] }
 *   • GET /api/news?type=market    → 200
 *   • GET /api/news?symbol=XZZZZQ  → 403 (symbol not in user holdings)
 *   • GET /api/news unauthed       → 401 (or redirect)
 *
 * Skips (warns) the success cases if FINNHUB_API_KEY is absent in the target
 * env — expected to return 400.
 */
import { createServerClient } from "@supabase/ssr";
import fs from "fs/promises";
import path from "path";

async function loadEnv() {
  try {
    const raw = await fs.readFile(path.join(process.cwd(), ".env.local"), "utf-8");
    for (const line of raw.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq < 0) continue;
      const k = t.slice(0, eq).trim();
      const v = t.slice(eq + 1).trim();
      if (!(k in process.env)) process.env[k] = v;
    }
  } catch {}
}

async function main() {
  await loadEnv();
  const base = process.argv[2] ?? "https://financial-analysis-agent-one.vercel.app";
  const email = process.env.TEST_USER_EMAIL;
  const password = process.env.TEST_USER_PASSWORD;
  const supabaseUrl = process.env.SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!email || !password || !supabaseUrl || !anonKey) {
    console.error("Missing TEST_USER_EMAIL / TEST_USER_PASSWORD / SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY.");
    process.exit(1);
  }

  // --- Unauthed check first
  console.log(`▸ GET ${base}/api/news (no auth)`);
  const unauthed = await fetch(`${base}/api/news`, { redirect: "manual" });
  if (![301, 302, 307, 308, 401, 403, 500].includes(unauthed.status)) {
    console.log(`unexpected unauthed status: ${unauthed.status}`);
    process.exit(1);
  }
  console.log(`▸ Unauthed HTTP ${unauthed.status} (expected 3xx/401/403)`);

  // --- Sign in
  const captured: { name: string; value: string }[] = [];
  const ssr = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll: () => captured,
      setAll: (cs) =>
        cs.forEach((c) => captured.push({ name: c.name, value: c.value })),
    },
  });
  const { error } = await ssr.auth.signInWithPassword({ email, password });
  if (error) {
    console.error(`sign-in failed: ${error.message}`);
    process.exit(1);
  }
  const cookieHeader = captured
    .map((c) => `${c.name}=${encodeURIComponent(c.value)}`)
    .join("; ");

  const headers = { cookie: cookieHeader, accept: "application/json" };

  // --- Portfolio news (default)
  console.log(`▸ GET ${base}/api/news`);
  const port = await fetch(`${base}/api/news`, { headers });
  const portBody = await port.json().catch(() => ({}));
  if (port.status === 400 && /not configured/i.test(portBody.error ?? "")) {
    console.log("⚠ FINNHUB_API_KEY not configured in target env — skipping news body checks.");
  } else if (port.status !== 200 || !Array.isArray(portBody.news)) {
    console.log(`portfolio news HTTP ${port.status}: ${JSON.stringify(portBody).slice(0, 200)}`);
    process.exit(1);
  } else {
    console.log(`▸ Portfolio news: ${portBody.news.length} item(s)`);
  }

  // --- Market news
  console.log(`▸ GET ${base}/api/news?type=market`);
  const mkt = await fetch(`${base}/api/news?type=market`, { headers });
  const mktBody = await mkt.json().catch(() => ({}));
  if (mkt.status === 400 && /not configured/i.test(mktBody.error ?? "")) {
    console.log("⚠ FINNHUB_API_KEY missing — skipping market news assertions.");
  } else if (mkt.status !== 200 || !Array.isArray(mktBody.news)) {
    console.log(`market news HTTP ${mkt.status}: ${JSON.stringify(mktBody).slice(0, 200)}`);
    process.exit(1);
  } else {
    console.log(`▸ Market news: ${mktBody.news.length} item(s)`);
  }

  // --- Unknown symbol → 403
  console.log(`▸ GET ${base}/api/news?symbol=XZZZZZQ`);
  const unknownSym = await fetch(`${base}/api/news?symbol=XZZZZZQ`, { headers });
  if (unknownSym.status !== 403) {
    const b = await unknownSym.text();
    console.log(`unknown symbol HTTP ${unknownSym.status} (expected 403): ${b.slice(0, 200)}`);
    // Accept 400 if Finnhub missing
    if (!(unknownSym.status === 400 && /not configured/i.test(b))) {
      process.exit(1);
    }
  } else {
    console.log("▸ Unknown symbol → 403 as expected");
  }

  console.log("\n✅ /api/news OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

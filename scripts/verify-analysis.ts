#!/usr/bin/env tsx
/**
 * Smoke test: sign in as TEST_USER and GET /analysis.
 * Asserts Trade ideas renders; Cross-platform only renders if applicable.
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

  console.log(`▸ Signed in as TEST_USER. GET ${base}/analysis`);
  const res = await fetch(`${base}/analysis`, {
    redirect: "manual",
    headers: { cookie: cookieHeader, accept: "text/html" },
  });
  console.log(`▸ HTTP ${res.status}`);
  const raw = await res.text();
  if (res.status !== 200) {
    console.log(raw.slice(0, 600));
    console.log("\n❌ /analysis returned non-200");
    process.exit(1);
  }

  const sentinels = ["Analysis", "Trade ideas"];
  const missing = sentinels.filter((s) => !raw.includes(s));
  if (missing.length > 0) {
    console.log(`▸ Missing sentinels: ${missing.join(", ")}`);
    console.log("\n❌ /analysis content check failed");
    process.exit(1);
  }

  if (raw.includes("Cross-platform holdings")) {
    console.log("▸ Cross-platform holdings panel present (test user has overlap)");
  } else {
    console.log("▸ Cross-platform holdings not rendered (expected when no overlap)");
  }

  console.log(`▸ All sentinels present: ${sentinels.join(", ")}`);
  console.log("\n✅ /analysis RENDERING OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

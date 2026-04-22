#!/usr/bin/env tsx
/**
 * Smoke test: sign in as the dedicated TEST_USER and GET the dashboard.
 *
 * Requires TEST_USER_EMAIL + TEST_USER_PASSWORD in .env.local.
 * Run `npx tsx scripts/ensure-test-user.ts` once to bootstrap the user.
 *
 * NEVER touches the real owner account.
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
    console.error(
      "Missing required env. Need TEST_USER_EMAIL, TEST_USER_PASSWORD, SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local."
    );
    console.error(
      "Run: npx tsx scripts/ensure-test-user.ts to bootstrap the test user."
    );
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
  const { error: sinErr } = await ssr.auth.signInWithPassword({ email, password });
  if (sinErr) {
    console.error(
      `sign-in failed: ${sinErr.message} — run ensure-test-user.ts to resync the password.`
    );
    process.exit(1);
  }
  const cookieHeader = captured
    .map((c) => `${c.name}=${encodeURIComponent(c.value)}`)
    .join("; ");

  console.log(`▸ Signed in as TEST_USER. GET ${base}/`);
  const res = await fetch(`${base}/`, {
    redirect: "manual",
    headers: { cookie: cookieHeader, accept: "text/html" },
  });
  console.log(`▸ HTTP ${res.status}`);
  const raw = await res.text();
  if (res.status === 200) {
    // Pull the net-worth hero out of the HTML if present.
    const m = raw.match(/\$[0-9,]+(?:\.\d+)?/g);
    if (m) console.log(`▸ $ figures on page: ${m.slice(0, 4).join(", ")}`);
    console.log("\n✅ DASHBOARD RENDERING OK");
  } else {
    console.log(raw.slice(0, 600));
    console.log("\n❌ Dashboard returned non-200");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

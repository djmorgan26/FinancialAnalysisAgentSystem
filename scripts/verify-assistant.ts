#!/usr/bin/env tsx
/**
 * Smoke test: sign in as the dedicated TEST_USER and POST /api/assistant.
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
  const base =
    process.argv[2] ?? "https://financial-analysis-agent-one.vercel.app";
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

  console.log(`▸ Signed in as TEST_USER. POST ${base}/api/assistant`);
  const res = await fetch(`${base}/api/assistant`, {
    method: "POST",
    redirect: "manual",
    headers: {
      "content-type": "application/json",
      cookie: cookieHeader,
    },
    body: JSON.stringify({
      messages: [
        {
          role: "user",
          content:
            "Say hello in one short sentence. Do not call any tools.",
        },
      ],
    }),
  });
  const raw = await res.text();
  console.log(`▸ HTTP ${res.status}`);
  console.log(`▸ Body:\n${raw.slice(0, 800)}`);

  if (res.ok) {
    const body = JSON.parse(raw);
    if (typeof body.text === "string" && body.text.length > 0) {
      console.log("\n✅ ASSISTANT WORKING");
      return;
    }
  }
  console.log("\n❌ Assistant not returning a text response.");
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

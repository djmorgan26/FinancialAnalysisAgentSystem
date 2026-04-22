#!/usr/bin/env tsx
/**
 * Idempotently create a dedicated test user for verification scripts,
 * reading credentials from env. Run once; the same user is reused
 * across all future verify-* runs.
 *
 * Required env:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   TEST_USER_EMAIL, TEST_USER_PASSWORD
 */
import { createClient } from "@supabase/supabase-js";
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
  const email = process.env.TEST_USER_EMAIL;
  const password = process.env.TEST_USER_PASSWORD;
  if (!email || !password) {
    console.error(
      "Set TEST_USER_EMAIL and TEST_USER_PASSWORD in .env.local first."
    );
    process.exit(1);
  }

  const admin = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data: list } = await admin.auth.admin.listUsers();
  const existing = list.users.find((u) => u.email === email);

  let userId: string;
  if (existing) {
    userId = existing.id;
    // Reset password to the canonical value so verification scripts work
    // even if someone mucked with it.
    await admin.auth.admin.updateUserById(userId, { password, email_confirm: true });
    console.log(`▸ Test user exists (${userId.slice(0, 8)}…). Password resynced.`);
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error || !data.user) throw new Error(error?.message ?? "createUser failed");
    userId = data.user.id;
    console.log(`▸ Created test user ${userId.slice(0, 8)}…`);
  }

  // Seed minimal profile so verification scripts don't get redirected to
  // /onboarding.
  const { error: profErr } = await admin.from("user_profiles").upsert({
    user_id: userId,
    name: "Verifier",
    onboarding_complete: true,
  });
  if (profErr) console.warn("profile upsert:", profErr.message);

  console.log(`✓ Ready. User id: ${userId}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

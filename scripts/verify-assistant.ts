#!/usr/bin/env tsx
/**
 * End-to-end test: create a throwaway user, sign in to capture the real
 * @supabase/ssr cookie, POST to /api/assistant, print the response, then
 * delete the user.
 */
import { createClient } from "@supabase/supabase-js";
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
  const url = process.env.SUPABASE_URL!;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const admin = createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const testEmail = `assistant-verify-${Date.now()}@example.test`;
  const testPass = `vrf-${Math.random().toString(36).slice(2)}-Xy9`;

  console.log(`▸ Creating throwaway user ${testEmail}`);
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: testEmail,
    password: testPass,
    email_confirm: true,
  });
  if (createErr || !created.user) {
    throw new Error(`createUser failed: ${createErr?.message}`);
  }
  const uid = created.user.id;
  await admin.from("user_profiles").upsert({
    user_id: uid,
    name: "Verifier",
    onboarding_complete: true,
  });

  try {
    // Sign in through @supabase/ssr so we capture the exact cookie format.
    const captured: { name: string; value: string }[] = [];
    const ssr = createServerClient(url, anonKey, {
      cookies: {
        getAll: () => captured,
        setAll: (cs) =>
          cs.forEach((c) => captured.push({ name: c.name, value: c.value })),
      },
    });
    const { error: signInErr } = await ssr.auth.signInWithPassword({
      email: testEmail,
      password: testPass,
    });
    if (signInErr) throw new Error(`sign-in failed: ${signInErr.message}`);

    if (captured.length === 0) {
      throw new Error("no cookies captured from signInWithPassword");
    }
    const cookieHeader = captured
      .map((c) => `${c.name}=${encodeURIComponent(c.value)}`)
      .join("; ");
    console.log(`▸ Got ${captured.length} cookie(s): ${captured.map((c) => c.name).join(", ")}`);

    console.log(`▸ Calling ${base}/api/assistant`);
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
    console.log(`▸ Body:\n${raw.slice(0, 1200)}${raw.length > 1200 ? "…" : ""}`);

    if (res.ok) {
      const body = JSON.parse(raw);
      if (typeof body.text === "string" && body.text.length > 0) {
        console.log("\n✅ ASSISTANT WORKING — received text response.");
      } else {
        console.log("\n⚠ Response was 200 but no text was returned.");
      }
    } else if (res.status === 307) {
      console.log(
        "\n❌ Redirected to sign-in — the cookie was not accepted. Debug middleware/ssr cookie format."
      );
    } else {
      console.log("\n❌ Assistant endpoint returned error.");
    }
  } finally {
    console.log(`\n▸ Deleting throwaway user ${uid.slice(0, 8)}…`);
    await admin.auth.admin.deleteUser(uid);
  }
}

main().catch((e) => {
  console.error("verify-assistant failed:", e);
  process.exit(1);
});

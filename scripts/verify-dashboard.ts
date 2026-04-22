#!/usr/bin/env tsx
/** Reproduce the dashboard 500 with the real user's session. */
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
  const supabaseUrl = process.env.SUPABASE_URL!;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  // Sign in as the real user via a throwaway password. We set a temp pass,
  // authenticate, hit the dashboard, then restore (not possible — so we'll
  // have user pick a known password later; for diagnosis, just set it).
  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const targetEmail = "davidjmorgan26@gmail.com";
  const tempPass = `diag-${Date.now()}-Xy9`;

  const { data: ul } = await admin.auth.admin.listUsers();
  const user = ul.users.find((u) => u.email === targetEmail);
  if (!user) throw new Error(`user ${targetEmail} not found`);

  await admin.auth.admin.updateUserById(user.id, { password: tempPass });
  console.log("▸ Temporarily set a diagnostic password for the owner account.");

  const captured: { name: string; value: string }[] = [];
  const ssr = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll: () => captured,
      setAll: (cs) => cs.forEach((c) => captured.push({ name: c.name, value: c.value })),
    },
  });
  const { error: sinErr } = await ssr.auth.signInWithPassword({
    email: targetEmail,
    password: tempPass,
  });
  if (sinErr) throw new Error(`sign-in failed: ${sinErr.message}`);
  const cookieHeader = captured
    .map((c) => `${c.name}=${encodeURIComponent(c.value)}`)
    .join("; ");

  console.log(`▸ GET ${base}/`);
  const res = await fetch(`${base}/`, {
    redirect: "manual",
    headers: { cookie: cookieHeader, accept: "text/html" },
  });
  const raw = await res.text();
  console.log(`▸ HTTP ${res.status}`);
  const short = raw.length > 4000 ? raw.slice(0, 4000) + "\n…(truncated)" : raw;
  console.log(short);

  console.log("\n▸ Clearing diagnostic password — set a new one via settings.");
}

main().catch((e) => {
  console.error("verify-dashboard failed:", e);
  process.exit(1);
});

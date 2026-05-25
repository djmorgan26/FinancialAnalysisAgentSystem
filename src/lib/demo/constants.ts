import { cookies } from "next/headers";

/**
 * No-login demo mode.
 *
 * Demo mode runs the app in a read-only, fully mocked state: auth is bypassed,
 * every Supabase / external-API call is short-circuited, and all data is served
 * from `src/lib/demo/fixtures.ts`. This lets recruiters explore the real
 * dashboard UI without an account and even with the Supabase project paused.
 *
 * It is activated two ways:
 *   1. Per-visitor: the `ledger_demo` cookie, set by visiting `/demo`.
 *   2. Deployment-wide: `NEXT_PUBLIC_DEMO_MODE=1` (or `DEMO_MODE=1`) forces
 *      EVERY server request into demo mode, with NO cookie required. This is
 *      the public-preview switch and it must win even when real Supabase env
 *      vars are present — so a cold visitor on `/` never constructs a Supabase
 *      client or touches the (possibly paused) database.
 */

export const DEMO_COOKIE = "ledger_demo";

/**
 * True when the deployment is globally forced into demo mode via env. This is
 * the authoritative server-side switch — it does NOT depend on any request
 * cookie, so it short-circuits Supabase before the first DB call on any route.
 *
 * `NEXT_PUBLIC_*` is inlined at build time and also readable at runtime; we
 * accept the non-prefixed `DEMO_MODE` too as a server-only fallback.
 */
export function isDemoForced(): boolean {
  return isTruthy(process.env.NEXT_PUBLIC_DEMO_MODE) || isTruthy(process.env.DEMO_MODE);
}

function isTruthy(v: string | undefined): boolean {
  if (!v) return false;
  const s = v.trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "on";
}

/**
 * Synthetic user id used throughout the data layer to recognize demo requests.
 * Any data-store / classification function receiving this id MUST serve
 * fixtures and MUST NOT touch Supabase.
 */
export const DEMO_USER_ID = "demo-user-0000-0000-0000-000000000000";

export const DEMO_USER_EMAIL = "demo@ledger.app";

/**
 * True when the current request should run in demo mode. Server-only.
 *
 * Forced env mode wins first and never reads cookies, so it works on a cold
 * request with no cookie and regardless of whether real Supabase env is set.
 * Otherwise we fall back to the per-visitor demo cookie.
 */
export async function isDemoActive(): Promise<boolean> {
  if (isDemoForced()) return true;
  const store = await cookies();
  return store.get(DEMO_COOKIE)?.value === "1";
}

/** True for any user id that is the synthetic demo user. */
export function isDemoUserId(userId: string | null | undefined): boolean {
  return userId === DEMO_USER_ID;
}

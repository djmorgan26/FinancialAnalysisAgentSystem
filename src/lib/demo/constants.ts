import { cookies } from "next/headers";

/**
 * No-login demo mode.
 *
 * When the `ledger_demo` cookie is set (via the `/demo` route), the app runs
 * in a read-only, fully client/server-mocked state: auth is bypassed, every
 * Supabase / external-API call is short-circuited, and all data is served from
 * `src/lib/demo/fixtures.ts`. This lets recruiters explore the real dashboard
 * UI without an account and even with the Supabase project paused.
 */

export const DEMO_COOKIE = "ledger_demo";

/**
 * Synthetic user id used throughout the data layer to recognize demo requests.
 * Any data-store / classification function receiving this id MUST serve
 * fixtures and MUST NOT touch Supabase.
 */
export const DEMO_USER_ID = "demo-user-0000-0000-0000-000000000000";

export const DEMO_USER_EMAIL = "demo@ledger.app";

/** True when the current request carries the demo cookie. Server-only. */
export async function isDemoActive(): Promise<boolean> {
  const store = await cookies();
  return store.get(DEMO_COOKIE)?.value === "1";
}

/** True for any user id that is the synthetic demo user. */
export function isDemoUserId(userId: string | null | undefined): boolean {
  return userId === DEMO_USER_ID;
}

/**
 * The app's owner accounts.
 *
 * Some integrations are configured with app-wide keys rather than per-user
 * OAuth (Coinbase's CDP key is the owner's own key). Those must only ever be
 * synced into the owner's rows, never into another signed-in user's account.
 *
 * OWNER_USER_IDS: comma-separated auth.users ids. Also the users the daily
 * cron sync runs for.
 */
import { optionalEnv } from "./env";

export function ownerUserIds(): string[] {
  return (optionalEnv("OWNER_USER_IDS") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isOwner(userId: string): boolean {
  return ownerUserIds().includes(userId);
}

/**
 * Sign-up allow-list. With ALLOWED_SIGNUP_EMAILS unset, sign-up is closed.
 */
export function signupAllowed(email: string): boolean {
  const allowed = (optionalEnv("ALLOWED_SIGNUP_EMAILS") ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.trim().toLowerCase());
}

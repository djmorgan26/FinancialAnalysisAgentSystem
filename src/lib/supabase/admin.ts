import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

/**
 * Service-role client. Bypasses RLS. Use ONLY in server-side code that
 * already knows the acting user and has validated they have permission
 * to touch the rows being written. Always pass `user_id` explicitly.
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase admin client not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)."
    );
  }
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

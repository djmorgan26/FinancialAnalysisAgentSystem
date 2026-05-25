import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { DEMO_USER_EMAIL, DEMO_USER_ID, isDemoActive } from "@/lib/demo/constants";

export async function getSupabaseServer(): Promise<SupabaseClient> {
  const store = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
      process.env.SUPABASE_URL ??
      "http://demo.invalid",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
      process.env.SUPABASE_ANON_KEY ??
      "demo-anon-key",
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              store.set(name, value, options)
            );
          } catch {
            // Called from a Server Component where cookies are read-only.
          }
        },
      },
    }
  );
}

/** Synthetic user returned in no-login demo mode. */
function demoUser(): User {
  return {
    id: DEMO_USER_ID,
    email: DEMO_USER_EMAIL,
    aud: "authenticated",
    role: "authenticated",
    app_metadata: { provider: "demo" },
    user_metadata: { name: "Demo User" },
    created_at: new Date(0).toISOString(),
  } as User;
}

export async function requireUser() {
  // In demo mode, return a synthetic user without any Supabase auth call so
  // the app works with the database paused and no env keys configured.
  if (await isDemoActive()) {
    const supabase = await getSupabaseServer();
    return { user: demoUser(), supabase };
  }

  const supabase = await getSupabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new Error("Unauthorized");
  }
  return { user: data.user, supabase };
}

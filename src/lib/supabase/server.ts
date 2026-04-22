import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function getSupabaseServer(): Promise<SupabaseClient> {
  const store = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY!,
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

export async function requireUser() {
  const supabase = await getSupabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new Error("Unauthorized");
  }
  return { user: data.user, supabase };
}

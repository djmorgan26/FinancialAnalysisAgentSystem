import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { signupAllowed } from "@/lib/owner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/auth/sign-up — create a confirmed user via admin API.
 *
 * Bypasses Supabase's confirmation-email flow entirely so sign-up works
 * regardless of the project's Site URL / redirect allow-list. The client
 * then signs in with the password immediately after this succeeds.
 */
export async function POST(req: NextRequest) {
  const { email, password } = (await req.json()) as {
    email?: string;
    password?: string;
  };

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required." },
      { status: 400 }
    );
  }
  // Private app: only allow-listed emails may create an account.
  if (!signupAllowed(email)) {
    return NextResponse.json(
      { error: "Sign-up is closed." },
      { status: 403 }
    );
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 }
    );
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) {
    // Friendly message for the common "already exists" case
    const msg = /already registered|already exists/i.test(error.message)
      ? "An account with that email already exists. Try signing in instead."
      : error.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  return NextResponse.json({ ok: true, userId: data.user?.id });
}

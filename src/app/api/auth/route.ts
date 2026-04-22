import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";

/** POST /api/auth?action=signout — clears the session cookie and returns. */
export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");

  const supabase = await getSupabaseServer();

  if (action === "signout") {
    await supabase.auth.signOut();
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}

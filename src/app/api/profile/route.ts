import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { loadUserProfile, saveUserProfile } from "@/lib/data-store";

export async function GET() {
  try {
    const { user } = await requireUser();
    const profile = await loadUserProfile(user.id);
    return NextResponse.json(profile);
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { user } = await requireUser();
    const body = await req.json();
    await saveUserProfile(user.id, body);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "failed" },
      { status: 500 }
    );
  }
}

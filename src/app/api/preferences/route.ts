import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import {
  loadInvestmentPreferences,
  saveInvestmentPreferences,
} from "@/lib/data-store";

export async function GET() {
  try {
    const { user } = await requireUser();
    const prefs = await loadInvestmentPreferences(user.id);
    return NextResponse.json(prefs);
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { user } = await requireUser();
    const body = await req.json();
    await saveInvestmentPreferences(user.id, body);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "failed" },
      { status: 500 }
    );
  }
}

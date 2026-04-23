import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/server";
import {
  invalidateAnalysis,
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
    // Emergency fund target, sector caps, core tickers, etc. all feed the
    // analysis — drop the cache so the dashboard recomputes.
    await invalidateAnalysis(user.id);
    revalidatePath("/plan");
    revalidatePath("/");
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[PATCH /api/preferences] failed:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : typeof err === "object" && err && "message" in err
              ? String((err as { message: unknown }).message)
              : "failed",
      },
      { status: 500 }
    );
  }
}

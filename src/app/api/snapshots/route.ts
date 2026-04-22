import { NextResponse } from "next/server";
import { loadSnapshots } from "@/lib/data-store";
import { requireUser } from "@/lib/supabase/server";

/** GET /api/snapshots — snapshots for the signed-in user, oldest first. */
export async function GET() {
  try {
    const { user } = await requireUser();
    const snapshots = await loadSnapshots(user.id);
    return NextResponse.json({ snapshots, count: snapshots.length });
  } catch (error) {
    console.error("[GET /api/snapshots] Failed to load snapshots:", error);
    return NextResponse.json(
      { error: "Failed to load snapshots" },
      { status: 500 }
    );
  }
}

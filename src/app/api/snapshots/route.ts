import { NextResponse } from "next/server";
import { loadSnapshots } from "@/lib/data-store";

/**
 * GET /api/snapshots
 * Returns all historical snapshots sorted chronologically (oldest first).
 * Used for net-worth trend tracking and historical comparison.
 */
export async function GET() {
  try {
    const snapshots = await loadSnapshots();
    return NextResponse.json({ snapshots, count: snapshots.length });
  } catch (error) {
    console.error("[GET /api/snapshots] Failed to load snapshots:", error);
    return NextResponse.json(
      { error: "Failed to load snapshots" },
      { status: 500 },
    );
  }
}

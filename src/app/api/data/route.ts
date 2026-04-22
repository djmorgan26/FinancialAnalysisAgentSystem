import { NextResponse } from "next/server";
import { loadFinancialData } from "@/lib/data-store";
import { requireUser } from "@/lib/supabase/server";

/**
 * GET /api/data
 * Returns the current consolidated financial data for the signed-in user.
 */
export async function GET() {
  try {
    const { user } = await requireUser();
    const data = await loadFinancialData(user.id);
    return NextResponse.json(data);
  } catch (error) {
    console.error("[GET /api/data] Failed to load financial data:", error);
    return NextResponse.json(
      { error: "Failed to load financial data" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { loadFinancialData } from "@/lib/data-store";

/**
 * GET /api/data
 * Returns the current consolidated financial data (accounts, transactions, holdings).
 */
export async function GET() {
  try {
    const data = await loadFinancialData();
    return NextResponse.json(data);
  } catch (error) {
    console.error("[GET /api/data] Failed to load financial data:", error);
    return NextResponse.json(
      { error: "Failed to load financial data" },
      { status: 500 },
    );
  }
}

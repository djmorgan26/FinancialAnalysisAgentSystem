import { NextResponse } from "next/server";
import {
  loadAnalysis,
  saveAnalysis,
  loadFinancialData,
  loadUserProfile,
  createSnapshot,
} from "@/lib/data-store";
import { runAnalysis } from "@/lib/analysis";

/**
 * GET /api/analysis
 * Returns the latest persisted analysis result, or 404 if none exists.
 */
export async function GET() {
  try {
    const analysis = await loadAnalysis();
    if (!analysis) {
      return NextResponse.json(
        { error: "No analysis available. Trigger one via POST." },
        { status: 404 },
      );
    }
    return NextResponse.json(analysis);
  } catch (error) {
    console.error("[GET /api/analysis] Failed to load analysis:", error);
    return NextResponse.json(
      { error: "Failed to load analysis" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/analysis
 * Runs a fresh analysis over the current financial data and user profile,
 * persists the result, creates a snapshot, and returns the analysis.
 * Works with or without imported data — falls back to profile defaults.
 */
export async function POST() {
  try {
    const [data, profile] = await Promise.all([
      loadFinancialData(),
      loadUserProfile(),
    ]);

    const analysis = runAnalysis(data, profile);

    await Promise.all([saveAnalysis(analysis), createSnapshot(analysis)]);

    return NextResponse.json(analysis);
  } catch (error) {
    console.error("[POST /api/analysis] Analysis failed:", error);
    return NextResponse.json(
      { error: "Analysis failed" },
      { status: 500 },
    );
  }
}


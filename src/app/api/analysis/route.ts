import { NextResponse } from "next/server";
import {
  loadAnalysis,
  saveAnalysis,
  loadFinancialData,
  loadUserProfile,
  createSnapshot,
} from "@/lib/data-store";
import { runAnalysis } from "@/lib/analysis";
import { resolveClassifications } from "@/lib/classification";
import { requireUser } from "@/lib/supabase/server";

/** GET /api/analysis — latest persisted analysis for the signed-in user. */
export async function GET() {
  try {
    const { user } = await requireUser();
    const analysis = await loadAnalysis(user.id);
    if (!analysis) {
      return NextResponse.json(
        { error: "No analysis available. Trigger one via POST." },
        { status: 404 }
      );
    }
    return NextResponse.json(analysis);
  } catch (error) {
    console.error("[GET /api/analysis] Failed to load analysis:", error);
    return NextResponse.json(
      { error: "Failed to load analysis" },
      { status: 500 }
    );
  }
}

/** POST /api/analysis — run analysis for the signed-in user and snapshot. */
export async function POST() {
  try {
    const { user } = await requireUser();
    const [data, profile] = await Promise.all([
      loadFinancialData(user.id),
      loadUserProfile(user.id),
    ]);

    const classificationMap = await resolveClassifications(
      data.holdings.map((h) => h.symbol),
      user.id
    );

    const analysis = runAnalysis(data, profile, classificationMap);

    await Promise.all([
      saveAnalysis(user.id, analysis),
      createSnapshot(user.id, analysis),
    ]);

    return NextResponse.json(analysis);
  } catch (error) {
    console.error("[POST /api/analysis] Analysis failed:", error);
    return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import {
  classifyWithAI,
  resolveClassifications,
} from "@/lib/classification";
import {
  loadFinancialData,
  loadInvestmentPreferences,
  loadUserProfile,
  saveAnalysis,
  createSnapshot,
} from "@/lib/data-store";
import { runAnalysis } from "@/lib/analysis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  symbols?: string[];
  recomputeAnalysis?: boolean;
}

/**
 * POST /api/classify
 * Body: { symbols: string[], recomputeAnalysis?: boolean }
 * Runs the AI classifier over the provided symbols (skipping any already
 * classified with a non-fallback source), writes to the global cache, and
 * optionally triggers an analysis recompute so the dashboard updates.
 */
export async function POST(req: NextRequest) {
  let userId: string;
  try {
    ({ user: { id: userId } } = await requireUser());
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const symbols = (body.symbols ?? [])
    .filter((s) => typeof s === "string" && s.length > 0)
    .map((s) => s.toUpperCase());

  if (symbols.length === 0) {
    return NextResponse.json({ error: "symbols required" }, { status: 400 });
  }

  try {
    // Load existing classifications so we only pay for unknowns.
    const existing = await resolveClassifications(symbols, userId);
    const needsAI = symbols.filter((s) => {
      const c = existing.get(s);
      return !c || c.source === "fallback";
    });

    // Give the AI context (ticker name + asset-class hint) from the user's holdings.
    const data = await loadFinancialData(userId);
    const context: Record<string, { name?: string; hintAssetClass?: typeof data.holdings[number]["assetClass"] }> = {};
    for (const h of data.holdings) {
      const k = h.symbol.toUpperCase();
      if (!context[k]) context[k] = { name: h.name, hintAssetClass: h.assetClass };
    }

    let aiCount = 0;
    if (needsAI.length > 0) {
      const result = await classifyWithAI(needsAI, context);
      aiCount = result.size;
    }

    // Optionally recompute analysis so the dashboard reflects the new sectors.
    if (body.recomputeAnalysis) {
      const [profile, preferences] = await Promise.all([
        loadUserProfile(userId),
        loadInvestmentPreferences(userId),
      ]);
      const fresh = await resolveClassifications(
        data.holdings.map((h) => h.symbol),
        userId
      );
      const analysis = runAnalysis(data, profile, fresh, {
        emergencyFundTarget: preferences.emergencyFundTarget,
      });
      await Promise.all([
        saveAnalysis(userId, analysis),
        createSnapshot(userId, analysis).catch(() => undefined),
      ]);
    }

    return NextResponse.json({ classified: aiCount, requested: symbols.length });
  } catch (error) {
    console.error("[POST /api/classify] failed:", error);
    return NextResponse.json(
      { error: "classification failed" },
      { status: 500 }
    );
  }
}

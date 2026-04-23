import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import {
  SECTORS,
  ASSET_CLASSES,
  resolveClassifications,
  saveUserOverride,
} from "@/lib/classification";
import type { Sector, AssetClass } from "@/lib/types";
import {
  loadFinancialData,
  loadUserProfile,
  saveAnalysis,
  createSnapshot,
} from "@/lib/data-store";
import { runAnalysis } from "@/lib/analysis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  symbol?: string;
  sector?: string;
  assetClass?: string;
  recomputeAnalysis?: boolean;
}

/** POST /api/classify/override — save a per-user manual sector/asset-class override. */
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

  const symbol = body.symbol?.trim();
  const sector = body.sector as Sector | undefined;
  const assetClass = body.assetClass as AssetClass | undefined;

  if (!symbol) {
    return NextResponse.json({ error: "symbol required" }, { status: 400 });
  }
  if (!sector || !SECTORS.includes(sector)) {
    return NextResponse.json({ error: "invalid sector" }, { status: 400 });
  }
  if (assetClass && !ASSET_CLASSES.includes(assetClass)) {
    return NextResponse.json({ error: "invalid assetClass" }, { status: 400 });
  }

  try {
    await saveUserOverride(userId, symbol, sector, assetClass);

    if (body.recomputeAnalysis) {
      const [data, profile] = await Promise.all([
        loadFinancialData(userId),
        loadUserProfile(userId),
      ]);
      const map = await resolveClassifications(
        data.holdings.map((h) => h.symbol),
        userId
      );
      const analysis = runAnalysis(data, profile, map);
      await Promise.all([
        saveAnalysis(userId, analysis),
        createSnapshot(userId, analysis).catch(() => undefined),
      ]);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[POST /api/classify/override] failed:", error);
    return NextResponse.json(
      { error: "override save failed" },
      { status: 500 }
    );
  }
}

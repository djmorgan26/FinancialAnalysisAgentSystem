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
  loadInvestmentPreferences,
  loadUserProfile,
  saveAnalysis,
  createSnapshot,
} from "@/lib/data-store";
import { runAnalysis } from "@/lib/analysis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Item {
  symbol?: string;
  sector?: string;
  assetClass?: string;
  customCategoryId?: string | null;
}

interface Body extends Item {
  items?: Item[];
  recomputeAnalysis?: boolean;
}

interface ValidatedItem {
  symbol: string;
  sector: Sector;
  assetClass?: AssetClass;
  customCategoryId: string | null | undefined;
}

function validateItem(raw: Item): ValidatedItem | { error: string } {
  const symbol = raw.symbol?.trim();
  if (!symbol) return { error: "symbol required" };
  const sector = raw.sector as Sector | undefined;
  if (!sector || !SECTORS.includes(sector)) return { error: "invalid sector" };
  const assetClass = raw.assetClass as AssetClass | undefined;
  if (assetClass && !ASSET_CLASSES.includes(assetClass)) {
    return { error: "invalid assetClass" };
  }
  return {
    symbol,
    sector,
    assetClass,
    customCategoryId: raw.customCategoryId,
  };
}

/**
 * POST /api/classify/override
 *
 * Accepts either:
 *   { symbol, sector, assetClass?, customCategoryId?, recomputeAnalysis? }
 *   { items: [{...}], recomputeAnalysis? }
 *
 * Passing `customCategoryId: null` clears a previously assigned custom category.
 */
export async function POST(req: NextRequest) {
  let userId: string;
  try {
    ({
      user: { id: userId },
    } = await requireUser());
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const rawItems: Item[] =
    Array.isArray(body.items) && body.items.length > 0 ? body.items : [body];

  const validated: ValidatedItem[] = [];
  for (const raw of rawItems) {
    const v = validateItem(raw);
    if ("error" in v) {
      return NextResponse.json({ error: v.error }, { status: 400 });
    }
    validated.push(v);
  }

  try {
    for (const v of validated) {
      await saveUserOverride(
        userId,
        v.symbol,
        v.sector,
        v.assetClass,
        v.customCategoryId
      );
    }

    if (body.recomputeAnalysis) {
      const [data, profile, preferences] = await Promise.all([
        loadFinancialData(userId),
        loadUserProfile(userId),
        loadInvestmentPreferences(userId),
      ]);
      const map = await resolveClassifications(
        data.holdings.map((h) => h.symbol),
        userId
      );
      const analysis = runAnalysis(data, profile, map, {
        emergencyFundTarget: preferences.emergencyFundTarget,
        emergencyFundAccountIds: preferences.emergencyFundAccountIds,
        emergencyFundCurrentOverride: preferences.emergencyFundCurrentOverride,
      });
      await Promise.all([
        saveAnalysis(userId, analysis),
        createSnapshot(userId, analysis).catch(() => undefined),
      ]);
    }

    return NextResponse.json({ ok: true, saved: validated.length });
  } catch (error) {
    console.error("[POST /api/classify/override] failed:", error);
    return NextResponse.json(
      { error: "override save failed" },
      { status: 500 }
    );
  }
}

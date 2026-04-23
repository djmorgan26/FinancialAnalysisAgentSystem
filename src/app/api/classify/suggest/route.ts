import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { suggestWithAI } from "@/lib/classification";
import { loadFinancialData } from "@/lib/data-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  symbols?: string[];
}

/**
 * POST /api/classify/suggest
 * Body: { symbols: string[] }
 * Returns Gemini's suggested sector+assetClass for each symbol WITHOUT
 * persisting anything. The UI uses these to pre-fill dropdowns for user
 * review; acceptance happens via /api/classify/override.
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

  const symbols = (body.symbols ?? [])
    .filter((s) => typeof s === "string" && s.length > 0)
    .map((s) => s.toUpperCase());

  if (symbols.length === 0) {
    return NextResponse.json({ error: "symbols required" }, { status: 400 });
  }

  try {
    const data = await loadFinancialData(userId);
    const context: Record<
      string,
      { name?: string; hintAssetClass?: (typeof data.holdings)[number]["assetClass"] }
    > = {};
    for (const h of data.holdings) {
      const k = h.symbol.toUpperCase();
      if (!context[k]) context[k] = { name: h.name, hintAssetClass: h.assetClass };
    }

    const map = await suggestWithAI(symbols, context);
    const suggestions = symbols
      .map((s) => {
        const c = map.get(s);
        if (!c) return null;
        return {
          symbol: s,
          sector: c.sector,
          assetClass: c.assetClass,
          name: c.name,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error("[POST /api/classify/suggest] failed:", error);
    return NextResponse.json(
      { error: "classification failed" },
      { status: 500 }
    );
  }
}

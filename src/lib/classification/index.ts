import { GoogleGenAI, Type } from "@google/genai";
import type { Sector, AssetClass } from "@/lib/types";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

// ============================================================
// Symbol Classification Service
// ============================================================
//
// Resolves each holding symbol to a { sector, assetClass } pair.
// Sources, in priority order:
//   1. user_symbol_overrides  (per-user manual)
//   2. symbol_classifications (global cache — AI or heuristic)
//   3. fallback               ({ sector: "other", assetClass: "other" })
//
// Classification via Gemini is on-demand (triggered by the UI); the analysis
// hot path never makes network calls — it just reads from cache.

export const SECTORS: readonly Sector[] = [
  "technology",
  "healthcare",
  "financials",
  "consumer_discretionary",
  "consumer_staples",
  "industrials",
  "energy",
  "utilities",
  "materials",
  "real_estate",
  "communication_services",
  "semiconductors",
  "ai_ml",
  "quantum_computing",
  "biotech",
  "crypto",
  "broad_market",
  "other",
] as const;

export const ASSET_CLASSES: readonly AssetClass[] = [
  "us_equity",
  "intl_equity",
  "fixed_income",
  "cash",
  "crypto",
  "commodity",
  "real_estate",
  "other",
] as const;

export interface Classification {
  sector: Sector;
  assetClass: AssetClass;
  source: "manual" | "ai" | "heuristic" | "fallback";
  name?: string;
  customCategoryId?: string;
  customCategoryName?: string;
}

export type ClassificationMap = Map<string, Classification>;

export interface UserCustomCategory {
  id: string;
  name: string;
}

const FALLBACK: Classification = {
  sector: "other",
  assetClass: "other",
  source: "fallback",
};

interface OverrideRow {
  symbol: string;
  sector: string;
  asset_class: string | null;
  custom_category_id: string | null;
  user_custom_categories:
    | { id: string; name: string }
    | { id: string; name: string }[]
    | null;
}

/**
 * Load classifications for a set of symbols. Reads from both tables and
 * layers user overrides on top. Missing symbols get the fallback.
 */
export async function resolveClassifications(
  symbols: string[],
  userId: string
): Promise<ClassificationMap> {
  const upper = [...new Set(symbols.map((s) => s.toUpperCase()))].filter(Boolean);
  const map: ClassificationMap = new Map();
  if (upper.length === 0) return map;

  const supabase = getSupabaseAdmin();

  const [globalRes, overrideRes] = await Promise.all([
    supabase
      .from("symbol_classifications")
      .select("symbol, sector, asset_class, name, source")
      .in("symbol", upper),
    supabase
      .from("user_symbol_overrides")
      .select(
        "symbol, sector, asset_class, custom_category_id, user_custom_categories(id, name)"
      )
      .eq("user_id", userId)
      .in("symbol", upper),
  ]);

  if (globalRes.data) {
    for (const row of globalRes.data) {
      map.set(row.symbol, {
        sector: row.sector as Sector,
        assetClass: row.asset_class as AssetClass,
        source: row.source as Classification["source"],
        name: row.name ?? undefined,
      });
    }
  }

  if (overrideRes.data) {
    for (const row of overrideRes.data as OverrideRow[]) {
      const existing = map.get(row.symbol);
      const customCategory = Array.isArray(row.user_custom_categories)
        ? row.user_custom_categories[0]
        : row.user_custom_categories;
      map.set(row.symbol, {
        sector: row.sector as Sector,
        assetClass:
          (row.asset_class as AssetClass) ?? existing?.assetClass ?? "other",
        source: "manual",
        name: existing?.name,
        customCategoryId: row.custom_category_id ?? undefined,
        customCategoryName: customCategory?.name ?? undefined,
      });
    }
  }

  for (const symbol of upper) {
    if (!map.has(symbol)) map.set(symbol, FALLBACK);
  }

  return map;
}

/**
 * Return the subset of symbols in `map` that are unclassified
 * (source === "fallback" or sector === "other").
 */
export function findUnclassified(
  map: ClassificationMap,
  symbols: string[]
): string[] {
  const out = new Set<string>();
  for (const s of symbols) {
    const upper = s.toUpperCase();
    const c = map.get(upper);
    if (!c || c.source === "fallback" || c.sector === "other") {
      out.add(upper);
    }
  }
  return [...out];
}

// ------------------------------------------------------------
// AI classifier
// ------------------------------------------------------------

interface AISuggestion {
  symbol: string;
  sector: Sector;
  assetClass: AssetClass;
  name?: string;
}

/**
 * Call Gemini for a batch of symbols and return their classifications. Does NOT
 * persist results — use `persistClassifications` to write them to the global
 * `symbol_classifications` cache.
 */
export async function suggestWithAI(
  symbols: string[],
  context?: Record<string, { name?: string; hintAssetClass?: AssetClass }>
): Promise<Map<string, Classification>> {
  const upper = [...new Set(symbols.map((s) => s.toUpperCase()))].filter(Boolean);
  const result = new Map<string, Classification>();
  if (upper.length === 0) return result;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const ai = new GoogleGenAI({ apiKey });

  const symbolLines = upper.map((s) => {
    const ctx = context?.[s];
    const hint = ctx?.name ? ` (${ctx.name})` : "";
    const ac = ctx?.hintAssetClass ? ` [asset_class hint: ${ctx.hintAssetClass}]` : "";
    return `- ${s}${hint}${ac}`;
  });

  const prompt = `Classify each ticker below into a sector and an asset class using the provided taxonomies.

Sector taxonomy (use EXACTLY these values):
${SECTORS.join(", ")}

Asset-class taxonomy (use EXACTLY these values):
${ASSET_CLASSES.join(", ")}

Guidelines:
- "broad_market" is for S&P 500 / total-market / Nasdaq-100 index funds (VOO, VTI, QQQ, QQQM, FXAIX, SPY, SCHB, SCHG, etc.).
- "semiconductors" for chip makers and semi ETFs (NVDA, AMD, TSM, AVGO, SMH, SOXX).
- "ai_ml" only for companies/ETFs whose core business is AI/ML (PLTR, AI, BOTZ, ROBO, AIQ, CHAT). Not general tech.
- "quantum_computing" for quantum-focused names (IONQ, QBTS, RGTI, QUBT, ARQQ, QTUM ETF).
- "biotech" for biotech companies and ETFs (XBI, IBB, ARKG).
- "crypto" for cryptocurrencies and crypto ETFs (BTC, ETH, SOL, IBIT, GBTC).
- Ultrashort Treasury / floating-rate bond ETFs (SGOV, BIL, SHV, USFR, TFLO, ICSH, FLOT) → sector "other", asset_class "fixed_income". They trade like cash but pay dividends; users typically bucket these under a custom "Cash Equivalents" category.
- Target-date funds and balanced/allocation funds → "broad_market", asset_class "us_equity".
- Money-market / cash funds (SWVXX, SPAXX, VMFXX) → sector "other", asset_class "cash".
- If genuinely unknown, use sector "other" and your best asset-class guess.

Tickers to classify:
${symbolLines.join("\n")}

Return JSON only.`;

  const resp = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      temperature: 0,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          classifications: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                symbol: { type: Type.STRING },
                sector: { type: Type.STRING, enum: [...SECTORS] },
                assetClass: { type: Type.STRING, enum: [...ASSET_CLASSES] },
                name: { type: Type.STRING },
              },
              required: ["symbol", "sector", "assetClass"],
            },
          },
        },
        required: ["classifications"],
      },
    },
  });

  const text = resp.text ?? "";
  let parsed: { classifications: AISuggestion[] };
  try {
    parsed = JSON.parse(text);
  } catch {
    console.error("[suggestWithAI] failed to parse Gemini response:", text);
    throw new Error("AI returned invalid JSON");
  }

  for (const c of parsed.classifications ?? []) {
    const symbol = c.symbol.toUpperCase();
    if (!upper.includes(symbol)) continue;
    const sectorValid = SECTORS.includes(c.sector as Sector);
    const assetClassValid = ASSET_CLASSES.includes(c.assetClass as AssetClass);
    if (!sectorValid || !assetClassValid) {
      console.warn("[suggestWithAI] rejected out-of-enum value for", c.symbol, {
        sector: c.sector,
        assetClass: c.assetClass,
      });
    }
    result.set(symbol, {
      sector: sectorValid ? (c.sector as Sector) : "other",
      assetClass: assetClassValid ? (c.assetClass as AssetClass) : "other",
      source: "ai",
      name: c.name ?? context?.[symbol]?.name ?? undefined,
    });
  }

  return result;
}

/**
 * Persist a classification map to the global `symbol_classifications` cache.
 */
export async function persistClassifications(
  map: Map<string, Classification>
): Promise<void> {
  if (map.size === 0) return;
  const rows = [...map.entries()].map(([symbol, c]) => ({
    symbol,
    sector: c.sector,
    asset_class: c.assetClass,
    name: c.name ?? null,
    source: c.source === "manual" ? "manual" : c.source === "heuristic" ? "heuristic" : "ai",
    updated_at: new Date().toISOString(),
  }));
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("symbol_classifications")
    .upsert(rows, { onConflict: "symbol" });
  if (error) {
    console.error("[persistClassifications] cache write failed:", error);
    throw error;
  }
}

/**
 * Backward-compat: suggest + persist. Callers that want the old behavior.
 */
export async function classifyWithAI(
  symbols: string[],
  context?: Record<string, { name?: string; hintAssetClass?: AssetClass }>
): Promise<Map<string, Classification>> {
  const result = await suggestWithAI(symbols, context);
  await persistClassifications(result);
  return result;
}

/**
 * Save a manual user override. Pass `customCategoryId: null` to explicitly
 * clear a previously assigned custom category.
 */
export async function saveUserOverride(
  userId: string,
  symbol: string,
  sector: Sector,
  assetClass?: AssetClass,
  customCategoryId?: string | null
): Promise<void> {
  const upper = symbol.toUpperCase();
  const supabase = getSupabaseAdmin();
  const row: Record<string, unknown> = {
    user_id: userId,
    symbol: upper,
    sector,
    asset_class: assetClass ?? null,
    updated_at: new Date().toISOString(),
  };
  if (customCategoryId !== undefined) {
    row.custom_category_id = customCategoryId;
  }
  const { error } = await supabase
    .from("user_symbol_overrides")
    .upsert(row, { onConflict: "user_id,symbol" });
  if (error) throw error;
}

/** List the user's custom categories. */
export async function getUserCustomCategories(
  userId: string
): Promise<UserCustomCategory[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("user_custom_categories")
    .select("id, name")
    .eq("user_id", userId)
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as UserCustomCategory[];
}

/** Create a custom category. Throws on unique-violation so the API can 409. */
export async function createUserCustomCategory(
  userId: string,
  name: string
): Promise<UserCustomCategory> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("user_custom_categories")
    .insert({ user_id: userId, name })
    .select("id, name")
    .single();
  if (error) throw error;
  return data as UserCustomCategory;
}

/** Delete a custom category owned by this user. FK is ON DELETE SET NULL, so
 *  any overrides referencing it are cleared automatically. */
export async function deleteUserCustomCategory(
  userId: string,
  id: string
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("user_custom_categories")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw error;
}

/**
 * Apply a classification map to a list of holdings, returning a new array
 * with `sector` (and `assetClass` when the classification overrides it).
 *
 * The caller still retains original holdings — this is a pure transform.
 */
export function applyClassifications<T extends { symbol: string; sector: Sector; assetClass: AssetClass }>(
  holdings: T[],
  map: ClassificationMap
): T[] {
  return holdings.map((h) => {
    const c = map.get(h.symbol.toUpperCase());
    if (!c || c.source === "fallback") return h;
    // Preserve the holding's own sector if the classifier returned "other"
    // but the holding already has a more specific sector from the importer.
    const sector = c.sector === "other" && h.sector !== "other" ? h.sector : c.sector;
    const assetClass =
      c.source === "manual" && c.assetClass !== "other" ? c.assetClass : h.assetClass;
    return { ...h, sector, assetClass };
  });
}

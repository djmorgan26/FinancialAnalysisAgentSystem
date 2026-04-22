import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import {
  saveUserProfile,
  saveInvestmentPreferences,
} from "@/lib/data-store";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

interface OnboardingPayload {
  name: string;
  age?: number;
  annualIncome?: number;
  occupation?: string;
  riskTolerance: "conservative" | "moderate" | "aggressive";
  timeHorizon: "short" | "medium" | "long";
  sectorBias: string[];
  rothIraAnnualTarget?: number;
  rothIraYtdContributed?: number;
  coreAllocationMinPercent?: number;
  claimLegacyData?: boolean;
}

export async function POST(req: NextRequest) {
  let userId: string;
  try {
    ({ user: { id: userId } } = await requireUser());
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as OnboardingPayload;

  await saveUserProfile(userId, {
    name: body.name,
    age: body.age,
    annualIncome: body.annualIncome,
    occupation: body.occupation,
    investmentPreferences: {
      riskTolerance: body.riskTolerance,
      timeHorizon: body.timeHorizon,
      sectorBias: body.sectorBias as never,
    },
    onboardingComplete: true,
  });

  await saveInvestmentPreferences(userId, {
    rothIraAnnualTarget: body.rothIraAnnualTarget,
    rothIraYtdContributed: body.rothIraYtdContributed,
    coreAllocationMinPercent: body.coreAllocationMinPercent,
  });

  // Optional legacy claim — move any rows with NULL user_id to this user.
  // One-time migration for the original single-user data that predates auth.
  if (body.claimLegacyData) {
    const supabase = getSupabaseAdmin();
    const tables = [
      "accounts",
      "holdings",
      "transactions",
      "snapshots",
      "sync_logs",
      "schwab_tokens",
      "analysis_cache",
      "investment_preferences",
    ];
    for (const table of tables) {
      const { error } = await supabase
        .from(table)
        .update({ user_id: userId })
        .is("user_id", null);
      if (error) {
        console.warn(`[onboarding] failed to claim ${table}:`, error.message);
      }
    }
  }

  return NextResponse.json({ ok: true });
}

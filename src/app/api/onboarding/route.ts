import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import {
  saveUserProfile,
  saveInvestmentPreferences,
} from "@/lib/data-store";

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

  return NextResponse.json({ ok: true });
}

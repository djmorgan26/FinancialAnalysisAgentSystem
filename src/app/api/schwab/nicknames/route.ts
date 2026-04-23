import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { saveSchwabNickname } from "@/lib/schwab-sync";

export async function PATCH(request: NextRequest) {
  let userId: string;
  try {
    ({ user: { id: userId } } = await requireUser());
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { last4, name } = await request.json() as { last4: string; name: string };
  if (!last4 || typeof name !== "string") {
    return NextResponse.json({ error: "last4 and name required" }, { status: 400 });
  }
  await saveSchwabNickname(userId, last4.trim(), name.trim());
  return NextResponse.json({ ok: true });
}

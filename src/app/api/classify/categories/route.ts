import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import {
  createUserCustomCategory,
  deleteUserCustomCategory,
  getUserCustomCategories,
  SECTORS,
} from "@/lib/classification";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RESERVED = new Set(SECTORS.map((s) => s.toLowerCase().replace(/_/g, " ")));

export async function GET() {
  let userId: string;
  try {
    ({
      user: { id: userId },
    } = await requireUser());
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const categories = await getUserCustomCategories(userId);
    return NextResponse.json({ categories });
  } catch (error) {
    console.error("[GET /api/classify/categories] failed:", error);
    return NextResponse.json({ error: "load failed" }, { status: 500 });
  }
}

interface PostBody {
  name?: string;
}

export async function POST(req: NextRequest) {
  let userId: string;
  try {
    ({
      user: { id: userId },
    } = await requireUser());
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }
  if (name.length > 40) {
    return NextResponse.json(
      { error: "name too long (max 40 chars)" },
      { status: 400 }
    );
  }
  if (RESERVED.has(name.toLowerCase())) {
    return NextResponse.json(
      { error: "name collides with a built-in sector" },
      { status: 400 }
    );
  }
  try {
    const category = await createUserCustomCategory(userId, name);
    return NextResponse.json({ category });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/duplicate|unique/i.test(message)) {
      return NextResponse.json(
        { error: "category already exists" },
        { status: 409 }
      );
    }
    console.error("[POST /api/classify/categories] failed:", error);
    return NextResponse.json({ error: "create failed" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  let userId: string;
  try {
    ({
      user: { id: userId },
    } = await requireUser());
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const id = new URL(req.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  try {
    await deleteUserCustomCategory(userId, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[DELETE /api/classify/categories] failed:", error);
    return NextResponse.json({ error: "delete failed" }, { status: 500 });
  }
}

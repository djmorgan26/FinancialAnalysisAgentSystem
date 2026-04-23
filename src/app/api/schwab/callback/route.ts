/**
 * GET /api/schwab/callback — OAuth callback handler.
 * Schwab redirects here after the user authorizes the app.
 * The `state` query parameter carries the user_id that initiated the OAuth
 * flow. We verify it against the currently signed-in Supabase session so
 * tokens can never be bound to a different user's row.
 */
import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens } from "@/lib/schwab-api";
import { requireUser } from "@/lib/supabase/server";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function redirectError(
  request: NextRequest,
  reason: string
): NextResponse {
  return NextResponse.redirect(
    new URL(
      `/connections?schwab=error&reason=${encodeURIComponent(reason)}`,
      request.url
    )
  );
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const rawState = request.nextUrl.searchParams.get("state");

  if (!code) return redirectError(request, "no_code");
  if (!rawState) return redirectError(request, "missing_state");

  let state: string;
  try {
    state = decodeURIComponent(rawState);
  } catch {
    return redirectError(request, "invalid_state");
  }
  if (!UUID_RE.test(state)) return redirectError(request, "invalid_state");

  let userId: string;
  try {
    ({ user: { id: userId } } = await requireUser());
  } catch {
    return redirectError(request, "unauthorized");
  }

  if (userId !== state) return redirectError(request, "state_mismatch");

  try {
    await exchangeCodeForTokens(state, decodeURIComponent(code));
    return NextResponse.redirect(
      new URL("/connections?schwab=connected", request.url)
    );
  } catch (err: unknown) {
    console.error("Schwab OAuth callback error:", err);
    return redirectError(request, "exchange_failed");
  }
}

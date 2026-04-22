/**
 * GET /api/schwab/callback — OAuth callback handler.
 * Schwab redirects here after the user authorizes the app.
 * The `state` query parameter carries the user_id that initiated the OAuth
 * flow, so we can associate the returned tokens with the correct account.
 */
import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens } from "@/lib/schwab-api";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");

  if (!code) {
    return NextResponse.redirect(
      new URL("/connections?schwab=error&reason=no_code", request.url)
    );
  }
  if (!state) {
    return NextResponse.redirect(
      new URL("/connections?schwab=error&reason=missing_state", request.url)
    );
  }

  try {
    await exchangeCodeForTokens(state, decodeURIComponent(code));
    return NextResponse.redirect(
      new URL("/connections?schwab=connected", request.url)
    );
  } catch (err: unknown) {
    console.error("Schwab OAuth callback error:", err);
    const message = err instanceof Error ? err.message : "unknown";
    return NextResponse.redirect(
      new URL(
        `/connections?schwab=error&reason=${encodeURIComponent(message)}`,
        request.url
      )
    );
  }
}

/**
 * GET /api/schwab/callback — OAuth callback handler.
 * Schwab redirects here after the user authorizes the app.
 */
import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens } from "@/lib/schwab-api";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(
      new URL("/?schwab=error&reason=no_code", request.url)
    );
  }

  try {
    await exchangeCodeForTokens(decodeURIComponent(code));
    // Redirect to dashboard with success flag
    return NextResponse.redirect(
      new URL("/?schwab=connected", request.url)
    );
  } catch (err: unknown) {
    console.error("Schwab OAuth callback error:", err);
    const message = err instanceof Error ? err.message : "unknown";
    return NextResponse.redirect(
      new URL(
        `/?schwab=error&reason=${encodeURIComponent(message)}`,
        request.url
      )
    );
  }
}

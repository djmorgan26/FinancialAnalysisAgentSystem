import { NextResponse, type NextRequest } from "next/server";
import { DEMO_COOKIE } from "@/lib/demo/constants";

export const dynamic = "force-dynamic";

/**
 * Entry point for the no-login demo. Visiting `/demo` sets the demo cookie and
 * redirects to the dashboard, where the app runs entirely on mock fixtures.
 * `/demo?exit=1` clears the cookie and returns to the sign-in screen.
 */
function handle(request: NextRequest) {
  const exit = request.nextUrl.searchParams.get("exit") === "1";
  const url = request.nextUrl.clone();
  url.search = "";
  url.pathname = exit ? "/sign-in" : "/";

  const response = NextResponse.redirect(url);
  if (exit) {
    response.cookies.delete(DEMO_COOKIE);
  } else {
    response.cookies.set(DEMO_COOKIE, "1", {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });
  }
  return response;
}

export function GET(request: NextRequest) {
  return handle(request);
}

export function POST(request: NextRequest) {
  return handle(request);
}

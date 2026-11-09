import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { DEMO_COOKIE, isDemoForced } from "@/lib/demo/constants";

const PUBLIC_PATHS = new Set([
  "/sign-in",
  "/sign-up",
  "/forgot-password",
  "/auth/callback",
  "/demo",
]);

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (pathname.startsWith("/api/schwab/callback")) return true;
  // Scheduled jobs authenticate with CRON_SECRET inside the route itself.
  if (pathname.startsWith("/api/cron/")) return true;
  if (pathname.startsWith("/_next")) return true;
  if (pathname.startsWith("/favicon")) return true;
  return false;
}

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });
  const { pathname } = request.nextUrl;

  // No-login demo mode: the env flag (NEXT_PUBLIC_DEMO_MODE / DEMO_MODE) or the
  // demo cookie stands in for an authenticated session. When forced via env we
  // never construct a Supabase client, so the app works with the database
  // paused and even when real Supabase env vars are present.
  const inDemo = isDemoForced() || request.cookies.get(DEMO_COOKIE)?.value === "1";
  if (inDemo) {
    // Keep the demo user out of the auth screens — send them to the dashboard.
    if (pathname === "/sign-in" || pathname === "/sign-up") {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      url.searchParams.delete("next");
      return NextResponse.redirect(url);
    }
    return response;
  }

  // If Supabase isn't configured (e.g. preview build with no keys), don't
  // crash — just let public paths through and bounce everything else to the
  // sign-in screen, which surfaces the "View live demo" entry point.
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const supabaseAnon =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnon) {
    if (isPublic(pathname)) return response;
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnon, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublic(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && (pathname === "/sign-in" || pathname === "/sign-up")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.searchParams.delete("next");
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { stripBasePath } from "@/lib/base-path";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = stripBasePath(
    request.nextUrl.pathname,
    request.nextUrl.basePath
  );

  // Public routes that don't require auth
  const publicRoutes = ["/login", "/signup", "/auth/callback", "/paywall", "/forgot-password"];
  // API routes that don't require auth (webhooks, cron uses bearer token)
  const publicApiRoutes = ["/api/billing/webhook", "/api/signals/slack", "/api/cron/"];
  const isPublicRoute = publicRoutes.some((route) => pathname === route || pathname.startsWith(route + "/"));
  const isPublicApiRoute = publicApiRoutes.some((route) => pathname.startsWith(route));
  const isLandingPage = pathname === "/";

  // If no user and trying to access protected route, redirect to login
  if (!user && !isPublicRoute && !isPublicApiRoute && !isLandingPage) {
    // For API routes, return 401 instead of redirect
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // If user exists and trying to access login/signup, redirect to dashboard
  if (user && (pathname === "/login" || pathname === "/signup")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // Admin route protection — check is_admin flag (cached in cookie)
  const isApiRoute = pathname.startsWith("/api/");
  if (user && pathname.startsWith("/admin")) {
    const adminCookie = request.cookies.get("is_admin")?.value;
    if (adminCookie === "true") {
      // Cached — allow through
    } else if (adminCookie === "false") {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    } else {
      // No cookie — check DB
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .single();

      if (profile?.is_admin) {
        supabaseResponse.cookies.set("is_admin", "true", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 60 * 60 * 24, // 1 day
        });
      } else {
        supabaseResponse.cookies.set("is_admin", "false", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 60 * 60 * 24,
        });
        const url = request.nextUrl.clone();
        url.pathname = "/dashboard";
        return NextResponse.redirect(url);
      }
    }
  }

  // Check onboarding status for authenticated users (not on onboarding or API routes)
  // Use a cookie cache to avoid DB query on every request
  if (
    user &&
    !isApiRoute &&
    pathname !== "/onboarding" &&
    !pathname.startsWith("/auth/")
  ) {
    const onboardingCookie = request.cookies.get("onboarding_completed")?.value;
    if (onboardingCookie !== "true") {
      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_completed")
        .eq("id", user.id)
        .single();

      if (profile?.onboarding_completed) {
        // Cache in cookie so we don't hit DB on every request
        supabaseResponse.cookies.set("onboarding_completed", "true", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 60 * 60 * 24 * 30, // 30 days
        });
      } else if (profile && !profile.onboarding_completed) {
        const url = request.nextUrl.clone();
        url.pathname = "/onboarding";
        return NextResponse.redirect(url);
      }
    }
  }

  return supabaseResponse;
}

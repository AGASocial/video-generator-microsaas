import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

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
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Extract locale from pathname (e.g., /en/generate or /generate)
  const pathname = request.nextUrl.pathname;
  const localeMatch = pathname.match(/^\/(en|es)(\/|$)/);
  const currentLocale = localeMatch ? localeMatch[1] : null;
  const pathWithoutLocale = localeMatch 
    ? pathname.replace(`/${localeMatch[1]}`, '') || '/'
    : pathname;

  // Protect routes that require authentication (locale-aware)
  // Note: /credits is public (users can view pricing without login)
  const protectedRoutes = ["/generate", "/profile"];
  const isProtectedRoute = protectedRoutes.some((route) =>
    pathWithoutLocale.startsWith(route)
  );

  // Redirect unauthenticated users from protected routes to login
  if (!session && isProtectedRoute) {
    const url = request.nextUrl.clone();
    // Always include locale prefix (with 'always' mode, even default locale has prefix)
    url.pathname = `/${currentLocale || 'es'}/auth/login`;
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from auth pages
  if (session) {
    if (pathWithoutLocale.startsWith("/auth/login")) {
      const redirect = request.nextUrl.searchParams.get("redirect") || "/generate";
      // Ensure we don't redirect to the same path (prevent loops)
      if (redirect !== "/auth/login" && redirect !== pathname) {
        const redirectUrl = new URL(redirect, request.url);
        return NextResponse.redirect(redirectUrl);
      }
    }
    if (pathWithoutLocale.startsWith("/auth/sign-up")) {
      // Always include locale prefix
      const generatePath = `/${currentLocale || 'es'}/generate`;
      return NextResponse.redirect(new URL(generatePath, request.url));
    }
  }

  return supabaseResponse;
}

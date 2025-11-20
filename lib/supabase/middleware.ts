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

  // Protect routes that require authentication
  const protectedRoutes = ["/generate", "/credits", "/profile"];
  const isProtectedRoute = protectedRoutes.some((route) =>
    request.nextUrl.pathname.startsWith(route)
  );

  // Redirect unauthenticated users from protected routes to login
  if (!session && isProtectedRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    url.searchParams.set("redirect", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from auth pages
  if (session) {
    if (request.nextUrl.pathname.startsWith("/auth/login")) {
      const redirect = request.nextUrl.searchParams.get("redirect") || "/generate";
      // Ensure we don't redirect to the same path (prevent loops)
      if (redirect !== "/auth/login" && redirect !== request.nextUrl.pathname) {
        const redirectUrl = new URL(redirect, request.url);
        return NextResponse.redirect(redirectUrl);
      }
    }
    if (request.nextUrl.pathname.startsWith("/auth/sign-up")) {
      return NextResponse.redirect(new URL("/generate", request.url));
    }
  }

  return supabaseResponse;
}

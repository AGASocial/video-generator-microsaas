import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

const intlMiddleware = createMiddleware(routing);

export async function middleware(request: NextRequest) {
  // Skip middleware for API routes - they should not have locale prefixes
  if (request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next();
  }
  
  // First, run next-intl middleware for locale negotiation
  const intlResponse = await intlMiddleware(request);
  
  // If intl middleware returns a response (redirect or rewrite), return it immediately
  if (intlResponse) {
    return intlResponse;
  }
  
  // Then, run Supabase session logic
  const supabaseResponse = await updateSession(request);
  
  // If Supabase returns a redirect, preserve the locale in the redirect URL
  if (supabaseResponse && (supabaseResponse.status === 307 || supabaseResponse.status === 308)) {
    const redirectUrl = supabaseResponse.headers.get('location');
    if (redirectUrl) {
      // Extract locale from current path
      const pathname = request.nextUrl.pathname;
      const pathnameIsMissingLocale = routing.locales.every(
        (locale) => !pathname.startsWith(`/${locale}/`) && pathname !== `/${locale}`
      );
      
      // Get the default locale
      const defaultLocale = routing.defaultLocale;
      
      // Extract locale from pathname or use default
      let locale = defaultLocale;
      if (!pathnameIsMissingLocale) {
        const pathnameLocale = routing.locales.find(
          (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
        );
        if (pathnameLocale) {
          locale = pathnameLocale;
        }
      }
      
      // Ensure redirect URL includes locale prefix (always with 'always' prefix mode)
      const redirectUrlObj = new URL(redirectUrl, request.url);
      const redirectPath = redirectUrlObj.pathname;
      
      // Always add locale prefix since we're using 'always'
      if (!redirectPath.startsWith(`/${locale}`)) {
        redirectUrlObj.pathname = `/${locale}${redirectPath === '/' ? '' : redirectPath}`;
      }
      
      // Create new redirect response with proper locale
      const newResponse = NextResponse.redirect(redirectUrlObj, { status: supabaseResponse.status });
      
      // Copy all headers from Supabase response
      supabaseResponse.headers.forEach((value, key) => {
        if (key !== 'location') {
          newResponse.headers.set(key, value);
        }
      });
      
      return newResponse;
    }
    return supabaseResponse;
  }
  
  // Continue with the request
  return supabaseResponse || NextResponse.next();
}

export const config = {
  matcher: [
    // Exclude API routes, static files, images, and videos from middleware
    // The pattern matches all paths except those starting with excluded prefixes
    "/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp4|webm|mov)$).*)",
  ],
};

import { type NextRequest, NextResponse } from "next/server";
import createIntlMiddleware from 'next-intl/middleware';
import { getToken } from "next-auth/jwt";
import { guestRegex, isDevelopmentEnvironment } from "./lib/constants";
import { routing } from "./i18n/routing";

const intlMiddleware = createIntlMiddleware(routing);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  /*
   * Playwright starts the dev server and requires a 200 status to
   * begin the tests, so this ensures that the tests can start
   */
  if (pathname.startsWith("/ping")) {
    return new Response("pong", { status: 200 });
  }

  // Check if this is an API route (with or without locale prefix)
  const isApiRoute = pathname.startsWith("/api") || 
    routing.locales.some(locale => pathname.startsWith(`/${locale}/api`));
  
  const isApiAuthRoute = pathname.startsWith("/api/auth") || 
    routing.locales.some(locale => pathname.startsWith(`/${locale}/api/auth`));

  // Handle API routes
  if (isApiRoute) {
    if (isApiAuthRoute) {
      return NextResponse.next();
    }

    const token = await getToken({
      req: request,
      secret: process.env.AUTH_SECRET,
      secureCookie: !isDevelopmentEnvironment,
    });

    if (!token) {
      const redirectUrl = encodeURIComponent(request.url);

      return NextResponse.redirect(
        new URL(`/api/auth/guest?redirectUrl=${redirectUrl}`, request.url)
      );
    }

    return NextResponse.next();
  }

  // Skip auth checks for API auth routes
  if (isApiAuthRoute) {
    return intlMiddleware(request);
  }

  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
    secureCookie: !isDevelopmentEnvironment,
  });

  if (!token) {
    const redirectUrl = encodeURIComponent(request.url);

    return NextResponse.redirect(
      new URL(`/api/auth/guest?redirectUrl=${redirectUrl}`, request.url)
    );
  }

  const isGuest = guestRegex.test(token?.email ?? "");

  // Check for login/register with or without locale prefix
  const isLoginOrRegister = pathname === "/login" || pathname === "/register" ||
    routing.locales.some(locale => pathname === `/${locale}/login` || pathname === `/${locale}/register`);

  if (token && !isGuest && isLoginOrRegister) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Apply i18n middleware for page routes
  return intlMiddleware(request);
}

export const config = {
  matcher: [
    // Root path
    "/",
    // Locale paths
    "/:locale(en|fa)/:path*",
    // API paths
    "/api/:path*",
    // Auth paths (without locale)
    "/login",
    "/register",

    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     * - fonts (font files)
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|fonts).*)",
  ],
};

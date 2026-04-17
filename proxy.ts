import { type NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { guestRegex, isDevelopmentEnvironment } from "./lib/constants";

export async function proxy(request: NextRequest) {
  const { pathname, origin } = request.nextUrl;

  // Quick responses for simple paths
  if (pathname.startsWith("/ping")) return new Response("pong", { status: 200 });
  if (pathname.startsWith("/api/auth")) return NextResponse.next();

  // Get token once
  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
    secureCookie: !isDevelopmentEnvironment,
  });

  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

  // Precompute redirect URL once
  const redirectUrl = encodeURIComponent(pathname);

  // Guest redirect if not authenticated
  if (!token) {
    return NextResponse.redirect(
      new URL(`${base}/api/auth/guest?redirectUrl=${redirectUrl}`, origin)
    );
  }

  const isGuest = guestRegex.test(token.email ?? "");

  // Authenticated users shouldn't access login/register
  if (!isGuest && (pathname === "/login" || pathname === "/register")) {
    return NextResponse.redirect(new URL(`${base}/`, origin));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/chat/:id",
    "/api/:path*",
    "/login",
    "/register",
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};

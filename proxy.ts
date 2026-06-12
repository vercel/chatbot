import { type NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { guestRegex, isDevelopmentEnvironment } from "./lib/constants";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/ping")) {
    return new Response("pong", { status: 200 });
  }

  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  // Bearer-token authenticated API routes — bypass JWT check.
  // These routes handle their own auth via NEPTUNE_INTERNAL_TOKEN or similar.
  if (
    pathname.startsWith("/api/skill") ||
    pathname.startsWith("/api/v2") ||
    pathname.startsWith("/api/vercel/webhook") ||
    pathname.startsWith("/api/mcp") ||
    pathname.startsWith("/api/sandbox/stream") ||
    pathname.startsWith("/api/tools") ||
    pathname.startsWith("/api/connectors") ||
    pathname.startsWith("/api/workflow") ||
    pathname.startsWith("/api/context") ||
    pathname.startsWith("/api/secrets")
  ) {
    return NextResponse.next();
  }

  // Public library pages — bypass JWT check.
  // These are informational catalog pages (skills, connectors, playbooks, memory)
  // that render the library UI for all users, including guests.
  const publicLibraryPaths = [
    "/skills",
    "/connectors",
    "/playbooks",
    "/memory",
    "/tools",
    "/integrations",
    "/knowledge",
    "/vault",
    "/reports",
    "/secrets",
  ];
  if (publicLibraryPaths.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
    secureCookie: !isDevelopmentEnvironment,
  });

  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

  if (!token) {
    const redirectUrl = encodeURIComponent(new URL(request.url).pathname);

    return NextResponse.redirect(
      new URL(`${base}/api/auth/guest?redirectUrl=${redirectUrl}`, request.url)
    );
  }

  const isGuest = guestRegex.test(token?.email ?? "");

  if (token && !isGuest && ["/login", "/register"].includes(pathname)) {
    return NextResponse.redirect(new URL(`${base}/`, request.url));
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

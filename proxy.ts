import { type NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { guestRegex, isDevelopmentEnvironment } from "./lib/constants";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

  // Health check
  if (pathname.startsWith("/ping")) {
    return new Response("pong", { status: 200 });
  }

  // Public paths — no auth required
  const publicPaths = [
    "/login",
    "/register",
    "/api/auth",
    "/access-denied",
    "/_next",
    "/favicon.ico",
    "/api/vercel",
  ];
  if (publicPaths.some((p) => pathname.startsWith(p))) {
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
    pathname.startsWith("/api/secrets") ||
    pathname.startsWith("/api/capabilities") ||
    pathname.startsWith("/api/playbooks") ||
    pathname.startsWith("/api/research") ||
    pathname.startsWith("/api/plan-mode") ||
    pathname.startsWith("/api/annotations") ||
    pathname.startsWith("/api/file-tree") ||
    pathname.startsWith("/api/prds") ||
    pathname.startsWith("/api/shared-skills") ||
    pathname.startsWith("/api/function-trace") ||
    pathname.startsWith("/api/connector-graph") ||
    pathname.startsWith("/api/vault") ||
    pathname.startsWith("/api/wiki") ||
    pathname.startsWith("/api/integrations")
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

  // Protected routes: require authentication
  if (!token) {
    const loginUrl = new URL(`${base}/login`, request.url);
    loginUrl.searchParams.set("callbackUrl", request.url);
    return NextResponse.redirect(loginUrl);
  }

  const isGuest = guestRegex.test(token?.email ?? "");

  // Guest users: redirect to access-denied on protected routes
  if (isGuest) {
    const deniedUrl = new URL(`${base}/access-denied`, request.url);
    return NextResponse.redirect(deniedUrl);
  }

  // Authenticated users: redirect away from login/register
  if (!isGuest && ["/login", "/register"].includes(pathname)) {
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

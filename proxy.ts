import { type NextRequest, NextResponse } from "next/server";

const isLocalEnvironment = process.env.LOCAL_ENVIRONMENT === "true";

function base64UrlDecode(str: string): Uint8Array {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(
    base64.length + ((4 - (base64.length % 4)) % 4),
    "="
  );
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

async function verifyHS256(token: string, secret: string): Promise<boolean> {
  const parts = token.split(".");
  if (parts.length !== 3) return false;

  try {
    const [header, payload, signature] = parts;
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const data = new TextEncoder().encode(`${header}.${payload}`);
    const sig = base64UrlDecode(signature);
    return crypto.subtle.verify("HMAC", key, sig, data);
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/ping")) {
    return new Response("pong", { status: 200 });
  }

  if (isLocalEnvironment) {
    return NextResponse.next();
  }

  const secret = process.env.IFRAME_SECRET;
  if (!secret) {
    console.error("IFRAME_SECRET is not set");
    return NextResponse.rewrite(new URL("/404", request.url));
  }

  const tokenFromUrl = request.nextUrl.searchParams.get("token");

  if (tokenFromUrl) {
    const isValid = await verifyHS256(tokenFromUrl, secret);
    if (isValid) {
      const url = request.nextUrl.clone();
      url.searchParams.delete("token");
      const response = NextResponse.redirect(url);
      response.cookies.set("portal-token", tokenFromUrl, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "none",
        path: "/",
      });
      return response;
    }
    return NextResponse.rewrite(new URL("/404", request.url));
  }

  const cookieToken = request.cookies.get("portal-token")?.value;
  if (cookieToken) {
    const isValid = await verifyHS256(cookieToken, secret);
    if (isValid) {
      return NextResponse.next();
    }
    const response = NextResponse.rewrite(new URL("/404", request.url));
    response.cookies.delete("portal-token");
    return response;
  }

  return NextResponse.rewrite(new URL("/404", request.url));
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|404).*)",
  ],
};

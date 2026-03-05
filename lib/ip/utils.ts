import { headers } from "next/headers";
import { NextRequest } from "next/server";


export interface IpResult {
    ip: string;
    source: IpSource;
    isLoopback: boolean;
    isPrivate: boolean;
    isValid: boolean;
    raw: string; // original header value before parsing
}

export type IpSource =
    | "cf-connecting-ip"   // Cloudflare
    | "x-real-ip"          // Nginx
    | "x-forwarded-for"    // Load balancers / proxies
    | "x-client-ip"        // Apache
    | "x-cluster-client-ip"
    | "forwarded"          // RFC 7239
    | "request-ip"         // Express-style
    | "fallback";

// ─── Validation ───────────────────────────────────────────────────────────────

const IPV4_REGEX =
    /^(25[0-5]|2[0-4]\d|1\d{2}|[1-9]\d|\d)\.(25[0-5]|2[0-4]\d|1\d{2}|[1-9]\d|\d)\.(25[0-5]|2[0-4]\d|1\d{2}|[1-9]\d|\d)\.(25[0-5]|2[0-4]\d|1\d{2}|[1-9]\d|\d)$/;

const IPV6_REGEX =
    /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|(([0-9a-fA-F]{1,4}:){0,6}[0-9a-fA-F]{1,4})?::([0-9a-fA-F]{1,4}:){0,6}[0-9a-fA-F]{1,4}|::1|::)$/;

export function isValidIp(ip: string): boolean {
    if (!ip || typeof ip !== "string") return false;
    const trimmed = ip.trim();
    return IPV4_REGEX.test(trimmed) || IPV6_REGEX.test(trimmed);
}

export function isLoopbackIp(ip: string): boolean {
    return (
        ip === "127.0.0.1" ||
        ip === "::1" ||
        ip === "localhost" ||
        ip.startsWith("127.")
    );
}

export function isPrivateIp(ip: string): boolean {
    if (isLoopbackIp(ip)) return true;

    // IPv4 private ranges
    const privateRanges = [
        /^10\./,                          // 10.0.0.0/8
        /^172\.(1[6-9]|2\d|3[01])\./,    // 172.16.0.0/12
        /^192\.168\./,                    // 192.168.0.0/16
        /^169\.254\./,                    // Link-local
        /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, // CGNAT 100.64.0.0/10
    ];

    return privateRanges.some((r) => r.test(ip));
}

// ─── Header Parsers ───────────────────────────────────────────────────────────

/**
 * Parses RFC 7239 `Forwarded` header.
 * e.g. `Forwarded: for=192.0.2.60;proto=http, for=198.51.100.17`
 */
function parseForwardedHeader(value: string): string | null {
    const match = value.match(/for=["[]?([^\]",;>\s]+)/i);
    if (!match) return null;
    // Strip IPv6 brackets: [::1] → ::1
    return match[1].replace(/^\[|\]$/g, "").trim() || null;
}

/**
 * Extracts the first valid IP from a comma-separated list (x-forwarded-for).
 * Skips private/loopback IPs to find the real client IP.
 */
function parseXForwardedFor(value: string): string | null {
    const ips = value.split(",").map((ip) => ip.trim());

    // Prefer first non-private IP (true public client)
    for (const ip of ips) {
        if (isValidIp(ip) && !isPrivateIp(ip)) return ip;
    }

    // Fallback: first valid IP even if private (internal network scenario)
    for (const ip of ips) {
        if (isValidIp(ip)) return ip;
    }

    return null;
}


type HeaderGetter = (name: string) => string | null;

function resolveIpFromHeaders(get: HeaderGetter): IpResult {
    const checks: Array<{ source: IpSource; parse: () => string | null }> = [
        // Cloudflare — most authoritative when behind CF
        {
            source: "cf-connecting-ip",
            parse: () => {
                const v = get("cf-connecting-ip");
                return v && isValidIp(v.trim()) ? v.trim() : null;
            },
        },
        // Nginx / reverse proxy real IP
        {
            source: "x-real-ip",
            parse: () => {
                const v = get("x-real-ip");
                return v && isValidIp(v.trim()) ? v.trim() : null;
            },
        },
        // Standard proxy header
        {
            source: "x-forwarded-for",
            parse: () => {
                const v = get("x-forwarded-for");
                return v ? parseXForwardedFor(v) : null;
            },
        },
        // Apache / CDNs
        {
            source: "x-client-ip",
            parse: () => {
                const v = get("x-client-ip");
                return v && isValidIp(v.trim()) ? v.trim() : null;
            },
        },
        // AWS / Elastic Load Balancer
        {
            source: "x-cluster-client-ip",
            parse: () => {
                const v = get("x-cluster-client-ip");
                return v && isValidIp(v.trim()) ? v.trim() : null;
            },
        },
        // RFC 7239 standard
        {
            source: "forwarded",
            parse: () => {
                const v = get("forwarded");
                return v ? parseForwardedHeader(v) : null;
            },
        },
    ];

    for (const { source, parse } of checks) {
        const raw = get(
            source === "x-forwarded-for"
                ? "x-forwarded-for"
                : source === "forwarded"
                    ? "forwarded"
                    : source
        );

        const ip = parse();

        if (ip && isValidIp(ip)) {
            return {
                ip,
                source,
                isLoopback: isLoopbackIp(ip),
                isPrivate: isPrivateIp(ip),
                isValid: true,
                raw: raw ?? ip,
            };
        }
    }

    // Final fallback
    return {
        ip: "127.0.0.1",
        source: "fallback",
        isLoopback: true,
        isPrivate: true,
        isValid: false,
        raw: "127.0.0.1",
    };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Get the client IP from a `NextRequest` object.
 * Use this in Route Handlers and Middleware.
 *
 * @example
 * export async function POST(request: NextRequest) {
 *   const { ip } = getIpFromRequest(request);
 * }
 */
export function getIpFromRequest(request: NextRequest): IpResult {
    if (process.env.NODE_ENV === "development") {
        return makeMockResult();
    }

    return resolveIpFromHeaders((name) => request.headers.get(name));
}

/**
 * Get the client IP from Next.js `headers()` (Server Components & Server Actions).
 *
 * @example
 * // In a Server Action or Server Component
 * const { ip } = await getIpFromHeaders();
 */
export async function getIpFromHeaders(): Promise<IpResult> {
    if (process.env.NODE_ENV === "development") {
        return makeMockResult();
    }

    const headerStore = await headers();
    return resolveIpFromHeaders((name) => headerStore.get(name));
}

/**
 * Unified helper — accepts an optional `NextRequest`.
 * Falls back to `headers()` when no request is passed (Server Actions).
 *
 * @example
 * // Route Handler
 * export async function POST(req: NextRequest) {
 *   const { ip } = await getClientIp(req);
 * }
 *
 * // Server Action
 * 'use server'
 * const { ip } = await getClientIp();
 */
export async function getClientIp(request?: NextRequest): Promise<IpResult> {
    if (process.env.NODE_ENV === "development") {
        return makeMockResult();
    }

    if (request) {
        return getIpFromRequest(request);
    }

    return getIpFromHeaders();
}

/**
 * Convenience wrapper — returns just the IP string.
 * Returns `undefined` if the resolved IP is a loopback/fallback
 * and `skipLoopback` is true (useful for skipping quota tracking locally).
 */
export async function getClientIpString(
    request?: NextRequest,
    options: { skipLoopback?: boolean } = {}
): Promise<string | undefined> {
    const result = await getClientIp(request);

    if (options.skipLoopback && result.isLoopback) {
        return undefined;
    }

    return result.ip;
}

// ─── Dev helper ───────────────────────────────────────────────────────────────

function makeMockResult(): IpResult {
    const mockIp = process.env.MOCK_CLIENT_IP ?? "192.168.1.100";
    return {
        ip: mockIp,
        source: "fallback",
        isLoopback: isLoopbackIp(mockIp),
        isPrivate: isPrivateIp(mockIp),
        isValid: true,
        raw: mockIp,
    };
}
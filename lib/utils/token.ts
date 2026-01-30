export interface TokenPayload {
  org: { workosId: string; name: string };
  tab: { name: string; path: string };
  user: { workosId: string; email: string; fullName: string };
  iat?: number;
  exp?: number;
}

export function decodeToken(token: string | undefined): TokenPayload | null {
  if (!token) return null;

  try {
    const base64Payload = token.split(".")[1];
    return JSON.parse(atob(base64Payload));
  } catch {
    return null;
  }
}

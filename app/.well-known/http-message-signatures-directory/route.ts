import { NextResponse } from 'next/server';

// Public key JWK for Cloudflare Verified Bots
const jwks = {
  keys: [
    {
      crv: 'Ed25519',
      x: 'agtde4IbRrr3qKVIUkhDz1daflkQ5Krqjf9tJwzxOWc',
      kty: 'OKP',
    },
  ],
};

export async function GET() {
  return NextResponse.json(jwks, {
    headers: {
      'Content-Type': 'application/http-message-signatures-directory+json',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}

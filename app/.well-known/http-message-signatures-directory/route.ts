import { NextRequest, NextResponse } from 'next/server';
import nodeCrypto from 'crypto';
import { directoryResponseHeaders, helpers, MediaType } from 'web-bot-auth';
import { signerFromJWK } from 'web-bot-auth/crypto';

// Convert PEM private key to JWK format
function pemToJwk(pem: string): JsonWebKey {
  const privateKey = nodeCrypto.createPrivateKey({
    key: pem,
    format: 'pem',
  });

  return privateKey.export({ format: 'jwk' }) as JsonWebKey;
}

// Get the public JWK from a private JWK
function getPublicJwk(privateJwk: JsonWebKey): JsonWebKey {
  // For Ed25519, the public key is just the x parameter (without d)
  const { d: _d, ...publicJwk } = privateJwk;
  return publicJwk;
}

// Calculate JWK thumbprint using the helpers from web-bot-auth
async function calculateKeyId(jwk: JsonWebKey): Promise<string> {
  // JWK thumbprint per RFC 7638 - hash the canonical JSON of required members
  const requiredMembers =
    jwk.kty === 'OKP'
      ? { crv: jwk.crv, kty: jwk.kty, x: jwk.x }
      : { crv: jwk.crv, kty: jwk.kty, x: jwk.x, y: jwk.y };

  const json = JSON.stringify(requiredMembers);
  const encoder = new TextEncoder();
  const data = encoder.encode(json);

  const hash = await helpers.WEBCRYPTO_SHA256(data);
  return helpers.BASE64URL_DECODE(hash);
}

export async function GET(request: NextRequest) {
  const privateKeyPem = process.env.CLOUDFLARE_BOT_PRIVATE_KEY;

  if (!privateKeyPem) {
    console.error('CLOUDFLARE_BOT_PRIVATE_KEY environment variable not set');
    return NextResponse.json(
      { error: 'Server configuration error' },
      { status: 500 }
    );
  }

  try {
    // Convert PEM to JWK
    const privateJwk = pemToJwk(privateKeyPem);
    const publicJwk = getPublicJwk(privateJwk);

    // Calculate the JWK thumbprint for kid
    const keyId = await calculateKeyId(publicJwk);

    // Build the JWKS with kid included
    const jwks = {
      keys: [
        {
          ...publicJwk,
          kid: keyId,
        },
      ],
    };

    // Create a signer from the private key JWK
    const signer = await signerFromJWK(privateJwk);

    // Create a request-like object for signing
    // The @authority component is derived from the request URL
    // IMPORTANT: In Cloud Run behind a load balancer, request.url may contain
    // the internal URL. We need to use the Host header or X-Forwarded-Host
    // to get the correct external authority.
    const host = request.headers.get('host') || request.headers.get('x-forwarded-host');
    const protocol = request.headers.get('x-forwarded-proto') || 'https';

    // Construct the canonical URL using the external host
    const canonicalUrl = host
      ? `${protocol}://${host}${new URL(request.url).pathname}`
      : request.url;

    console.log('[HTTP-MSG-SIG] Request URL:', request.url);
    console.log('[HTTP-MSG-SIG] Host header:', host);
    console.log('[HTTP-MSG-SIG] Canonical URL:', canonicalUrl);

    const requestLike = {
      method: request.method,
      url: canonicalUrl,
      headers: Object.fromEntries(request.headers.entries()),
    };

    // Generate signature headers
    const now = new Date();
    const signatureHeaders = await directoryResponseHeaders(
      requestLike,
      [signer],
      {
        created: now,
        expires: new Date(now.getTime() + 5 * 60 * 1000), // 5 minutes
      }
    );

    // Return the signed response
    return new NextResponse(JSON.stringify(jwks), {
      headers: {
        'Content-Type': MediaType.HTTP_MESSAGE_SIGNATURES_DIRECTORY,
        'Cache-Control': 'public, max-age=60',
        Signature: signatureHeaders.Signature,
        'Signature-Input': signatureHeaders['Signature-Input'],
      },
    });
  } catch (error) {
    console.error('Error generating signed directory response:', error);
    return NextResponse.json(
      { error: 'Failed to generate signed response' },
      { status: 500 }
    );
  }
}

import { Redis } from '@upstash/redis';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { createLinkRequestSchema, type CreateLinkResponse } from './schema';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// AES-256-GCM encryption using AUTH_SECRET
function encrypt(text: string): string {
  const key = Buffer.from(process.env.AUTH_SECRET!).subarray(0, 32);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64url');
}

export { encrypt };

// Generate short random ID
function generateId(length = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const bytes = randomBytes(length);
  return Array.from(bytes).map(b => chars[b % chars.length]).join('');
}

export async function POST(request: Request) {
  try {
    // Parse and validate request body
    let requestBody;
    try {
      const json = await request.json();
      requestBody = createLinkRequestSchema.parse(json);
    } catch {
      return Response.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { content, expiresInHours } = requestBody;

    // Generate short ID and encrypt content
    const id = generateId();
    const encrypted = encrypt(content);

    // Store in Redis with TTL
    const ttlSeconds = expiresInHours * 60 * 60;
    await redis.set(`link:${id}`, encrypted, { ex: ttlSeconds });

    // Build the redirect URL
    const baseUrl = process.env.NEXTAUTH_URL || request.headers.get('origin') || '';
    const url = `${baseUrl}/link/${id}`;
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

    const response: CreateLinkResponse = {
      url,
      token: id,
      expiresAt: expiresAt.toISOString(),
    };

    return Response.json(response, { status: 201 });
  } catch (error) {
    console.error('Unexpected error in link creation:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

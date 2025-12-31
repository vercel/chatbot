import { redirect } from 'next/navigation';
import { Redis } from '@upstash/redis';
import { createDecipheriv } from 'crypto';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// AES-256-GCM decryption using AUTH_SECRET
function decrypt(encryptedData: string): string {
  const key = Buffer.from(process.env.AUTH_SECRET!).subarray(0, 32);
  const data = Buffer.from(encryptedData, 'base64url');
  const iv = data.subarray(0, 12);
  const tag = data.subarray(12, 28);
  const encrypted = data.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted) + decipher.final('utf8');
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  try {
    // Get encrypted content from Redis
    const encrypted = await redis.get<string>(`link:${token}`);

    if (!encrypted) {
      redirect('/?error=link_expired');
    }

    // Decrypt content
    const content = decrypt(encrypted);

    // Redirect to chat with the content pre-populated
    redirect(`/?query=${encodeURIComponent(content)}`);
  } catch (error) {
    console.error('Link retrieval failed:', error);
    redirect('/?error=link_invalid');
  }
}

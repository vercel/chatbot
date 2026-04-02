import { browser } from 'wxt/browser';
import {
  backgroundRequestSchema,
  backgroundResponseSchema,
  type BackgroundRequest,
  type BackgroundResponse,
  type BackgroundResponseType,
  type TypedBackgroundResponse,
} from '@/lib/messaging/contracts';

export async function sendBackgroundMessage(
  message: BackgroundRequest,
): Promise<BackgroundResponse> {
  const parsedMessage = backgroundRequestSchema.parse(message);
  const response = await browser.runtime.sendMessage(parsedMessage);
  return backgroundResponseSchema.parse(response);
}

export async function sendBackgroundMessageExpecting<
  T extends BackgroundResponseType,
>(
  message: BackgroundRequest,
  expectedType: T,
): Promise<TypedBackgroundResponse<T>> {
  const response = await sendBackgroundMessage(message);
  if (!response.ok) {
    throw new Error(response.error.message);
  }

  if (response.type !== expectedType) {
    throw new Error(
      `Unexpected background response type: ${response.type} (expected ${expectedType})`,
    );
  }

  return response as TypedBackgroundResponse<T>;
}

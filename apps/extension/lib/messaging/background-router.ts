import { browser } from 'wxt/browser';
import {
  clearAllAuthTokens,
  getAuthTokenInteractive,
  getAuthTokenSilent,
  getProfileUserInfo,
  invalidateToken,
} from '@/lib/auth/chrome-identity';
import {
  backgroundRequestSchema,
  type BackgroundRequest,
  type BackgroundResponse,
} from '@/lib/messaging/contracts';

const estimateTokens = (text: string): number => {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return Math.ceil(trimmed.length / 4);
};

const captureActivePageContext = async () => {
  const [tab] = await browser.tabs.query({
    active: true,
    currentWindow: true,
  });

  if (!tab?.id) {
    return null;
  }

  const [{ result }] = await browser.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      const selection = globalThis.getSelection?.()?.toString().trim() ?? '';
      const preview = (document.body?.innerText ?? '').slice(0, 2400);
      return {
        url: location.href,
        title: document.title,
        selection: selection.length > 0 ? selection : null,
        textPreview: preview,
      };
    },
  });

  if (!result) return null;

  return {
    url: result.url,
    title: result.title,
    selection: result.selection,
    textPreview: result.textPreview,
    tokenEstimate: estimateTokens(result.selection ?? result.textPreview),
  };
};

const handleRequest = async (
  message: BackgroundRequest,
): Promise<BackgroundResponse> => {
  switch (message.type) {
    case 'auth/get-token': {
      const token = message.interactive
        ? await getAuthTokenInteractive()
        : await getAuthTokenSilent();
      return {
        ok: true,
        type: 'auth/token',
        token,
      };
    }
    case 'auth/invalidate-token': {
      await invalidateToken(message.token);
      return {
        ok: true,
        type: 'auth/invalidate-token-result',
      };
    }
    case 'auth/clear': {
      await clearAllAuthTokens();
      return {
        ok: true,
        type: 'auth/clear-result',
      };
    }
    case 'auth/profile': {
      const profile = await getProfileUserInfo();
      return {
        ok: true,
        type: 'auth/profile',
        profile,
      };
    }
    case 'page/get-active-context': {
      const context = await captureActivePageContext();
      return {
        ok: true,
        type: 'page/context',
        context,
      };
    }
    default: {
      return {
        ok: false,
        error: {
          code: 'unsupported',
          message: 'Unsupported background message type.',
        },
      };
    }
  }
};

export function registerBackgroundRouter() {
  browser.runtime.onMessage.addListener(
    (
      rawMessage: unknown,
      _sender,
      sendResponse: (response: BackgroundResponse) => void,
    ) => {
      const parsed = backgroundRequestSchema.safeParse(rawMessage);
      if (!parsed.success) {
        sendResponse({
          ok: false,
          error: {
            code: 'bad_request',
            message: 'Invalid background message payload.',
          },
        });
        return false;
      }

      void handleRequest(parsed.data)
        .then((response) => sendResponse(response))
        .catch((error: unknown) => {
          sendResponse({
            ok: false,
            error: {
              code: 'internal',
              message: error instanceof Error ? error.message : 'Unexpected error.',
            },
          });
        });

      return true;
    },
  );
}

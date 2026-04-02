const OAUTH_SCOPES = ['openid', 'email', 'profile'] as const;

export type GoogleProfileShell = {
  email: string;
  id: string;
};

type GetAuthTokenOptions = {
  interactive: boolean;
  scopes?: readonly string[];
};

function getChromeIdentity() {
  if (!chrome?.identity) {
    throw new Error('Chrome Identity API is unavailable.');
  }

  return chrome.identity;
}

async function getAuthToken({
  interactive,
  scopes = OAUTH_SCOPES,
}: GetAuthTokenOptions): Promise<string> {
  const identity = getChromeIdentity();

  const result = await identity.getAuthToken({
    interactive,
    scopes: [...scopes],
  });

  if (!result?.token) {
    throw new Error('Chrome Identity did not return an access token.');
  }

  return result.token;
}

export async function getAuthTokenInteractive() {
  return getAuthToken({ interactive: true });
}

export async function getAuthTokenSilent() {
  return getAuthToken({ interactive: false });
}

export async function invalidateToken(token: string) {
  const identity = getChromeIdentity();
  await identity.removeCachedAuthToken({ token });
}

export async function clearAllAuthTokens() {
  const identity = getChromeIdentity();
  await identity.clearAllCachedAuthTokens();
}

export async function getProfileUserInfo() {
  const identity = getChromeIdentity();
  const info = await identity.getProfileUserInfo();
  if (!info.email || !info.id) {
    return null;
  }

  return {
    email: info.email,
    id: info.id,
  } satisfies GoogleProfileShell;
}

export async function fetchWithGoogleAuth(
  input: RequestInfo | URL,
  init: RequestInit = {},
) {
  let token = await getAuthTokenSilent().catch(async () =>
    getAuthTokenInteractive(),
  );

  const execute = async (accessToken: string) => {
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${accessToken}`);
    headers.set('Content-Type', 'application/json');

    return fetch(input, {
      ...init,
      headers,
    });
  };

  let response = await execute(token);

  if (response.status === 401) {
    await invalidateToken(token);
    token = await getAuthTokenInteractive();
    response = await execute(token);
  }

  return response;
}

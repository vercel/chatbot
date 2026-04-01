const requiredEnvVars = ['WXT_API_BASE_URL', 'WXT_GOOGLE_CLIENT_ID'] as const;

function readEnv(key: (typeof requiredEnvVars)[number], fallback: string): string {
  const value = import.meta.env[key];
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }

  if (import.meta.env.DEV) {
    return fallback;
  }

  throw new Error(`Missing required environment variable: ${key}`);
}

export const extensionEnv = {
  apiBaseUrl: readEnv('WXT_API_BASE_URL', 'http://localhost:4111'),
  googleClientId: readEnv(
    'WXT_GOOGLE_CLIENT_ID',
    '000000000000-dev.apps.googleusercontent.com',
  ),
  extensionKey: import.meta.env.WXT_EXTENSION_KEY?.trim() || undefined,
} as const;

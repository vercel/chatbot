import { defineConfig } from 'wxt';

const fallbackApiOrigin = 'https://example-cloud-run-url.a.run.app';

const apiOrigin = (() => {
  const configuredUrl = process.env.WXT_API_BASE_URL;
  if (!configuredUrl) return fallbackApiOrigin;

  try {
    return new URL(configuredUrl).origin;
  } catch {
    return fallbackApiOrigin;
  }
})();

const oauthClientId =
  process.env.WXT_GOOGLE_CLIENT_ID ??
  'REPLACE_WITH_GOOGLE_OAUTH_CLIENT_ID.apps.googleusercontent.com';

const extensionPublicKey = process.env.WXT_EXTENSION_KEY;

const manifest = {
  name: 'Helios Sidebar',
  description: 'Chrome-first sidepanel assistant with local-first state.',
  permissions: ['identity', 'identity.email', 'storage', 'scripting', 'activeTab', 'sidePanel'],
  host_permissions: [`${apiOrigin}/*`],
  oauth2: {
    client_id: oauthClientId,
    scopes: ['openid', 'email', 'profile'],
  },
  side_panel: {
    default_path: 'sidepanel.html',
  },
  ...(extensionPublicKey ? { key: extensionPublicKey } : {}),
};

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: manifest as any,
});

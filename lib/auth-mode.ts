export function hasEntraAuthConfig() {
  return Boolean(
    process.env.AUTH_MICROSOFT_ENTRA_ID_ID &&
      process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET
  );
}

export function isUiOnlyPreviewMode() {
  return process.env.AUTH_REQUIRED !== "true";
}

export function shouldRequireAuth() {
  return process.env.AUTH_REQUIRED === "true";
}

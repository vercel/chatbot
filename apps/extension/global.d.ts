/// <reference types="wxt" />

declare interface ImportMetaEnv {
  readonly DEV: boolean;
  readonly WXT_API_BASE_URL?: string;
  readonly WXT_GOOGLE_CLIENT_ID?: string;
  readonly WXT_EXTENSION_KEY?: string;
}

declare interface ImportMeta {
  readonly env: ImportMetaEnv;
}

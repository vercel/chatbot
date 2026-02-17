"server-only";

/**
 * Dify Console API の型定義
 */

export interface DifyAuthTokens {
  accessToken: string;
  csrfToken: string;
}

export interface DifyImportResponse {
  app_id: string;
  result?: string;
  status?: string;
}

export interface DifyPublishResponse {
  result?: string;
  status?: string;
  data?: {
    url?: string;
    public_url?: string;
  };
}

export interface DifyAppInfo {
  id: string;
  name: string;
  mode?: string;
  site?: {
    access_token?: string;
  };
  data?: {
    name?: string;
    site?: {
      access_token?: string;
    };
  };
}

export interface DifyImportAndPublishResult {
  importStatus: string;
  publishStatus: string;
  publishUrl: string | null;
  appId: string;
}

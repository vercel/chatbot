"server-only";

import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  DifyAppInfo,
  DifyAuthTokens,
  DifyImportAndPublishResult,
  DifyImportResponse,
  DifyPublishResponse,
} from "./types";

/**
 * Dify Console API クライアント
 * Bashスクリプト (dify-cli.sh) のロジックをTypeScriptで実装
 */
export class DifyClient {
  private readonly consoleApiBase: string;
  private readonly email: string;
  private readonly password: string;
  private readonly passwordBase64: boolean;
  private readonly authDir: string;

  private accessToken: string | null = null;
  private csrfToken: string | null = null;

  constructor() {
    this.consoleApiBase =
      process.env.DIFY_CONSOLE_API_BASE ?? process.env.CONSOLE_API_BASE ?? "";
    this.email = process.env.DIFY_EMAIL ?? process.env.EMAIL ?? "";
    this.password = process.env.DIFY_PASSWORD ?? process.env.PASSWORD ?? "";
    // デフォルトはtrue（平文パスワードだと "Invalid encrypted data" エラーになるため）
    // 明示的にfalseを設定した場合のみbase64エンコードを無効化
    this.passwordBase64 =
      process.env.PASSWORD_BASE64 !== "false" &&
      process.env.DIFY_PASSWORD_BASE64 !== "false";

    if (!this.consoleApiBase || !this.email || !this.password) {
      throw new Error(
        "Dify Console API credentials not configured. Set DIFY_CONSOLE_API_BASE, DIFY_EMAIL, and DIFY_PASSWORD in .env.local"
      );
    }

    // 認証ファイルの保存先（プロジェクトルート）
    this.authDir = process.cwd();
  }

  private getAuthFilePath(): string {
    return join(this.authDir, ".dify_auth");
  }

  private getCsrfFilePath(): string {
    return join(this.authDir, ".dify_csrf");
  }

  /**
   * 認証トークンをファイルから読み込む
   */
  private async loadAuthFromFile(): Promise<boolean> {
    try {
      const authFile = await readFile(this.getAuthFilePath(), "utf-8");
      const csrfFile = await readFile(this.getCsrfFilePath(), "utf-8");

      // Cookieヘッダーからトークンを抽出
      const cookieMatch = authFile.match(/access_token=([^;]+)/);
      if (cookieMatch) {
        this.accessToken = cookieMatch[1];
        this.csrfToken = csrfFile.trim();
        return true;
      }
    } catch {
      // ファイルが存在しない場合は認証が必要
    }
    return false;
  }

  /**
   * 認証トークンをファイルに保存
   */
  private async saveAuthToFile(tokens: DifyAuthTokens): Promise<void> {
    const authContent = `Cookie: access_token=${tokens.accessToken}; csrf_token=${tokens.csrfToken}\n`;
    await writeFile(this.getAuthFilePath(), authContent, "utf-8");
    await writeFile(this.getCsrfFilePath(), tokens.csrfToken, "utf-8");
  }

  /**
   * Difyにログインして認証トークンを取得
   */
  async login(): Promise<DifyAuthTokens> {
    const baseUrl = this.consoleApiBase.replace(/\/console\/api$/, "");
    const loginUrl = `${baseUrl}/console/api/login`;

    let password = this.password;
    if (this.passwordBase64) {
      password = Buffer.from(this.password).toString("base64");
    }

    const response = await fetch(loginUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        email: this.email,
        password,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(
        `Dify login failed (HTTP ${response.status}). ${errorText}`
      );
    }

    // Set-Cookieヘッダーからトークンを抽出
    const setCookieHeaders = response.headers.getSetCookie();
    let accessToken: string | null = null;
    let csrfToken: string | null = null;

    for (const cookie of setCookieHeaders) {
      const accessMatch = cookie.match(/access_token=([^;]+)/i);
      if (accessMatch) {
        accessToken = accessMatch[1];
      }

      const csrfMatch = cookie.match(/csrf_token=([^;]+)/i);
      if (csrfMatch) {
        csrfToken = csrfMatch[1];
      }
    }

    if (!accessToken || !csrfToken) {
      throw new Error(
        "Login succeeded but tokens not found in Set-Cookie headers"
      );
    }

    const tokens: DifyAuthTokens = {
      accessToken,
      csrfToken,
    };

    this.accessToken = accessToken;
    this.csrfToken = csrfToken;

    await this.saveAuthToFile(tokens);

    return tokens;
  }

  /**
   * 認証が有効か確認し、必要に応じてログイン
   */
  private async ensureAuth(): Promise<void> {
    // メモリにトークンがある場合は使用
    if (this.accessToken && this.csrfToken) {
      return;
    }

    // ファイルから読み込みを試行
    const loaded = await this.loadAuthFromFile();
    if (loaded && this.accessToken && this.csrfToken) {
      // 認証が有効か確認（簡単なチェック）
      try {
        await this.verifyAuth();
        return;
      } catch {
        // 認証が無効な場合は再ログイン
      }
    }

    // ログインが必要
    await this.login();
  }

  /**
   * 認証が有効か確認
   */
  private async verifyAuth(): Promise<void> {
    const response = await fetch(`${this.consoleApiBase}/apps?page=1&limit=1`, {
      headers: this.getAuthHeaders(),
    });

    if (response.status === 401) {
      throw new Error("Authentication expired");
    }

    if (!response.ok) {
      throw new Error(
        `Authentication verification failed: HTTP ${response.status}`
      );
    }
  }

  /**
   * 認証ヘッダーを取得
   */
  private getAuthHeaders(): HeadersInit {
    if (!this.accessToken || !this.csrfToken) {
      throw new Error("Not authenticated. Call login() first.");
    }

    const baseUrl = this.consoleApiBase.replace(/\/console\/api$/, "");

    return {
      Cookie: `access_token=${this.accessToken}; csrf_token=${this.csrfToken}`,
      "X-CSRF-Token": this.csrfToken,
      Accept: "application/json",
      Referer: `${baseUrl}/`,
      Origin: baseUrl,
    };
  }

  /**
   * DSLファイルをインポート
   */
  async importDsl(dslFilePath: string): Promise<DifyImportResponse> {
    await this.ensureAuth();

    const dslContent = await readFile(dslFilePath, "utf-8");

    const response = await fetch(`${this.consoleApiBase}/apps/imports`, {
      method: "POST",
      headers: {
        ...this.getAuthHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mode: "yaml-content",
        yaml_content: dslContent,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(
        `Dify import failed (HTTP ${response.status}). ${errorText}`
      );
    }

    const result = (await response.json()) as DifyImportResponse;
    return result;
  }

  /**
   * ワークフローを公開
   */
  async publishWorkflow(
    appId: string,
    markedName = "",
    markedComment = ""
  ): Promise<DifyPublishResponse> {
    await this.ensureAuth();

    const response = await fetch(
      `${this.consoleApiBase}/apps/${appId}/workflows/publish`,
      {
        method: "POST",
        headers: {
          ...this.getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          marked_name: markedName,
          marked_comment: markedComment,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(
        `Dify publish failed (HTTP ${response.status}). ${errorText}`
      );
    }

    return (await response.json()) as DifyPublishResponse;
  }

  /**
   * ワークフローの種類に応じた適切なパスを決定
   */
  private getPathByMode(mode?: string | null): string {
    // workflowモードの場合は/workflow/、それ以外（chat/advanced-chat/agent-chat）は/chat/
    return mode === "workflow" ? "workflow" : "chat";
  }

  /**
   * 公開URLを取得
   */
  async getPublishUrl(appId: string): Promise<string | null> {
    await this.ensureAuth();

    const baseUrl = this.consoleApiBase.replace(/\/console\/api$/, "");

    try {
      // 1) app情報からsite.access_tokenを取得（最優先）
      const appResponse = await fetch(`${this.consoleApiBase}/apps/${appId}`, {
        headers: this.getAuthHeaders(),
      });

      if (appResponse.ok) {
        const appInfo = (await appResponse.json()) as {
          data?: DifyAppInfo & { mode?: string };
        } & DifyAppInfo;

        const accessToken =
          appInfo.data?.site?.access_token ??
          appInfo.site?.access_token;

        if (accessToken && accessToken !== "null") {
          // ワークフローの種類（mode）を取得
          const mode = appInfo.data?.mode ?? appInfo.mode;
          const path = this.getPathByMode(mode);
          return `${baseUrl}/${path}/${accessToken}`;
        }
      }
    } catch {
      // エラーは無視して次の方法を試す
    }

    try {
      // 2) publish-infoからURLを取得
      const publishInfoResponse = await fetch(
        `${this.consoleApiBase}/apps/${appId}/workflows/publish`,
        {
          headers: this.getAuthHeaders(),
        }
      );

      if (publishInfoResponse.ok) {
        const publishInfo = (await publishInfoResponse.json()) as {
          data?: { url?: string; public_url?: string };
          url?: string;
          public_url?: string;
        };

        const url =
          publishInfo.data?.url ??
          publishInfo.data?.public_url ??
          publishInfo.url ??
          publishInfo.public_url;

        if (url && url !== "null") {
          return url;
        }
      }
    } catch {
      // エラーは無視
    }

    // 3) 最後の手段（互換用）
    return `${baseUrl}/workflow/${appId}`;
  }

  /**
   * DSLファイルをインポートして公開（一括実行）
   */
  async importAndPublish(
    dslFilePath: string
  ): Promise<DifyImportAndPublishResult> {
    // 1) インポート
    const importResult = await this.importDsl(dslFilePath);
    const appId = importResult.app_id;

    if (!appId) {
      throw new Error("Failed to extract app_id from import response");
    }

    const importStatus =
      importResult.result ?? importResult.status ?? "success";

    // 2) 公開
    const publishResult = await this.publishWorkflow(appId, "", "");
    const publishStatus =
      publishResult.result ?? publishResult.status ?? "success";

    // 3) 公開URL取得
    const publishUrl = await this.getPublishUrl(appId);

    return {
      importStatus,
      publishStatus,
      publishUrl,
      appId,
    };
  }
}

/**
 * Difyクライアントのシングルトンインスタンスを取得
 */
let difyClientInstance: DifyClient | null = null;

export function getDifyClient(): DifyClient | null {
  // 環境変数が設定されていない場合はnullを返す（オプショナル機能）
  const consoleApiBase =
    process.env.DIFY_CONSOLE_API_BASE ?? process.env.CONSOLE_API_BASE;
  const email = process.env.DIFY_EMAIL ?? process.env.EMAIL;
  const password = process.env.DIFY_PASSWORD ?? process.env.PASSWORD;

  if (!consoleApiBase || !email || !password) {
    console.warn(
      "[Dify Client] Environment variables not set. Required: DIFY_CONSOLE_API_BASE (or CONSOLE_API_BASE), DIFY_EMAIL (or EMAIL), DIFY_PASSWORD (or PASSWORD)"
    );
    return null;
  }

  if (!difyClientInstance) {
    try {
      difyClientInstance = new DifyClient();
      console.log("[Dify Client] Initialized successfully");
    } catch (error) {
      // 設定が不完全な場合はnullを返す
      console.error("[Dify Client] Initialization failed:", error);
      return null;
    }
  }

  return difyClientInstance;
}

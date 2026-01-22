# 実装手順ガイド (Webアプリ開発)

このドキュメントは、このプロジェクトでWebアプリを開発するための手順を、準備から実装・テストまで順番に整理したものです。基本は上から順に進めればOKです。

## 1. 事前準備

### 1.1 必須ツール
- Node.js と pnpm を用意します。
- `package.json` の `packageManager` は `pnpm@9.12.3` です。可能ならこのバージョンに合わせます。

### 1.2 pnpm の用意 (corepack 推奨)
```bash
corepack enable
corepack prepare pnpm@9.12.3 --activate
```

## 2. セットアップ (ローカル起動まで)

### 2.1 リポジトリ直下で作業
```bash
pwd
```
`/Users/momoseren/workspace/dify-WorkFlow/ai-chatbot` になっていればOKです。

### 2.2 依存関係をインストール
```bash
pnpm install
```
`pnpm-lock.yaml` を使って依存関係を固定し、`node_modules` を作成します。

### 2.3 環境変数を用意
```bash
cp .env.example .env.local
```
`.env.local` を開いて以下を埋めます（必要最低限）。

- `AUTH_SECRET`  
  例: `openssl rand -base64 32` で生成
- `AI_GATEWAY_API_KEY`  
  Vercel 以外の環境で AI Gateway を使う場合に必要 (ローカル開発では必須)
- `POSTGRES_URL`  
  DB 接続文字列
- `REDIS_URL`  
  Redis 接続文字列
- `BLOB_READ_WRITE_TOKEN`  
  Vercel Blob 用トークン

注意: `.env.local` はコミットしないでください。

#### 2.3.1 Vercel AI Gateway APIキーの設定 (現段階の方針)
現時点では Vercel AI Gateway を使用し、無料枠を使い切り次第、会社の OpenAI/Anthropic APIキーへの切り替えを検討します。
切り替え時は `lib/ai/providers.ts` の実装変更が必要です。

**APIキー設定手順 (ローカル)**
1. Vercel ダッシュボードを開く
2. `AI Gateway` で APIキーを作成
3. 発行されたキーを `.env.local` の `AI_GATEWAY_API_KEY` に設定
4. `pnpm dev` を再起動

**注意**
- AI Gateway はアカウントに有効なクレジットカードが無いと 403 を返す場合があります。
- Vercel にデプロイする場合は OIDC による自動認証が使われます (APIキー不要)。

### 2.4 DB マイグレーション
```bash
pnpm db:migrate
```
`POSTGRES_URL` が正しく設定されている必要があります。

#### 2.4.1 実行内容の内訳
`pnpm db:migrate` は内部で次を実行します。

- `npx tsx lib/db/migrate.ts`
- `.env.local` を読み込み、`POSTGRES_URL` を使って接続
- `lib/db/migrations` の内容をDBに適用

#### 2.4.2 実行ログ例 (今回のケース)
```text
> pnpm db:migrate
> npx tsx lib/db/migrate.ts

⏳ Running migrations...
NOTICE: identifier "..._fk" will be truncated to "..._f"
✅ Migrations completed in 11560 ms
```

補足:
- `NOTICE` はエラーではなく、PostgreSQL が制約名を最大長 (63文字) に切り詰めた通知です。
- `✅` が出ていればマイグレーションは正常完了です。

### 2.5 開発サーバ起動
```bash
pnpm dev
```
`http://localhost:3000` にアクセスして動作確認します。

#### 2.5.1 起動後に確認できる動作 (現段階)
- ブラウザで `http://localhost:3000/` が表示されれば、Next.js の開発サーバが正常に起動しています。
- 以降の画面や機能は、環境変数やDB接続の有無によって挙動が変わります。

#### 2.5.2 ホスト(開発サーバ)の停止方法
- 起動中のターミナルで `Ctrl + C` を押すと停止します。
- 停止後、ブラウザを再読み込みすると接続エラーになるのが正常です。

#### 2.5.3 再起動方法
```bash
pnpm dev
```
- 停止していた開発サーバを同じコマンドで再起動します。
- すでに別プロセスが同じポート(3000)を使用中の場合は、先に停止してから実行します。

#### 2.5.4 LLM疎通確認 (完了)
- 前提: `.env.local` の `AI_GATEWAY_API_KEY` を設定済みで、Vercel AI Gatewayが利用可能になっていること。
- ブラウザでチャット画面を開き、メッセージを送信します。
- 返答が表示されればLLM呼び出し成功です。
- サーバログで `POST /api/chat 200` が出ており、`GatewayInternalServerError` が出ていないことを確認します。

#### 2.5.5 現時点の完了内容 (記録)
- 依存関係のインストール完了 (`pnpm install`)
- DBマイグレーション完了 (`pnpm db:migrate`、`POSTGRES_URL` 設定済み)
- 開発サーバ起動完了 (`pnpm dev`)
- LLM応答の表示確認 (Vercel AI Gateway経由)

## 3. プロジェクト構成の把握

### 3.1 主要ディレクトリ
- `app/`  
  App Router のページ・レイアウト
  - `app/(auth)/` 認証関連のUIとAPI
  - `app/(chat)/` チャットUIとAPI
- `components/`  
  UIコンポーネント群 (`components/ui/` はshadcn/ui系)
- `lib/`  
  ドメインロジック
  - `lib/ai/` AI関連 (モデル、プロバイダ、プロンプト、ツール)
  - `lib/db/` DBスキーマとクエリ
- `public/`  
  静的ファイル
- `tests/`  
  Playwright のE2Eテスト

### 3.2 主要な実装ポイント
- ルート定義: `app/(chat)/.../page.tsx`  
- API ルート: `app/(chat)/api/**/route.ts`
- Server Actions: `app/(chat)/actions.ts`, `app/(auth)/actions.ts`
- DB スキーマ: `lib/db/schema.ts`
- DB クエリ: `lib/db/queries.ts`
- AI プロンプト: `lib/ai/prompts.ts`
- AI モデル/プロバイダ: `lib/ai/models.ts`, `lib/ai/providers.ts`

### 3.3 POST / GET の例 (今回の実装)

#### POST の例: チャット送信
- エンドポイント: `POST /api/chat`
- 実装ファイル: `app/(chat)/api/chat/route.ts`
- 目的: ユーザーのメッセージを受け取り、LLMの返答をストリーミングで返す
- 例: ブラウザで送信すると `POST /api/chat 200` がログに出る

#### GET の例: 履歴取得 / 投票取得
- エンドポイント: `GET /api/history?limit=20`
- 実装ファイル: `app/(chat)/api/history/route.ts`
- 目的: ログイン中ユーザーのチャット履歴を取得
- 例: 管理ログに `GET /api/history?limit=20 200`

- エンドポイント: `GET /api/vote?chatId=...`
- 実装ファイル: `app/(chat)/api/vote/route.ts`
- 目的: 特定チャットの投票情報を取得
- 例: 管理ログに `GET /api/vote?chatId=... 200`

## 4. 実装の流れ (機能追加の手順)

### 4.1 要件整理
1. 何を作るか (画面/操作/データ/AIの役割) を決める
2. 画面遷移とAPI入出力を決める
3. 必要なDBテーブル/カラムを洗い出す

### 4.2 ルーティングとページ
1. 画面を追加する場合は `app/(chat)/your-feature/page.tsx` を作成  
2. 共通レイアウトを使う場合は `app/layout.tsx` を利用  
3. 認証前提の画面は `(auth)` グループの設計も検討

### 4.3 データ設計とマイグレーション
1. `lib/db/schema.ts` にテーブル定義を追加/変更
2. マイグレーションを生成  
   ```bash
   pnpm db:generate
   ```
3. マイグレーションを適用  
   ```bash
   pnpm db:migrate
   ```
4. 変更に合わせて `lib/db/queries.ts` を追加/修正

### 4.4 API / Server Actions
1. UI から直接呼びたい処理は Server Actions を利用  
   - 例: `app/(chat)/actions.ts` に関数を追加  
2. 外部クライアントから呼びたい場合は API ルートを作成  
   - 例: `app/(chat)/api/your-feature/route.ts`

### 4.5 AI 機能の追加/変更
1. プロンプト設計: `lib/ai/prompts.ts` に追加
2. 使用モデルの変更: `lib/ai/models.ts` を更新
3. プロバイダ設定: `lib/ai/providers.ts` で切り替え
4. ツール呼び出し: `lib/ai/tools/` にツール定義を追加

### 4.6 UI コンポーネント実装
1. 再利用性が高いUIは `components/` に切り出す
2. デザインは `components/ui/` の既存コンポーネントを活用
3. 画面固有のUIは `app/(chat)/...` 内に配置

### 4.7 テストと品質チェック
1. ユニットテストが必要なら `tests/` に追加
2. E2E を確認
   ```bash
   pnpm test
   ```
3. 静的チェック
   ```bash
   pnpm lint
   pnpm format
   ```

## 5. よく使うコマンド

```bash
pnpm dev         # 開発サーバ起動
pnpm build       # 本番ビルド
pnpm start       # ビルド後の起動
pnpm db:migrate  # マイグレーション適用
pnpm db:generate # マイグレーション生成
pnpm db:studio   # Drizzle Studio
pnpm test        # Playwright E2E
pnpm lint        # 静的解析
pnpm format      # フォーマット
```

## 6. つまずきやすいポイント
- `.env.local` の値が不足していると起動やAI機能が失敗する
- `POSTGRES_URL` が無いとマイグレーションに失敗する
- pnpm のバージョン不一致で依存関係が崩れることがある

## 7. 次にやることの例
- 目的の画面とデータ構造を書き出す
- 必要なページ/API/DB変更を洗い出す
- 4章の順に実装する

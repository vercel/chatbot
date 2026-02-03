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
  Vercel 以外の環境で AI Gateway を使う場合に必要
- `AI_PROVIDER_MODE`  
  `gateway`(デフォルト) か `direct` を指定します。`direct` の場合は自前のAPIキーで直接LLMを呼び出します。
- `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `GOOGLE_GENERATIVE_AI_API_KEY`  
  `AI_PROVIDER_MODE=direct` のときに必要（使うプロバイダに応じて設定）
- `AI_DEFAULT_MODEL` / `AI_TITLE_MODEL` / `AI_ARTIFACT_MODEL`  
  任意。`AI_PROVIDER_MODE=direct` のとき、タイトル生成やArtifacts生成で使うモデルを `provider/model` 形式で上書きできます。
- `POSTGRES_URL`  
  DB 接続文字列
- `REDIS_URL`  
  Redis 接続文字列
- `BLOB_READ_WRITE_TOKEN`  
  Vercel Blob 用トークン

注意: `.env.local` はコミットしないでください。

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

## 6. Difyワークフロー専用モード

### 6.1 概要
- `/dify` を入口にした専用チャットモードを追加
- `rule_ver5.md` を system prompt に組み込み、DSL生成の対話フローを実行
- Difyモードではツール呼び出しを無効化（チャット出力のみ）
- 生成したDSL（```yaml```コードブロック）はDBへ自動保存

### 6.2 実装ファイル
- ルート/ページ
  - `app/dify/layout.tsx` (SidebarProvider + DataStreamProvider)
  - `app/dify/page.tsx` (新規チャット)
  - `app/dify/chat/[id]/page.tsx` (既存チャット)
- プロンプト/API
  - `lib/ai/prompts.ts` (systemPromptIdと`rule_ver5.md`の合成)
  - `app/(chat)/api/chat/schema.ts` (`systemPromptId` 追加)
  - `app/(chat)/api/chat/route.ts` (Difyモード時のプロンプト切り替え/ツール無効化)
- DB
  - `lib/db/schema.ts` (`DifyWorkflowDsl` テーブル)
  - `lib/db/queries.ts` (`saveDifyWorkflowDsl`)
  - `lib/db/migrations/0009_dify_workflow_dsl.sql`（マイグレーション）
- UI
  - `components/chat.tsx` (systemPromptId / chatPathPrefix / newChatPath / inputPlaceholder)
  - `components/multimodal-input.tsx` (送信後URLとplaceholder)
  - `components/chat-header.tsx` (New Chat遷移先)

### 6.3 使い方 (確認ポイント)
1. `http://localhost:3000/dify` を開く
2. 入力欄のプレースホルダが専用文言に変わっているか確認
3. DevToolsのNetworkで `/api/chat` のリクエストボディに
   `systemPromptId: "dify-rule-ver5"` が含まれることを確認

### 6.3.1 URL一覧
- 新規開始（Difyモード）: `http://localhost:3000/dify`
- 既存チャット（Difyモード）: `http://localhost:3000/dify/chat/<chatId>`
- 注意: `/dify/chat`（id無し）は未実装のため 404

### 6.3.2 DSL保存の確認方法（Neon）
NeonのSQL Editorで以下を実行して確認します。

```sql
select *
from "DifyWorkflowDsl"
order by "createdAt" desc
limit 20;
```

特定チャットの履歴を見る場合は `<CHAT_ID>` を置き換えます。

```sql
select *
from "DifyWorkflowDsl"
where "chatId" = '<CHAT_ID>'
order by "version" asc;
```

### 6.4 注意点
- `app/(group)` はURLに反映されないため、Difyは `app/dify` を使用
- サイドバーの履歴リンクは `/chat/<id>` のまま（通常チャットと履歴は共有）
  - Dify専用履歴や `/dify/chat/<id>` へのリンク分離が必要なら別対応
- `pnpm db:migrate` が通っていないとテーブルが作成されないため、DSL自動保存も動作しない

## 7. つまずきやすいポイント
- `.env.local` の値が不足していると起動やAI機能が失敗する
- `POSTGRES_URL` が無いとマイグレーションに失敗する
- pnpm のバージョン不一致で依存関係が崩れることがある

## 8. 次にやることの例
- 目的の画面とデータ構造を書き出す
- 必要なページ/API/DB変更を洗い出す
- 4章の順に実装する

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
- `AI_DIFY_MODEL`  
  任意。`/dify` の DSL 自動生成で使う初期モデル（`provider/model` 形式）。未設定時は `DEFAULT_CHAT_MODEL` を使用。ユーザーはモデルセレクターで他のモデルに切り替え可能。
- `POSTGRES_URL`  
  DB 接続文字列
- `REDIS_URL`  
  Redis 接続文字列
- `BLOB_READ_WRITE_TOKEN`  
  Vercel Blob 用トークン
- `DIFY_CONSOLE_API_BASE`  
  オプショナル。Dify Console APIのベースURL（例: `https://api.dify.ai/console/api`）。設定するとDSL自動インポート機能が有効になります。
- `DIFY_EMAIL`  
  オプショナル。Dify Console APIへのログイン用メールアドレス。
- `DIFY_PASSWORD`  
  オプショナル。Dify Console APIへのログイン用パスワード（シングルクォートで囲む）。
- `DIFY_PASSWORD_BASE64`  
  オプショナル。パスワードがbase64エンコードされている場合に`true`を設定。

注意: `.env.local` はコミットしないでください。また、Dify認証ファイル（`.dify_auth`、`.dify_csrf`）もGit管理から除外されています。

#### 2.3.1 LLMの呼び出し先切替（AI Gateway ↔ Direct）の実装箇所

このプロジェクトでは、LLMの呼び出し先（Vercel AI Gateway / 直接プロバイダ）を **環境変数で切り替え**できるようにしています。

**設定（どちらを使うか）**
- `AI_PROVIDER_MODE=gateway`（デフォルト）: Vercel AI Gateway 経由（`AI_GATEWAY_API_KEY` または Vercel の OIDC）
- `AI_PROVIDER_MODE=direct`: 自前のAPIキーで直接呼び出し（`OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `GOOGLE_GENERATIVE_AI_API_KEY`）
  - 注意: `direct` は現状 `openai/*` / `anthropic/*` / `google/*` のみ対応です（それ以外は `gateway` を使ってください）
  - Vercelにデプロイする場合は、`.env.local` ではなく Vercel の Environment Variables に同じ変数を設定します
- `AI_DIFY_MODEL`（任意）: `/dify` のDSL自動生成で使う初期モデル（例: `openai/gpt-4.1-mini`）。ユーザーはモデルセレクターで切り替え可能

**主な変更箇所（コード）**
- `lib/ai/providers.ts`  
  - `AI_PROVIDER_MODE` を読み取り、`getLanguageModel()` / `getTitleModel()` / `getArtifactModel()` の内部で `gateway` / `direct` を分岐
  - `direct` の場合、モデルID（例: `openai/gpt-4.1-mini`）の先頭（`openai` / `anthropic` / `google`）でルーティング
  - 必要なAPIキーが未設定の場合は `ChatSDKError("bad_request:provider_config")` を投げる
- `app/(chat)/api/chat/route.ts`  
  - チャットのLLM呼び出しは `getLanguageModel(...)` 経由（＝切替は `lib/ai/providers.ts` 側で完結）
  - ユーザーが選択した `selectedChatModel` をそのまま使用
- `app/dify/page.tsx`, `app/dify/chat/[id]/page.tsx`  
  - `AI_DIFY_MODEL` が設定されていれば、`/dify` の初期モデルとして使用（Cookie 未設定時）。ユーザーはモデルセレクターで他のモデルに切り替え可能
- `lib/errors.ts`  
  - 設定ミス時のエラーコード `bad_request:provider_config` を追加（ユーザーに分かりやすく返すため）

**主な変更箇所（依存関係/設定テンプレ）**
- `.env.example`  
  - `AI_PROVIDER_MODE` と `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `GOOGLE_GENERATIVE_AI_API_KEY`、および任意の `AI_*_MODEL` を追加
- `package.json`  
  - `direct` 用に `@ai-sdk/openai` / `@ai-sdk/anthropic` / `@ai-sdk/google` を追加

**動作確認の目安**
- `AI_PROVIDER_MODE=direct` で Google のキーが未設定のまま `google/*`（例: `google/gemini-2.5-flash-lite`）を選ぶと、Google API 側のエラーになります（`API key not valid` など）。
- `AI_PROVIDER_MODE=direct` では、Googleキーが無い場合に自動でAI Gatewayへフォールバックはしません。使うモデル（プロバイダ）とキー設定を一致させてください。

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
- 生成したDSLはローカルファイルシステム（`dsl/`ディレクトリ）にも保存
- Dify Console APIが設定されている場合、DSLを自動的にDifyにインポート・公開

### 6.2 実装ファイル
- ルート/ページ
  - `app/dify/layout.tsx` (SidebarProvider + DataStreamProvider)
  - `app/dify/page.tsx` (新規チャット)
  - `app/dify/chat/[id]/page.tsx` (既存チャット)
- プロンプト/API
  - `lib/ai/prompts.ts` (systemPromptIdと`rule_ver5.md`の合成)
  - `app/(chat)/api/chat/schema.ts` (`systemPromptId` 追加)
  - `app/(chat)/api/chat/route.ts` (Difyモード時のプロンプト切り替え/ツール無効化/DSL保存/自動インポート)
- DB
  - `lib/db/schema.ts` (`DifyWorkflowDsl` テーブル)
  - `lib/db/queries.ts` (`saveDifyWorkflowDsl`)
  - `lib/db/migrations/0009_dify_workflow_dsl.sql`（マイグレーション）
- Dify Console API クライアント
  - `lib/dify/client.ts` (DifyClientクラス: ログイン、DSLインポート、公開、URL取得)
  - `lib/dify/types.ts` (Dify APIの型定義)
- ファイルシステム
  - `dsl/` ディレクトリ（生成されたDSLファイルの保存先）
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

### 6.3.2 DSL保存の確認方法

#### データベース（Neon）
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

#### ローカルファイルシステム
プロジェクトルートの`dsl/`ディレクトリに保存されたDSLファイルを確認できます。

```bash
# DSLファイル一覧を表示
ls -la dsl/*.yml

# 最新のDSLファイルを確認
ls -lt dsl/*.yml | head -1
```

ファイル名形式: `{workflowName}_{chatId}_{timestamp}.yml`

### 6.4 DSLの保存と自動インポート

#### 6.4.1 DSL保存の仕組み
生成されたDSLは以下の2箇所に保存されます：

1. **データベース** (`DifyWorkflowDsl`テーブル)
   - チャットID、ユーザーID、メッセージID、バージョン、ワークフロー名、モード、DSL YAMLを保存
   - バージョン管理が可能（同じチャットIDで複数バージョンを保存）

2. **ローカルファイルシステム** (`dsl/`ディレクトリ)
   - ファイル名形式: `{workflowName}_{chatId}_{timestamp}.yml`
   - プロジェクトルートの`dsl/`ディレクトリに保存

**DSL検証機能:**
正しいDify DSL形式のみが保存されるように、以下の検証が行われます：

- **最小行数チェック**: 10行未満のテキストは除外（説明文などの短いテキストを除外）
- **必須フィールドチェック**: 
  - `app:`または`kind: app`で始まる
  - `workflow:`または`graph:`を含む

これにより、LLMが生成した説明文や途中のテキストが誤って保存されることを防ぎます。

#### 6.4.2 Dify Console APIによる自動インポート（オプショナル）
`.env.local`に以下の環境変数を設定すると、DSL生成後に自動的にDifyにインポート・公開されます：

```bash
# Dify Console API設定（オプショナル）
DIFY_CONSOLE_API_BASE=https://api.dify.ai/console/api
DIFY_EMAIL=your-email@example.com
DIFY_PASSWORD=your-password
# パスワードのbase64エンコード（デフォルト: true）
# 平文パスワードだと "Invalid encrypted data" エラーになるため、true を推奨
DIFY_PASSWORD_BASE64=true
# または
PASSWORD_BASE64=true
```

**パスワード形式の設定:**
- **デフォルト動作**: `DIFY_PASSWORD_BASE64`が設定されていない場合、自動的に`true`（base64エンコード有効）になります
- **明示的な設定**: `DIFY_PASSWORD_BASE64=false`または`PASSWORD_BASE64=false`を設定した場合のみ、base64エンコードが無効化されます
- **推奨設定**: ほとんどの環境で`true`が必要です（平文パスワードだと認証エラーが発生します）

**動作フロー:**
1. DSLが生成されると、DBとローカルファイルに保存
2. Dify Console APIの設定がある場合、自動的にログイン（認証トークンは`.dify_auth`と`.dify_csrf`にキャッシュ）
3. DSLファイルをDifyにインポート
4. ワークフローを公開
5. 公開URLを取得（ワークフローの種類に応じて`/workflow/`または`/chat/`パスを自動判定）
6. **成功時**: 公開URLがチャット画面に表示されます（緑色のボックス、クリック可能なリンク）
7. **失敗時**: エラーメッセージはサーバーのコンソールログにのみ出力されます（チャットには表示されません）

**公開URLの表示:**
- 自動インポートが成功した場合のみ、チャット画面に公開URLが表示されます
- エラーが発生した場合、チャット処理は継続されますが、エラーメッセージはチャットには表示されません（サーバーログを確認してください）

**認証ファイル:**
- `.dify_auth` - アクセストークン（Git管理から除外）
- `.dify_csrf` - CSRFトークン（Git管理から除外）

#### 6.4.3 ワークフローの種類に応じたURLパス判定
`DifyClient.getPublishUrl()`は、ワークフローの種類（`mode`）に応じて適切なURLパスを返します：

- `mode: "workflow"` → `http://localhost/workflow/{access_token}`
- `mode: "chat"`, `"advanced-chat"`, `"agent-chat"` → `http://localhost/chat/{access_token}`

### 6.5 注意点
- `app/(group)` はURLに反映されないため、Difyは `app/dify` を使用
- サイドバーの履歴リンクは `/chat/<id>` のまま（通常チャットと履歴は共有）
  - Dify専用履歴や `/dify/chat/<id>` へのリンク分離が必要なら別対応
- `pnpm db:migrate` が通っていないとテーブルが作成されないため、DSL自動保存も動作しない
- Dify Console APIの設定がない場合、DSLはローカルに保存されるが自動インポートは実行されない（既存の動作を維持）
- `.dify_auth`と`.dify_csrf`は認証情報を含むため、`.gitignore`に追加されている
- DSL検証により、正しいDify DSL形式のみが保存されます（説明文や途中のテキストは除外）
- DSL保存と自動インポートは`streamText`の`onFinish`で1回だけ実行されます（重複保存を防止）
- パスワードのbase64エンコードはデフォルトで有効です（`DIFY_PASSWORD_BASE64=false`を明示的に設定しない限り）
- 自動インポートのエラーはチャットには表示されません（サーバーのコンソールログを確認してください）
- 環境変数を変更した場合は、開発サーバーを再起動してください

## 7. つまずきやすいポイント
- `.env.local` の値が不足していると起動やAI機能が失敗する
- `POSTGRES_URL` が無いとマイグレーションに失敗する
- pnpm のバージョン不一致で依存関係が崩れることがある

## 8. 次にやることの例
- 目的の画面とデータ構造を書き出す
- 必要なページ/API/DB変更を洗い出す
- 4章の順に実装する

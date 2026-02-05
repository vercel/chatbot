## Dify CLI

本リポジトリは、Dify のアプリケーションおよびワークフローを
Bash ベースの CLI から操作するためのツールです。

ログイン、アプリ一覧取得、DSL の export / import、公開、ログ取得、
ツール取得・登録・更新、Workflow ツールと元 Workflow の
親子関係解析までを、すべてコマンドラインから実行できます。

本ツールは bash + curl + jq のみで動作し、
ブラウザ操作を必要としません。

### 前提条件

- macOS または Linux
- bash
- curl
- jq

jq が入っていない場合は、以下でインストールしてください。

**macOS:**
```bash
brew install jq
```

**Ubuntu / Debian:**
```bash
sudo apt install -y jq
```

### クイックスタート（最短で動かす）

```bash
git clone https://github.com/KatoShion/dify_cli_sample.git
cd dify_cli_sample
cp .env.example .env
# .env を編集
dify login
dify apps
```

### セットアップ

#### 1. `.env` の作成（必須）

まず `.env.example` をコピーします。

```bash
cp .env.example .env
```

`.env` に以下を設定してください。

```bash
CONSOLE_API_BASE=https://your-dify-domain/console/api
EMAIL=your-email@example.com
PASSWORD='your-password'
```

**注意事項:**
- `.env` は **必ず Git 管理対象から除外してください**
- `PASSWORD` は必ずクォート付きで記述してください
- 共用端末や CI 環境ではトークン認証の利用を推奨します

#### 2. PATH へのインストール（推奨）

```bash
mkdir -p "$HOME/bin"
ln -s "$(pwd)/dify-cli.sh" "$HOME/bin/dify"
```

**bash の場合:**
```bash
echo 'export PATH="$HOME/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

**zsh の場合:**
```bash
echo 'export PATH="$HOME/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

以後、どのディレクトリからでも以下の形式で実行できます。

```bash
dify <サブコマンド>
```

#### 3. ログイン

```bash
dify login
```

- 認証トークンはローカルに `.dify_token` として保存されます
- トークンが失効した場合は、再度 `dify login` を実行してください

### よく使うコマンド

#### 認証・メタ情報

```bash
dify me
dify apps [page] [limit]
dify app <APP_ID>
```

#### DSL の出力 / 投入

**export（既定は include_secret=false 推奨）**

```bash
dify export <APP_ID> [include_secret=false]
```

**import（YAML から新規アプリ作成）**

```bash
dify import ./dsl/sample.yml
```

#### Workflow の一括エクスポート

```bash
dify export-all-workflows [include_secret=false]
```

- 保存先: `./dsl/apps/<slug>-<APP_ID>.yml`
- 同一アプリは同じパスに上書き保存されます

#### 公開

```bash
dify publish <WORKFLOW_APP_ID> [marked_name] [marked_comment]
dify publish-info <WORKFLOW_APP_ID>
```

#### ログ取得

**Workflow 実行ログ:**

```bash
dify logs-workflow <APP_ID> '2025-06-04T11:00:00-04:00' '2025-06-12T10:59:59-04:00' 1 10
```

**チャットログ（JST の日時文字列も指定可）:**

```bash
dify logs-chat <APP_ID> '2025-06-19 00:00' '2025-06-26 23:59' 1 10 -created_at
```

#### ツール管理（Workflow ツールプロバイダ）

```bash
dify tool-get <WORKFLOW_APP_ID>
dify tool-create ./payloads/tool-create.json
dify tool-update ./payloads/tool-update.json
```

### Workflow 親子関係デバッグ（Tool → 元 Workflow）

Workflow をツール化したノード
（`type=tool` かつ `provider_type="workflow"`）から、
元の Workflow アプリの DSL を収集します。

**親アプリで使われている Workflow ツールを列挙:**

```bash
dify tool-refs-in-app <PARENT_APP_ID>
```

**ワークスペース全体から Workflow ツールを含むアプリを探索:**

```bash
dify find-apps-with-workflow-tools
```

**親アプリ配下のツールの中身（元 Workflow DSL）を一括保存:**

```bash
dify export-tools-of-app <PARENT_APP_ID> [include_secret=false]
```

- 出力先: `./dsl/tools/<ツール名slug>.yml`
- （slug 化できない場合は tool_id を使用）

**仕組み:**
- 親アプリのドラフトワークフロー `GET /apps/{id}/workflows/draft` から `provider_type="workflow"` ノードを抽出。
- 全 `mode=workflow` アプリに対し `GET /workspaces/current/tool-provider/workflow/get?workflow_app_id=...` を照会し、`workflow_tool_id → workflow_app_id` の辞書を構築。
- 辞書を使って `/apps/{workflow_app_id}/export?include_secret=false` を叩き、DSL を保存。

### include_secret について

- 既定値は `include_secret=false`（強く推奨）
- `true` を指定すると API が許す範囲で secret を含めます
- 環境や権限により、マスクまたは未返却となる場合があります

**例:**

```bash
dify export <APP_ID> true
dify export-tools-of-app <PARENT_APP_ID> true
```

### ベストプラクティス / トラブルシューティング

- 認証ヘッダは `Authorization: Bearer <token>` を使用
- curl は `-fS --fail-with-body` を推奨
- URL エンコードは `jq -rn '$v|@uri'` を使用
- export レスポンスは `{data}` / `{dsl}` の両形式に対応
- タイムスタンプはオフセット付き指定を推奨
- 認証エラー時は `dify login` を再実行

### 例: 一連の操作
```bash
# 1) ログイン
dify login

# 2) アプリ一覧
dify apps

# 3) DSLを出力（保存先: ./dsl/apps/<slug>.yml）
dify export <APP_ID> false

# 4) DSLをインポート（新規作成）
dify import ./dsl/sample.yml

# 5) 公開
dify publish <WORKFLOW_APP_ID> "nightly" "auto publish"
dify publish-info <WORKFLOW_APP_ID>

# 6) Workflowログ（期間絞り）
dify logs-workflow <APP_ID> '2025-06-04T11:00:00-04:00' '2025-06-12T10:59:59-04:00' 1 10

# 7) 親子関係（ツール→元Workflow）を解決してツールの中身を保存
dify export-tools-of-app <PARENT_APP_ID> false
```

### セキュリティ上の注意

- `.env` や `.dify_*` ファイルは **絶対に Git 管理しない**
- `include_secret=true` の利用は非推奨
- CI/CD では環境変数注入方式を推奨

### Acknowledgement

本リポジトリは既存の Dify CLI 実装をベースに、
自動化およびデバッグ用途向けに改変・拡張しています。

---

質問や追加機能の要望（Python 版 CLI、GitHub Actions バッチ等）があれば、Issue/PR 歓迎です。



# 変更履歴 (Change Log)

このファイルは、プロジェクトの変更履歴を記録するためのものです。重要な変更や機能追加、バグ修正などを随時記録してください。

## 記録形式

各エントリは以下の形式で記録してください：

```markdown
## [バージョン] - YYYY-MM-DD

### Added
- 新機能の追加

### Changed
- 既存機能の変更

### Fixed
- バグ修正

### Removed
- 削除された機能

### Deprecated
- 非推奨になった機能

### Security
- セキュリティ関連の修正
```

---

## [3.1.2] - 2025-02-11

### Fixed
- チャット削除機能の外部キー制約違反エラーを修正
  - `lib/db/queries.ts`の`deleteChatById`関数を修正
    - `DifyWorkflowDsl`テーブルからの削除処理を追加
    - 外部キー制約の順序に従って削除順序を修正（DifyWorkflowDsl → Vote → Message → Stream → Chat）
  - `lib/db/queries.ts`の`deleteAllChatsByUserId`関数を修正
    - 同様に`DifyWorkflowDsl`テーブルからの削除処理を追加
    - 削除順序を修正
  - エラーハンドリングを改善し、実際のエラーメッセージをログに出力するように変更
  - `DifyWorkflowDsl`テーブルが存在しない場合でもエラーにしないようにtry-catchで囲む

### Changed
- マージコンフリクトの解決
  - `lib/ai/entitlements.ts`のマージコンフリクトを解決（sync-local側を採用）
    - `guest`ユーザーの`maxMessagesPerDay`を`50`に設定

### 変更の詳細
- **問題**: チャット削除時に`DifyWorkflowDsl`テーブルが`Message_v2`テーブルを参照しているため、外部キー制約違反が発生
- **解決方法**: `Message_v2`を削除する前に`DifyWorkflowDsl`から`messageId`を参照しているレコードを削除するように順序を変更
- **エラーハンドリング**: データベースエラーの詳細をログに出力し、デバッグを容易にした

---

## [3.1.1] - 2026-02-09

### Changed
- `lib/ai/prompts.ts`の`difyWorkflowPrompt`関数を改善
  - `rule_ver5.md`をメインのルールブックとして明確化（ノード生成のガイドライン）
  - 2つのDSL参照例（`intelligent_research_assistant_20260108_164230.yml`、`PDFナレッジベース質問応答システム_20260116_113604.yml`）をノード間接続とバリデーションパターンの参照として明確化
  - プロンプトに「Generation Strategy」セクションを追加し、ルールブックとDSL例の使い分けを明確化
  - 各DSL例の特徴と使用目的を明記（Question Classifier、Iteration、Agent、Knowledge Retrievalなど）

### 変更の詳細
- **ノード生成**: `rule_ver5.md`をメインリファレンスとして使用
- **ノード接続とバリデーション**: DSL参照例をパターンとして使用
  - エッジ構造（sourceHandle/targetHandle、sourceType/targetType）
  - Iterationノードパターン（iteration-start、parentId、isInIteration）
  - 変数参照パターン（variable_selector、value_selector）
  - ノードプロパティ（position、height、width）
  - Context設定（LLMノードのcontextセクション）

---

## [3.1.0] - 2026-02-09

### Added
- DifyワークフローDSLの参照例を追加
  - `intelligent_research_assistant_20260108_164230.yml` - インテリジェント研究アシスタント（ワークフローモード、Iteration/Agentノード使用例）
  - `PDFナレッジベース質問応答システム_20260116_113604.yml` - PDFナレッジベース質問応答システム（チャットフローモード、Knowledge Retrieval使用例）
- `lib/ai/prompts.ts`を修正し、DSL参照例をプロンプトに含めるように変更
  - `difyDslExamples`関数を追加してDSLファイルを読み込み
  - `difyWorkflowPrompt`関数で参照例をプロンプトに含めるように変更
- `cloud.md`ファイルを作成し、変更履歴の記録を開始

### プロジェクト情報
- **プロジェクト名**: ai-chatbot
- **現在のバージョン**: 3.1.0
- **フレームワーク**: Next.js 16.0.10 (App Router)
- **AI SDK**: 6.0.37
- **主要機能**:
  - Next.js App Router + AI SDK chatbot template
  - Difyワークフロー自動生成機能 (`/dify` エンドポイント)
  - チャット履歴の永続化 (PostgreSQL)
  - ファイルストレージ (Vercel Blob)
  - 認証機能 (Auth.js)

### ドキュメント
- `docs/implementation-guide.md` - 実装手順ガイド
- `docs/project-structure-diagram.md` - プロジェクト構造図
- `docs/agent-progress.yaml` - プロジェクト進捗状況
- `rule_ver5.md` - Difyワークフロー生成ルールブック
- `intelligent_research_assistant_20260108_164230.yml` - DifyワークフローDSL参照例（ワークフローモード）
- `PDFナレッジベース質問応答システム_20260116_113604.yml` - DifyワークフローDSL参照例（チャットフローモード）

---

## 記録のガイドライン

1. **日付形式**: YYYY-MM-DD形式で記録してください
2. **バージョン**: `package.json`のバージョンに合わせてください
3. **カテゴリ**: 変更内容に応じて適切なカテゴリを選択してください
4. **詳細**: 変更内容を具体的に記述してください
5. **順序**: 新しい変更を上に追加してください（時系列の逆順）

## カテゴリの説明

- **Added**: 新しく追加された機能
- **Changed**: 既存機能の変更や改善
- **Fixed**: バグ修正
- **Removed**: 削除された機能やコード
- **Deprecated**: 将来的に削除予定の機能
- **Security**: セキュリティ関連の修正や脆弱性の対応


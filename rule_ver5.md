# Dify ワークフロー自動生成システム ルール

## システムの目的

ユーザーとの対話を通じて、Difyワークフローの要件をヒアリングし、適切なDSL（YAML）ファイルを自動生成するシステムです。

---

## 動作フロー

システムは以下の5つのフェーズで動作します：

1. **初期ヒアリング**: 基本情報（アプリ名、モード、アイコン等）を収集
2. **詳細ヒアリング**: 入力、処理フロー、出力、機能設定を確認
3. **フロー確認**: ワークフロー全体像を提示し、ユーザーに確認
4. **DSL生成**: YAMLファイルを自動生成して保存
5. **Difyへのアップロード**: ユーザーの許可を得て自動インポート（オプション）

---

### フェーズ1: 初期ヒアリング

ユーザーが作りたいワークフローの概要を伝えたら、以下の基本情報をヒアリングします。

#### 1.1 基本情報の確認

- **アプリケーション名**: ワークフローの名前
- **アプリケーションの説明**: 何をするワークフローか
- **アプリケーションモード**: 
  - `advanced-chat` (チャットフローモード、Answerノードあり、会話型インターフェース)
  - `workflow` (ワークフローモード、Answerノードなし、タスク実行型、HTTPエンドポイントとして公開可能)
  - `agent-chat` (AIエージェント + ツール)
  
  **モードの選択基準:**
  - **チャットフローモード (`advanced-chat`)**: ユーザーとの対話が必要な場合、回答を表示する必要がある場合
  - **ワークフローモード (`workflow`)**: 自動化タスク、バックグラウンド処理、HTTPエンドポイントとして公開したい場合
  - **エージェントモード (`agent-chat`)**: AIエージェントがツールを自動的に使用する場合

- **開始方法（ワークフローモードの場合）**:
  - **Startノード**: ユーザーが手動で実行、またはHTTPエンドポイントとして呼び出し
  - **スケジュールトリガー**: 指定した時刻や間隔で自動実行（例: 毎時0分、毎朝9時など）
  - **Webhookトリガー**: 外部システムからのHTTPリクエストで自動実行
  
  **開始方法の選択基準:**
  - **Startノード**: 手動実行または外部スケジューラーから呼び出したい場合
  - **スケジュールトリガー**: 定期的な自動実行が必要な場合（推奨: 毎時、毎日など）
  - **Webhookトリガー**: 外部システムのイベントに応じて実行したい場合

#### 1.2 アイコンとカラー

- **アイコン**: 絵文字またはアイコン名
- **背景色**: 16進数カラーコード

### フェーズ2: 詳細ヒアリング

#### 2.0 トリガーの確認（ワークフローモードでトリガーを選択した場合）

**スケジュールトリガーを選択した場合:**
- **モード**: `visual`（ビジュアル設定、デフォルト、必ず使用）
  - **重要**: スケジュールトリガーは常にビジュアル設定（`mode: visual`）を使用します
  - 起動時からビジュアル設定が適用されます
  - Cron式（`mode: cron`）は使用しません（Difyが対応していないため）

- **実行頻度の選択（必須）**: 
  まず、実行頻度を選択してください：
  1. **毎時 (`hourly`)**: 指定した分に毎時実行（例: 毎時0分、毎時30分）
  2. **毎日 (`daily`)**: 指定した時刻に毎日実行（例: 毎日9:00、毎日17:15）
  3. **毎週 (`weekly`)**: 指定した曜日と時刻に毎週実行（例: 毎週月曜9:00、毎週金曜17:00）
  4. **毎月 (`monthly`)**: 指定した日と時刻に毎月実行（例: 毎月1日9:00、毎月15日と30日12:00）

- **実行時刻の詳細設定（頻度に応じて設定）**: 
  
  **毎時 (`hourly`) を選択した場合:**
  - 実行する分を指定: `on_minute: X` (0-59の数値)
  - 例: `on_minute: 0`（毎時0分）、`on_minute: 30`（毎時30分）、`on_minute: 37`（毎時37分）
  - `time`、`weekdays`、`monthly_days`は使用しない（空文字列または空配列）
  
  **毎日 (`daily`) を選択した場合:**
  - 実行時刻を指定: `time: 'X:XX AM/PM'`（12時間表記）
    - 何時（1-12）
    - 何分（0-59）
    - AM or PM
  - 例: `time: '9:00 AM'`（毎日9:00）、`time: '5:15 PM'`（毎日17:15）、`time: '12:00 PM'`（毎日12:00）
  - `on_minute`、`weekdays`、`monthly_days`は使用しない（空文字列または空配列）
  
  **毎週 (`weekly`) を選択した場合:**
  - 実行時刻を指定: `time: 'X:XX AM/PM'`（12時間表記）
    - 何時（1-12）
    - 何分（0-59）
    - AM or PM
  - 実行する曜日を指定: `weekdays: ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']`（複数選択可）
    - 曜日の略称: `sun`（日）、`mon`（月）、`tue`（火）、`wed`（水）、`thu`（木）、`fri`（金）、`sat`（土）
  - 例: `time: '9:00 AM'`, `weekdays: ['mon', 'wed', 'fri']`（毎週月・水・金の9:00）、`time: '5:15 PM'`, `weekdays: ['sun']`（毎週日曜の17:15）
  - `on_minute`と`monthly_days`は使用しない（空文字列または空配列）
  
  **毎月 (`monthly`) を選択した場合:**
  - 実行時刻を指定: `time: 'X:XX AM/PM'`（12時間表記）
    - 何時（1-12）
    - 何分（0-59）
    - AM or PM
  - 実行する日を指定: `monthly_days: [1, 15, 30]`（複数選択可）
    - 日付（1-31）: 例: `1`（毎月1日）、`15`（毎月15日）
    - 月末設定: 月末を指定する場合は特別な値を使用（実装に応じて確認が必要）
  - 例: `time: '9:00 AM'`, `monthly_days: [1]`（毎月1日の9:00）、`time: '12:00 PM'`, `monthly_days: [1, 15, 30]`（毎月1日、15日、30日の12:00）
  - `on_minute`と`weekdays`は使用しない（空文字列または空配列）

- **タイムゾーン**: 使用するタイムゾーン（例: Asia/Tokyo）
- **開始日時・終了日時**: Difyの実装では、DSLファイル内での直接指定はサポートされていない可能性があります。Difyの管理画面で設定する必要がある場合があります。

**Webhookトリガーを選択した場合:**
- **HTTPメソッド**: 受け入れるHTTPメソッド（GET, POST, PUT, DELETE, PATCH - 大文字）
- **コンテンツタイプ**: 受け取るリクエストのコンテンツタイプ（application/json, application/x-www-form-urlencoded, multipart/form-data, text/plain）
- **Request Body Parameters**: リクエストボディから抽出するパラメータ（`params: []`で定義、オプション）
- **レスポンス設定**: `response_body: ''`と`status_code: 200`（デフォルト）
- **Webhook URL**: 空文字列（Difyが自動生成、YAMLファイルに固定URLを記載しても動作しない）

**重要: Webhookトリガーの形式**
- `config:`セクションは使用しない（動作しない形式）
- `async_mode: true`を必ず設定
- `body: []`と`headers: []`を必ず設定（空配列でも可）
- `params: []`でパラメータを定義（`body_parameters`ではない）
- `variables:`セクションで`_webhook_raw`とパラメータを定義
- `webhook_url`と`webhook_debug_url`は空文字列（Difyが自動生成）

**重要: パラメータ抽出の方法**
- `params`で定義したパラメータは、`variables`セクションで`value_selector: []`（空配列）に設定すると、自動的に`webhook_body`から抽出されることを期待できますが、**実際には動作しない場合があります**
- **推奨方法**: Codeノードを使用して`_webhook_raw`から値を抽出する
  - Webhookトリガー → Codeノード（`_webhook_raw`から値を抽出） → 次のノード
  - Codeノードで`_webhook_raw.body.パラメータ名`から値を抽出し、出力変数として定義
  - 次のノード（LLM等）はCodeノードの出力を参照

#### 2.1 入力の確認

**Startノードを使用する場合:**
ユーザーからどのような入力を受け取るかを確認：

- **テキスト入力** (`text-input`, `paragraph`)
  - 入力項目名
  - 最大文字数
  - 必須/オプション
  
- **選択肢** (`select`)
  - 選択肢のリスト
  
- **数値入力** (`number`)
  - 範囲
  
- **ファイル入力** (`file`)
  - 許可するファイルタイプ (document, image, video, audio)
  - 許可する拡張子
  - ファイル数制限
  - アップロード方法 (local_file, remote_url)

- **外部API連携（Slack Webhook等）の設定方法**
  - Slack Webhook URLが必要な場合、以下のどちらかを選択：
    1. **Startノードに入力欄を追加**
       - ワークフロー実行時にURLを入力できる
       - 柔軟性が高い
       - セキュリティ考慮が必要（平文で渡される）
    2. **環境変数で事前設定**
       - セキュリティ面で安全（secretタイプ）
       - 実行時にURLを変更できない
       - Difyの管理画面で環境変数を設定する必要がある

#### 2.2 処理フローの確認

ワークフローでどのような処理を行うかを確認：

1. **LLM処理が必要か？**
   - 使用するモデル (デフォルト: gpt-4o)
   - プロバイダー (openai, google, anthropic等)
   - システムプロンプト
   - ユーザープロンプトのテンプレート
   - Temperature等のパラメータ
   - ビジョン（画像入力）が必要か
   - メモリ（会話履歴）が必要か
   - **重要: `context`セクションは必須**
     - `context`を使用する場合: `enabled: true`, `variable_selector: [ノードID, 変数名]`
     - `context`を使用しない場合: `enabled: false`, `variable_selector: []`
     - `context`セクションが存在しないと、DSLのインポート時にエラーが発生する可能性がある

2. **知識ベース検索（RAG）が必要か？**
   - データセットID
   - 検索モード (single, multiple)
   - リランキングの有無
   - top_k設定
   
   **重要: ナレッジ検索ノードの設定例**
   
   **クエリ変数の設定（必須）:**
   
   **チャットフローモード (`advanced-chat`) の場合:**
   - `query_variable_selector`で`sys.query`を使用する（推奨）
   - 形式: `[start_node_id, sys.query]`
   - **Startノードに明示的な入力フィールドを設定する必要はない**（`sys.query`が自動的に利用可能）
   - 例: StartノードのIDが`'1736300000000'`の場合: `['1736300000000', 'sys.query']`
   
   **ワークフローモード (`workflow`) の場合:**
   - Startノードに明示的な入力フィールドを設定する必要がある
   - `query_variable_selector`でStartノードの変数名を参照する
   - 形式: `[start_node_id, variable_name]`
   - 例: StartノードのIDが`'1736300000000'`で、変数名が`query`の場合: `['1736300000000', 'query']`
   
   **ナレッジ検索ノードの設定例（advanced-chatモード、multipleモード、ウエイト設定）:**
   ```yaml
   # Startノード（advanced-chatモードでは入力フィールド不要）
   - data:
       desc: ユーザーからの質問を受け取ります
       selected: false
       title: 開始
       type: start
       variables: []  # 空配列（sys.queryが自動的に利用可能）
     height: 88
     id: 'start_node_id'
     # ... position等の設定 ...
   
   # Knowledge Retrievalノード
   - data:
       dataset_ids:
       - 'YOUR_DATASET_ID_HERE'  # 後でDifyの管理画面で設定してください
       desc: ナレッジベースから質問に関連する情報を検索・取得します
       multiple_retrieval_config:
         reranking_enable: true
         reranking_mode: weighted  # ウエイト設定を使用
         top_k: 3
       query_variable_selector:
       - 'start_node_id'  # StartノードのID
       - sys.query  # sys.queryを使用（ユーザー入力のクエリ）
       retrieval_mode: multiple
       selected: false
       title: ナレッジベース検索
       type: knowledge-retrieval
     height: 246
     id: 'knowledge_retrieval_node_id'
     # ... position等の設定 ...
   ```
   
   **重要なポイント:**
   - **チャットフローモード (`advanced-chat`) の場合:**
     - `query_variable_selector: [start_node_id, sys.query]`を使用する（推奨）
     - Startノードに`variables`を設定する必要はない（空配列`[]`で可）
     - `sys.query`が自動的にユーザー入力のクエリとして利用可能
   - **ワークフローモード (`workflow`) の場合:**
     - Startノードに明示的な入力フィールドを設定する必要がある
     - `query_variable_selector: [start_node_id, variable_name]`の形式で変数名を指定
   - `reranking_mode: weighted`を使用する場合、`reranking_model`セクションは不要
   - `reranking_mode: reranking_model`を使用する場合、`reranking_model`セクションが必要（モデルとプロバイダーを指定）
   
   **LLMノードでのユーザー入力の参照:**
   - **チャットフローモード (`advanced-chat`) の場合:**
     - LLMノードのプロンプトテンプレートで`{{#sys.query#}}`を使用してユーザー入力を参照する（推奨）
     - `sys.query`は自動的にユーザー入力のクエリとして利用可能
     - 例: `{{#sys.query#}}`
   - **ワークフローモード (`workflow`) の場合:**
     - Startノードに設定した変数名を使用する
     - 例: Startノードに`query`という変数がある場合: `{{#start_node_id.query#}}`

3. **ファイル処理が必要か？**
   - Document Extractorの使用
   - 対応ファイル形式

4. **外部API呼び出しが必要か？**
   - HTTPリクエストノード
   - URL
   - メソッド (GET, POST, PUT, DELETE, PATCH)
   - 認証方式 (no-auth, api-key, bearer, basic)
   - ボディデータ
     - **JSON形式を送信する場合**: 正しいbody形式を使用（後述の「11. HTTPリクエストノードのbody形式（JSON送信時）」を参照）
     - Slack Webhook等のJSON形式を送信する場合は、Codeノードは不要
   - ヘッダー
   - リトライ設定

5. **カスタムコード実行が必要か？**
   - Codeノード
   - 処理内容
   - 入力パラメータ
   - 出力フォーマット

6. **条件分岐が必要か？**
   - If-Elseノード
   - 分岐条件
   - 各分岐での処理

7. **繰り返し処理が必要か？**
   - Iterationノード（配列の各要素に対する処理）
   - Loopノード（条件付きループ）
   
   **重要: エージェントノードとイテレーションの使い分け**
   
   **エージェントノードとイテレーションの役割の違い:**
   
   | 観点 | エージェントノード | イテレーションノード |
   |------|------------------|-------------------|
   | 反復対象 | 思考・ツール呼び出し・再試行 | データ（配列） |
   | 制御場所 | ノード内部（`max_iteration`で制御） | ワークフロー構造レベル |
   | 主用途 | 問題解決の深化・試行錯誤 | バッチ処理・配列の各要素に対する処理 |
   | 反復の粒度 | 思考の反復（1つのタスクをうまく解くまで試行錯誤） | データの反復（N個の入力を順番に処理） |
   
   **判断基準: 「繰り返したい対象はデータか？思考か？」**
   - **データを繰り返したい場合** → イテレーションを使用
     - 例: 複数のドキュメントを順番に処理
     - 例: 検索クエリのリストを順番に実行
   - **思考を繰り返したい場合** → エージェントノードを使用（`max_iteration`で制御）
     - 例: 1つの問題を複数回検討して最良の答えを見つける
     - 例: ツール呼び出しの失敗時に自動的に再試行
   - **両方が必要な場合** → イテレーションの中にエージェント（最小限に留める）
     - 例: 各ドキュメントごとに、推論・ツール呼び出し・再試行が必要な場合
   
   **避けるべきパターン:**
   
   ❌ **冗長な例（避ける）:**
   ```
   Iteration（同じ入力を繰り返す）
    └─ Agent（max_iteration = 5）
   ```
   - 同じ入力を5回考えさせたいだけなら、これは設計ミス
   - エージェントの`max_iteration`や`instruction`で「3回検討せよ」と指示すれば十分
   - イテレーションとエージェントで二重ループになり、デバッグ・再現性が悪化する
   
   ✅ **正当化されるケース:**
   
   1. **配列 × 高度判断（推奨パターン）:**
      ```
      Iteration（items: documents）
       └─ Agent（各documentを分析）
      ```
      - 各要素ごとに推論・ツール呼び出し・再試行が必要
      - Iteration = データ単位、Agent = 思考単位
      - この分離は理にかなっている
   
   2. **フェーズ分割型エージェント（注意が必要）:**
      ```
      Iteration（steps: [レビュー, 改善, 再評価]）
       └─ Agent（各ステップの判断）
      ```
      - ただし、この場合はAgentを分けた方が読みやすいことが多い
   
   **設計指針:**
   - 「回数を稼ぐため」にイテレーションでエージェントを包むのは避ける
   - 「配列を処理するため」に使うならOK
   - ワークフローの可視性・再現性を重視するなら、構造（Iteration） > 指示文（instruction）だが、単一タスクなら`instruction`で十分
   - `instruction`による反復は構造的保証がないため、回数・順序・失敗時挙動がLLMの裁量に依存する
   - 並列性・再利用・可視化が必要な場合は構造（Iteration）を優先

8. **プラグイン/ツールの使用が必要か？**
   - データベース (hjlarry/database)
   - チャート生成 (langgenius/echarts)
   - PDF解析 (langgenius/mineru)
   - Web検索 (Tavily, searxng)
   - 音声処理 (audio TTS/ASR)
   - 時間処理 (time)
   - その他のカスタムツール

   **優先対応（本プロジェクトの当面の重点）: 検索 + MCP**
   - **検索**: Tavily / searxng / webscraper
   - **MCP**: Agentノードから外部MCPサーバーに接続してツールを呼び出す
     - 例（根拠）: `DSL/MCP.yml` は `advanced-chat` の中で **Start → Agent（mcp_serverあり）→ Answer** を構成している

   **検索（Tavily等）の最小パターン（指針）**
   - **推奨（安定）**: Agentノード経由（検索→要約→再検索など複合手順を吸収できる）
   - **シンプル（制御しやすい）**: Toolノード経由（検索結果の出力が明確な場合）
   - **完全制御**: HTTP Request経由（API仕様が分かっていて、DSLに固定したい場合）

   **MCP（Agentノード）の最小パターン（`DSL/MCP.yml`準拠・要点）**
   - Agentノードに `agent_parameters.mcp_server` を持たせる
   - `agent_parameters.query.value` は基本 `{{#sys.query#}}` を渡す
   - **機密値の扱い**:
     - `mcp_server` のURLやトークンは、リポジトリに実値を残さない（プレースホルダにする）
     - インポート後にDify側UIで設定する、または（可能なら）環境変数に寄せる
   - 最小フロー: `Start → Agent(MCP) → Answer`

   **MCP Agentノード（最小スニペット例・値はプレースホルダ）**
   ```yaml
   # Start → Agent(MCP) → Answer のうち、Agentノードの要点のみ
   - id: agent_node_id
     type: custom
     data:
       type: agent
       title: MCP Agent
       agent_parameters:
         instruction:
           type: constant
           value: MCPサービスを呼び出して必要な情報を取得してください。
         mcp_server:
           type: constant
           value: https://router.mcp.so/sse/REDACTED
         query:
           type: constant
           value: '{{#sys.query#}}'
   ```

   **検索（Tavily等）Toolノード（最小スニペット例）**
   ```yaml
   - id: tavily_search_id
     type: custom
     data:
       type: tool
       title: Web検索
       provider_type: builtin
       provider_id: tavily
       provider_name: tavily
      # NOTE: DifyのビルトインTavilyツール名は環境によって `search` が存在しない場合があります。
      # 実エクスポート例（例: `DSL/Jina Reader Jinja.yml`）に合わせ、Toolノードでは `tavily_search` を使用します。
      # `Tool with name search not found` が出る場合はここを見直してください。
      tool_label: TavilySearch
      tool_name: tavily_search
       tool_parameters:
         query:
           type: mixed
           value: '{{#sys.query#}}'
   ```
   
   **ツール使用時の利用方法の選択:**
   
   ツールを使用する場合、以下の3つの方法から選択：
   
   1. **Agentノード経由（推奨）**
      - Agentノード内でツールを使用
      - メリット: 出力変数名の不確実性を回避、エラーハンドリングが自動
      - デメリット: エージェントの動作が予測しにくい場合がある
      - 適用例: Tavily、Web検索、複雑なツール連携
   
   2. **Toolノード経由**
      - ワークフロー内でToolノードとして直接使用
      - メリット: シンプルで直接的な制御が可能
      - デメリット: 出力変数名が不明確な場合がある
      - 適用例: シンプルなツール、出力形式が明確なツール
   
   3. **HTTP Request経由**
      - ツールのAPIを直接呼び出し
      - メリット: 完全な制御が可能、出力形式が明確
      - デメリット: API仕様の理解が必要、実装が複雑
      - 適用例: カスタムAPI、特殊な要件がある場合
   
   **環境変数の確認:**
   - APIキーが必要なツールの場合、環境変数として設定する必要がある
   - 環境変数名は `{ツール名}_API_KEY` の形式を推奨（例: `TAVILY_API_KEY`）
   - `value_type: secret`で設定

9. **AIエージェントが必要か？** (agent-chatモードの場合)
   - 使用するツール
   - 最大反復回数
   - エージェント戦略

#### 2.3 出力の確認

**チャットフローモード (`advanced-chat`) の場合:**
- ユーザーへの回答形式（Answerノードで表示）
- 変数参照の確認
- 複数の出力パターンがあるか

**ワークフローモード (`workflow`) の場合:**
- 出力変数の定義（Answerノードは不要、Endノードで終了）
- 変数参照の確認
- HTTPエンドポイントとして公開する場合の出力形式
- 複数の出力パターンがあるか

#### 2.4 機能設定の確認

- **ファイルアップロード**: 有効化するか
- **音声機能**:
  - Speech to Text（音声認識）
  - Text to Speech（音声合成）
    - 言語
    - 音声
- **開始メッセージ**: 表示するか
- **提案質問**: 表示するか
- **センシティブワード回避**: 有効化するか

#### 2.5 環境変数の確認

- APIキーなどの機密情報
- 外部サービスの設定値

### フェーズ3: フロー確認

ヒアリングした内容を基に、ワークフローの全体像を図解または箇条書きで提示：

**チャットフローモード (`advanced-chat`) の例:**
```
[フロー例]
1. 開始 (Start)
   - 入力フィールド不要（sys.queryが自動的に利用可能）
   ↓
2. ユーザー入力: プロンプト（テキスト）
   ↓
3. LLM処理 (GPT-4o)
   - システムプロンプト: "あなたは..."
   - ユーザープロンプト: "{{#sys.query#}}"
   ↓
4. 回答 (Answer)
   - 出力: {{LLMの結果}}
```

**ワークフローモード (`workflow`) の例（Startノード）:**
```
[フロー例]
1. 開始 (Start)
   ↓
2. HTTP Request (外部API呼び出し)
   ↓
3. Code (データ処理)
   ↓
4. End (処理完了、出力変数を返す)
```

**ワークフローモード (`workflow`) の例（スケジュールトリガー）:**
```
[フロー例]
1. スケジュールトリガー (Schedule Trigger)
   - スケジュール: frequency: hourly, visual_config.on_minute: 0 (毎時0分)
   - モード: visual（ビジュアル設定）
   ↓
2. Code (日時取得・メッセージ生成)
   ↓
3. HTTP Request (Slack通知)
   ↓
4. End (処理完了)
```

**ワークフローモード (`workflow`) の例（Webhookトリガー）:**
```
[フロー例1: シンプルなSlack通知]
1. Webhookトリガー (Webhook Trigger)
   - POST / application/json
   - `params: []`でリクエストボディから `message` を抽出
   - `variables:`セクションで`_webhook_raw`と`message`を定義
   ↓
2. HTTP Request (Slack通知)
   - Webhookトリガーから抽出した `message` をSlackに送信
   - `{{#webhook_trigger_id.message#}}`で参照
   ↓
3. End (処理完了、200 OKを返す)

[フロー例2: リクエストデータ処理]
1. Webhookトリガー (Webhook Trigger)
   - POST / application/json
   - `params: []`でBody Parametersを定義: `customer_name`, `items`, `is_priority`
   - `variables:`セクションで`_webhook_raw`とパラメータを定義
   ↓
2. Code (リクエストデータ処理)
   - Webhookトリガーから抽出したパラメータを使用
   - `{{#webhook_trigger_id.customer_name#}}`
   - `{{#webhook_trigger_id.items#}}`
   - `{{#webhook_trigger_id.is_priority#}}`
   ↓
3. HTTP Request (外部API呼び出し)
   ↓
4. End (処理完了、カスタムレスポンスを返す)

[フロー例3: テキスト要約（Codeノードで値を抽出）]
1. Webhookトリガー (Webhook Trigger)
   - POST / application/json
   - `params: []`でBody Parametersを定義: `Webhook_text`, `title`
   - `variables:`セクションで`_webhook_raw`を定義
   ↓
2. Code (テキスト抽出)
   - `_webhook_raw`から`body.Webhook_text`と`body.title`を抽出
   - 入力: `{{#webhook_trigger_id._webhook_raw#}}`
   - 出力: `text`（抽出した`Webhook_text`）、`title`
   ↓
3. LLM (テキスト要約)
   - Codeノードの出力を参照: `{{#code_node_id.text#}}`
   ↓
4. Code (レスポンス生成)
   - LLMの要約結果と`title`をJSON形式に変換
   ↓
5. End (処理完了、JSONレスポンスを返す)

【重要】Webhookトリガーの形式: 本文の「重要: Webhookトリガーの形式」を参照（`config:`は使わない / `async_mode: true` / `params`+`variables` / `webhook_url`は空 など）
```

**チャットフローモード (`advanced-chat`) の例（質問分類器 / Question Classifier）:**

質問分類器（`type: question-classifier`）は、ユーザー入力（通常 `sys.query`）をクラスに分類し、**クラスごとに次ノードへ分岐**させるためのノードです。

**フロー例（最小構成）:**

```
[フロー例: 3クラスに分岐]
1. Start（ユーザー入力: sys.query）
   ↓
2. Question Classifier（質問分類）
   ├─ (after sales) → Knowledge Retrieval → LLM → Answer
   ├─ (product usage) → Knowledge Retrieval → LLM → Answer
   └─ (other) → Answer（定型文 or 追加ヒアリング）
```

**重要ポイント（ここが詰まりやすい）:**

- **`classes[].id` が分岐のハンドルID**です  
  - エッジ（`graph.edges[]`）側の `sourceHandle` が **必ず**この `id` と一致する必要があります
- **入力**: 多くのケースで `query_variable_selector: [start_node_id, sys.query]` を使用します
- **分類の指示**:
  - `instructions` に「どのクラスに分類するか」の判断基準を書く（空だと挙動が不安定になりやすい）
  - 迷う場合は **クラス名（`classes[].name`）を日本語で具体化**し、境界例を数個書く
- **モデル指定**:
  - `model.provider` は実エクスポート例に合わせて `langgenius/openai/openai` のような形式になることがあります（環境差あり）

**質問分類器ノード（実エクスポート例）:**

```yaml
- data:
    classes:
    - id: '1711528736036'
      name: Question related to after sales
    - id: '1711528736549'
      name: Questions about how to use products
    - id: '1711528737066'
      name: Other questions
    desc: 'Define the classification conditions of user questions, LLM can define
      how the conversation progresses based on the classification description. '
    instructions: ''
    model:
      completion_params:
        frequency_penalty: 0
        max_tokens: 512
        presence_penalty: 0
        temperature: 0.7
        top_p: 1
      mode: chat
      name: gpt-3.5-turbo
      provider: langgenius/openai/openai
    query_variable_selector:
    - '1711528708197'
    - sys.query
    selected: false
    title: Question Classifier
    topics: []
    type: question-classifier
  height: 283
  id: '1711528709608'
  position:
    x: 362.5
    y: 714.5
  positionAbsolute:
    x: 362.5
    y: 714.5
  selected: false
  sourcePosition: right
  targetPosition: left
  type: custom
  width: 241
```

**エッジ配線例（分岐の肝：`sourceHandle`）:**

```yaml
# Question Classifier → after sales の分岐先
- data:
    sourceType: question-classifier
    targetType: knowledge-retrieval
  id: 1711528709608-1711528768556
  source: '1711528709608'
  sourceHandle: '1711528736036'  # ★ classes[].id（after sales）
  target: '1711528768556'
  targetHandle: target
  type: custom

# Question Classifier → other の分岐先（定型Answerなど）
- data:
    sourceType: question-classifier
    targetType: answer
  id: 1711528709608-1711528775142
  source: '1711528709608'
  sourceHandle: '1711528737066'  # ★ classes[].id（Other questions）
  target: '1711528775142'
  targetHandle: target
  type: custom
```

**ワークフローモード (`workflow`) の例（Iterationノード）:**
```
[フロー例1: 配列の各要素に対する処理（ポケモン情報取得）]
1. Start (ユーザー入力)
   - 入力: ポケモン名（テキスト）
   ↓
2. LLM (進化系統の取得)
   - 入力されたポケモンの進化系統を英語名でカンマ区切りで出力
   - 出力: "pikachu,raichu" のような文字列
   ↓
3. Code (配列への変換)
   - LLMの出力をカンマ区切りで分割して配列に変換
   - 入力: `{{#llm_node.text#}}`
   - 出力: `pokemons` (array[string]) - 例: ["pikachu", "raichu"]
   ↓
4. Iteration (繰り返し処理)
   - 入力配列: Codeノードの`pokemons`出力
   - `iterator_selector`: [code_node_id, pokemons]
   - `start_node_id`: iteration_node_idstart
   - 各要素に対して繰り返し処理を実行
   ↓
   [Iteration内の処理]
   4-1. iteration-start (繰り返し開始)
        - 各繰り返しの開始点
        - 現在の要素は `{{#iteration_node_id.item#}}` で参照可能
        ↓
   4-2. HTTP Request (API呼び出し)
        - PokeAPIからポケモン情報を取得
        - URL: `https://pokeapi.co/api/v2/pokemon-species/{{#iteration_node_id.item#}}`
        - 現在の繰り返し要素（例: "pikachu"）を使用
        ↓
   4-3. LLM (情報整理)
        - APIレスポンスを日本語で整理
        - 入力: `{{#http_request_node.body#}}`
        - 出力: `text` (string) - 整理された情報
   ↓
5. End (処理完了)
   - Iterationノードの出力を返す
   - `output_selector`: [llm_in_iteration_id, text]
   - `output_type`: array[string]
   - 出力: 各ポケモンの情報を配列として返す
     - 例: ["名前: ピカチュウ\nタイプ: でんき\n...", "名前: ライチュウ\nタイプ: でんき\n..."]

[フロー例2: 複数ドキュメントの処理（並列実行）]
1. Start (ユーザー入力)
   - 入力: ドキュメントURLのリスト（テキスト、カンマ区切り）
   ↓
2. Code (URLリストの生成)
   - 入力文字列をカンマ区切りで分割して配列に変換
   - 出力: `urls` (array[string])
   ↓
3. Iteration (繰り返し処理、並列実行)
   - 入力配列: Codeノードの`urls`出力
   - `is_parallel: true` (並列実行)
   - `parallel_nums: 5` (最大5つ同時実行)
   - `error_handle_mode: remove-abnormal-output` (エラー時はその要素を除外)
   ↓
   [Iteration内の処理]
   3-1. iteration-start (繰り返し開始)
        - 現在のURL: `{{#iteration_node_id.item#}}`
        ↓
   3-2. HTTP Request (ドキュメント取得)
        - URL: `{{#iteration_node_id.item#}}`
        - ドキュメントを取得
        ↓
   3-3. Code (テキスト抽出)
        - HTML/PDFからテキストを抽出
        - 出力: `text` (string)
        ↓
   3-4. LLM (要約)
        - ドキュメントを要約
        - 入力: `{{#code_node.text#}}`
        - 出力: `summary` (string)
   ↓
4. Code (結果の集約)
   - Iterationノードの出力を整形
   - 入力: `{{#iteration_node_id.output#}}` (array[string])
   - 出力: 整形された結果
   ↓
5. End (処理完了)
   - 集約された結果を返す

[フロー例3: 検索クエリの繰り返し実行]
1. Start (ユーザー入力)
   - 入力: 検索クエリのリスト（テキスト、改行区切り）
   ↓
2. Code (クエリリストの生成)
   - 改行区切りの文字列を配列に変換
   - 出力: `queries` (array[string])
   ↓
3. Iteration (繰り返し処理)
   - 入力配列: Codeノードの`queries`出力
   - `is_parallel: false` (順次実行)
   ↓
   [Iteration内の処理]
   3-1. iteration-start (繰り返し開始)
        - 現在のクエリ: `{{#iteration_node_id.item#}}`
        ↓
   3-2. Tool (Web検索)
        - Tavily Searchを使用
        - クエリ: `{{#iteration_node_id.item#}}`
        - 出力: `text` (string)  ※ツールにより `result/output/data/text` など変わるため、実エクスポートに合わせる
        ↓
   3-3. LLM (検索結果の整理)
        - 検索結果を要約・整理
        - 入力: `{{#tool_node.text#}}`（または `result` 等、実際の出力名に合わせる）
        - 出力: `text` (string)
   ↓
4. Code (結果の統合)
   - 各検索結果を統合
   - 入力: `{{#iteration_node_id.output#}}` (array[string])
   - 出力: 統合された結果
   ↓
5. End (処理完了)
   - 統合された検索結果を返す

【重要】Iterationノードの設定:
- **`iterator_selector`**: 繰り返しの入力元を指定 [ノードID, 出力変数名]
- **`start_node_id`**: iteration-startノードのID（`{iteration_node_id}start`の形式）
- **`output_selector`**: 繰り返しの結果を取得するノードと変数名 [ノードID, 出力変数名]
- **`output_type`**: 出力の型（array[string], array[object], array[number]等）
- **`is_parallel`**: 並列実行するか（true/false）
- **`parallel_nums`**: 並列実行時の最大同時実行数（is_parallel: trueの場合）
- **`error_handle_mode`**: エラーハンドリングモード（terminated, remove-abnormal-output等）
- **`flatten_output`**: 出力をフラット化するか（true/false）

【重要】Iteration内のノード設定:
- **`isInIteration: true`**: iteration内であることを示す（必須）
- **`iteration_id`**: どのiterationに属しているか（IterationノードのID）
- **`parentId`**: 親ノード（Iterationノード）のID（必須）
- **`zIndex: 1002`**: 表示順序（高い値）
- **変数参照**: 現在の繰り返し要素は `{{#iteration_node_id.item#}}` で参照可能

【重要】iteration-startノード:
- **`id`**: `{iteration_node_id}start`の形式（例: `1733226413055start`）
- **`parentId`**: IterationノードのID（必須）
- **`type: custom-iteration-start`**: 必須
- **`draggable: false`** と **`selectable: false`**: 必須
- **`zIndex: 1002`**: 必須
```

**確認ポイント:**
- フローは正しいですか？
- 追加/変更したい処理はありますか？
- 分岐や繰り返しは適切ですか？
- チャットフローモードの場合: Answerノードが最後にありますか？
- ワークフローモードの場合: Answerノードは不要です（Endノードで自動終了）
- トリガーノードを使用する場合: トリガーの設定（スケジュール、Webhook URL等）は正しいですか？
- **Iterationノードを使用する場合:**
  - `iterator_selector`で入力配列が正しく指定されていますか？
  - `output_selector`で出力元のノードと変数名が指定されていますか？
  - `output_type`が正しく設定されていますか？
  - iteration-startノードが正しく設定されていますか？（`{iteration_node_id}start`の形式）
  - iteration内のノードに`isInIteration: true`と`parentId`が設定されていますか？
  - 現在の繰り返し要素は`{{#iteration_node_id.item#}}`で参照できますか？

### フェーズ4: DSL生成

フローが確定したら、`Dify_DSL作成マニュアル.md`を参照してYAMLファイルを生成します。

#### 4.0 生成手順（推奨: FlowSpec → DSL の二段階）

**複雑なワークフロー（分岐/反復/複数ツール）ほど、いきなりYAMLを書かずに「フロー仕様（FlowSpec）」を先に確定**してください。\
その後、FlowSpecを機械的にDSL（YAML）へ変換し、チェックリストで自己検証してから出力します。

**FlowSpec（例。YAMLに変換する前の仕様）:**
- **app**: name / description / mode / icon / icon_background
- **trigger**（必要な場合）: schedule / webhook / start
- **nodes**（順序と役割）:
  - node_id / type / inputs（variable_selector）/ outputs / 目的（1行）
- **edges**（接続）:
  - source → target（必要なら sourceHandle）
- **branching**（If-Else）:
  - if_node_id / cases（case_id一覧）/ 各caseの遷移先ノード
- **iteration**（Iteration）:
  - iteration_node_id / iterator_selector / start_node_id（`{iteration_id}start`）/ output_selector / output_type
- **loop**（Loop）:
  - loop_node_id / loop-start / loop-end / ループ条件 / isInLoopの扱い

#### 4.1 生成規則

1. **ファイル名**: `{ワークフロー名の英数字化}_{タイムスタンプ}.yml`
   - 例: `data_analysis_chatflow_20251010.yml`

2. **重要: Dify製品バージョンとDSLの`version`は別物**
   - Dify 1.10.0のような**製品バージョン**と、DSL YAMLのトップレベルにある `version: 0.1.x` のような**DSLフォーマットのバージョン**は別物です。
   - ルール上は、Difyの**実エクスポート例（`DSL/`配下のサンプル）と同じトップレベル構造**を優先し、`kind: app` と `version: 0.1.5`（または `0.1.x`）を採用します。

3. **必須フィールド**:
   - `app`: アプリケーション情報
   - `kind`: app
   - `version`: 0.1.5（推奨。DifyのエクスポートDSLと整合する値を優先）
   - `workflow` または `model_config`: モードに応じて
   - `dependencies`: プラグインを使用する場合（Agentノード、Toolノード等）

4. **ノードID生成**:
   - タイムスタンプベース（推奨）
   - または意味のある名前（start, llm_main等）

5. **エッジ（接続）生成**:
   - すべてのノード間の接続を定義
   - `source`, `target`, `sourceHandle`, `targetHandle`を適切に設定

6. **変数参照**:
   - テンプレート記法: `{{#ノードID.出力変数名#}}`
   - Variable Selector: `[ノードID, 出力変数名]`

7. **開始ノード/トリガーノードの生成**:
   - **Startノード**: 通常の開始ノードを生成
     ```yaml
     - data:
         type: start
         variables: []  # または入力変数
       id: start_node_id
     ```
   - **スケジュールトリガー**: スケジュール設定を含むトリガーノードを生成
     
     **重要: 頻度（frequency）は必ず設定してください**
     - `frequency`は`config`セクションとトップレベルの両方に必ず設定する
     - **`config`セクション内の`frequency`はデフォルト値として`daily`を設定**（実際の頻度とは関係なく、固定値）
     - **トップレベルの`frequency`は実際の実行頻度を指定**（`hourly`, `daily`, `weekly`, `monthly`のいずれか）
     - 頻度の欄が空白にならないようにするため
     
     **重要: ビジュアル設定をデフォルトとして使用します。起動時からビジュアル設定が適用されます。**
     
     ```yaml
     - data:
         config:
           frequency: daily  # デフォルト値（固定、実際の頻度とは関係ない）
           mode: visual  # visual（デフォルト、必ず使用）
           timezone: UTC  # config内はUTC（固定）
           visual_config:
             monthly_days: [1]  # デフォルト値（実際の設定とは関係ない）
             on_minute: 0  # デフォルト値（実際の設定とは関係ない）
             time: 12:00 AM  # デフォルト値（実際の設定とは関係ない）
             weekdays: [sun]  # デフォルト値（実際の設定とは関係ない）
         frequency: daily  # トップレベル: 実際の実行頻度（hourly, daily, weekly, monthly）
         mode: visual
         selected: false
         timezone: Asia/Tokyo  # 実際に使用するタイムゾーン
         title: スケジュールトリガー
         type: trigger-schedule  # 重要: trigger-schedule（schedule-triggerではない）
         visual_config:
           monthly_days: []  # 使用しない場合は空配列（毎月の場合のみ使用）
           on_minute: 0  # 毎時の場合: 0-59の数値、毎日/毎週/毎月の場合: 0（数値、timeフィールドで時刻を指定するため）
           time: 12:15 PM  # 毎日/毎週/毎月の場合: '12:00 PM', '4:31 PM'など
           weekdays: []  # 使用しない場合は空配列（毎週の場合のみ使用）
       height: 130  # 推奨: 130（128ではない）
       id: '20251225171043'  # タイムスタンプベースの文字列ID
       position:
         x: -631.46
         y: 246.99
       positionAbsolute:
         x: -631.46
         y: 246.99
       selected: false
       sourcePosition: right
       targetPosition: left
       type: custom
       width: 242
     ```
     
     **重要なポイント:**
     - `type: trigger-schedule`（`schedule-trigger`ではない）
     - **`mode: visual`（デフォルト、必ず使用）** - 起動時からビジュアル設定が適用される
     - **`frequency`: 実行頻度を指定（必須、必ず設定）** - `hourly`, `daily`, `weekly`, `monthly`のいずれかを指定
     - **`frequency`は`config`セクションとトップレベルの両方に必ず設定する**:
       - `config`セクション内は`daily`（デフォルト値、固定）
       - トップレベルは実際の実行頻度（`hourly`, `daily`, `weekly`, `monthly`）
     - **`timezone`の設定**:
       - `config`セクション内は`UTC`（固定）
       - トップレベルは実際に使用するタイムゾーン（例: `Asia/Tokyo`）
     - **`visual_config`の設定**:
       - `visual_config`は`config`セクションとトップレベルの両方に設定する
       - **`config`セクション内の`visual_config`はデフォルト値**（実際の設定とは関係ない）
       - **トップレベルの`visual_config`が実際の設定**:
         - `monthly_days`: 毎月の場合のみ使用（例: `[1, 15, 30]`）、使用しない場合は空配列`[]`
        - `on_minute`: 
          - 毎時の場合: `0-59`の数値（例: `37`）
          - 毎日/毎週/毎月の場合: `0`（数値、`time`フィールドで時刻を指定するため）
         - `time`: 毎日/毎週/毎月の場合に使用（例: `'12:00 PM'`, `'4:31 PM'`）、毎時の場合は使用しない
         - `weekdays`: 毎週の場合のみ使用（例: `['mon', 'wed', 'fri']`）、使用しない場合は空配列`[]`
     - `height: 130`を推奨（128ではない）
     - `position`と`positionAbsolute`を設定（ノードの位置情報）
     - `selected: false`を設定（または`true`）
     - `id`はタイムスタンプベースの文字列形式（例: `'20251225171043'`）
     - `sourcePosition: right` と `targetPosition: left` を追加
     - エッジに `isInLoop: false` を追加
     - **Cron式（cronモード）は使用しない**（Difyが対応していないため）
     
     **frequency と visual_config の組み合わせ例（実際のエクスポート形式に基づく）:**
     - **毎時37分**: 
       ```yaml
       config:
         frequency: daily  # デフォルト値（固定）
         visual_config:
           monthly_days: [1]  # デフォルト値
           on_minute: 0  # デフォルト値
           time: 12:00 AM  # デフォルト値
           weekdays: [sun]  # デフォルト値
       frequency: hourly  # トップレベル: 実際の頻度
       visual_config:
         monthly_days: []  # 使用しない
         on_minute: 37  # 毎時37分（数値）
         time: 1:42 PM  # 使用しない（デフォルト値が残る場合がある）
         weekdays: []  # 使用しない
       ```
     - **毎日12:15**: 
       ```yaml
       config:
         frequency: daily  # デフォルト値（固定）
         visual_config:
           monthly_days: [1]  # デフォルト値
           on_minute: 0  # デフォルト値
           time: 12:00 AM  # デフォルト値
           weekdays: [sun]  # デフォルト値
       frequency: daily  # トップレベル: 実際の頻度
       visual_config:
         monthly_days: []  # 使用しない
         on_minute: 0  # 毎日/毎週/毎月の場合: 0（数値、timeフィールドで時刻を指定するため）
         time: 12:15 PM  # 実行時刻
         weekdays: []  # 使用しない
       ```
     - **毎週月・水・木の12:08**: 
       ```yaml
       config:
         frequency: daily  # デフォルト値（固定）
         visual_config:
           monthly_days: [1]  # デフォルト値
           on_minute: 0  # デフォルト値
           time: 12:00 AM  # デフォルト値
           weekdays: [sun]  # デフォルト値
       frequency: weekly  # トップレベル: 実際の頻度
       visual_config:
         monthly_days: []  # 使用しない
         on_minute: 0  # 毎日/毎週/毎月の場合: 0（数値、timeフィールドで時刻を指定するため）
         time: 12:08 AM  # 実行時刻
         weekdays: ['mon', 'thu', 'wed']  # 実行する曜日（複数選択可）
       ```
     - **毎月1:59 PM**: 
       ```yaml
       config:
         frequency: daily  # デフォルト値（固定）
         visual_config:
           monthly_days: [1]  # デフォルト値
           on_minute: 0  # デフォルト値
           time: 12:00 AM  # デフォルト値
           weekdays: [sun]  # デフォルト値
       frequency: monthly  # トップレベル: 実際の頻度
       visual_config:
         monthly_days: []  # 空配列（日付を指定しない場合、または日付を指定する場合は[1, 15]など）
         on_minute: 0  # 毎日/毎週/毎月の場合: 0（数値、timeフィールドで時刻を指定するため）
         time: 1:59 PM  # 実行時刻
         weekdays: []  # 使用しない
       ```
     - **毎月1日と15日の12:00**: 
       ```yaml
       config:
         frequency: daily  # デフォルト値（固定）
         visual_config:
           monthly_days: [1]  # デフォルト値
           on_minute: 0  # デフォルト値
           time: 12:00 AM  # デフォルト値
           weekdays: [sun]  # デフォルト値
       frequency: monthly  # トップレベル: 実際の頻度
       visual_config:
         monthly_days: [1, 15]  # 実行する日付（複数選択可、1-31）
         on_minute: 0  # 毎日/毎週/毎月の場合: 0（数値、timeフィールドで時刻を指定するため）
         time: 12:00 PM  # 実行時刻
         weekdays: []  # 使用しない
       ```
     
     **注意: Cron式（cronモード）は使用しません**
     - スケジュールトリガーは常にビジュアル設定（`mode: visual`）を使用します
     - Cron式（`mode: cron`）は使用しません（Difyが対応していないため）
   - **Webhookトリガー**: Webhook設定を含むトリガーノードを生成
     
     **重要: 動作する形式（実際のDifyエクスポート形式）:**
     ```yaml
     - data:
         async_mode: true
         body: []
         content_type: application/json  # application/json, application/x-www-form-urlencoded, multipart/form-data, text/plain
         headers: []
         method: POST  # GET, POST, PUT, DELETE, PATCH（大文字）
         params:
         - name: Webhook_text  # リクエストボディから抽出するパラメータ名
           required: false
           type: string  # string, number, boolean, object, array[string], array[number], array[boolean], array[object]
         - name: title
           required: false
           type: string
         response_body: ''
         selected: true  # または false
         status_code: 200  # 200-399の範囲
         title: Webhook トリガー
         type: trigger-webhook  # 重要: trigger-webhook（webhook-triggerではない）
         variables:
         - label: raw
           required: true
           value_selector: []
           value_type: object
           variable: _webhook_raw  # 生のリクエストデータ（常に必要）
         - label: param
           required: false
           value_selector: []
           value_type: string
           variable: Webhook_text  # paramsで定義したパラメータ名と同じ
         - label: param
           required: false
           value_selector: []
           value_type: string
           variable: title
         webhook_debug_url: ''  # 空文字列（Difyが自動生成）
         webhook_url: ''  # 空文字列（Difyが自動生成）
       height: 130
       id: webhook_trigger_id
       position:
         x: -632.46
         y: 245.99
       positionAbsolute:
         x: -632.46
         y: 245.99
       selected: true  # または false
       sourcePosition: right
       targetPosition: left
       type: custom
       width: 242
     ```
     
     **重要なポイント:**
     - `type: trigger-webhook`（`webhook-trigger`ではない）
     - **`async_mode: true`を必ず設定**（必須）
     - **`method`: HTTPメソッドを指定（必須、大文字）** - `GET`, `POST`, `PUT`, `DELETE`, `PATCH`のいずれか
     - **`content_type`: コンテンツタイプを指定（必須）** - `application/json`, `application/x-www-form-urlencoded`, `multipart/form-data`, `text/plain`のいずれか
     - **`body: []`を必ず設定**（空配列でも可）
     - **`headers: []`を必ず設定**（空配列でも可）
     - **`params: []`でリクエストから抽出するパラメータを定義**（`body_parameters`ではなく`params`を使用）
     - **`variables:`セクションで`_webhook_raw`とパラメータを定義**（`params`で定義したパラメータ名と同じ変数名を`variables`にも追加）
     - **`response_body: ''`と`status_code: 200`を設定**（デフォルト値）
     - **`webhook_url`と`webhook_debug_url`は空文字列**（Difyが自動生成）
     - **`config:`セクションは使用しない**（古い形式のため動作しない）
     - `sourcePosition: right` と `targetPosition: left` を追加
     - エッジに `isInIteration: false` と `isInLoop: false` を追加
     - `height: 130`を推奨
     
     **パラメータ抽出の設定例（`params`を使用）:**
     ```yaml
     params:
     - name: Webhook_text  # 変数名（出力変数として使用可能、{{#webhook_trigger_id.Webhook_text#}}で参照）
       required: false  # true または false
       type: string  # string, number, boolean, object, array[string], array[number], array[boolean], array[object]
     - name: title
       required: false
       type: string
     ```
     
     **`variables`セクションの設定:**
     ```yaml
     variables:
     - label: raw
       required: true
       value_selector: []
       value_type: object
       variable: _webhook_raw  # 生のリクエストデータ（常に必要）
     - label: param
       required: false
       value_selector:
       - _webhook_raw
       - body
       - Webhook_text
       value_type: string
       variable: Webhook_text  # paramsで定義したパラメータ名と同じ
     - label: param
       required: false
       value_selector:
       - _webhook_raw
       - body
       - title
       value_type: string
       variable: title
     ```
     
     **重要: パラメータ抽出の注意事項**
     - `value_selector: []`（空配列）に設定すると、自動的に`webhook_body`から抽出されることを期待できますが、**実際には動作しない場合があります**
     - `value_selector: [_webhook_raw, body, パラメータ名]`の形式も試せますが、動作しない場合があります
     - **推奨方法**: Codeノードを使用して`_webhook_raw`から値を抽出する（後述の「Codeノードを使用したパラメータ抽出」を参照）
     
     **変数参照の方法:**
     - `params`で定義したパラメータは、`{{#webhook_trigger_id.パラメータ名#}}`で参照可能（ただし、値が`null`になる場合がある）
     - 例: `{{#1766733296199.Webhook_text#}}`
     - **推奨**: Codeノードを使用して値を抽出し、Codeノードの出力を参照する
     
     **Codeノードを使用したパラメータ抽出（推奨）:**
     ```yaml
     # WebhookトリガーとLLMノードの間にCodeノードを追加
     - data:
         code: |
           def main(webhook_raw: dict) -> dict:
               # _webhook_rawからWebhook_textを抽出
               text = webhook_raw.get('body', {}).get('Webhook_text', '')
               title = webhook_raw.get('body', {}).get('title', None)
               
               return {
                   "text": text,
                   "title": title
               }
         code_language: python3
         desc: '_webhook_rawからWebhook_textを抽出'
         outputs:
           text:
             children: null
             type: string
           title:
             children: null
             type: string
         title: テキスト抽出
         type: code
         variables:
         - value_selector:
           - 'webhook_trigger_id'
           - _webhook_raw
           variable: webhook_raw
       id: text_extract_code_id
     ```
     
     **LLMノードでの参照:**
     ```yaml
     prompt_template:
     - id: user
       role: user
       text: '以下のテキストを要約してください:\n\n{{#text_extract_code_id.text#}}'
     ```
     
     **エッジの設定:**
     
     **Codeノードを使用しない場合:**
     ```yaml
     - data:
         isInIteration: false
         isInLoop: false
         sourceType: trigger-webhook
         targetType: llm  # または次のノードタイプ
       id: webhook_trigger_id-next_node_id
       source: 'webhook_trigger_id'
       sourceHandle: source
       target: 'next_node_id'
       targetHandle: target
       type: custom
       zIndex: 0
     ```
     
     **Codeノードを使用する場合（推奨）:**
     ```yaml
     # Webhookトリガー → Code（テキスト抽出）
     - data:
         isInIteration: false
         isInLoop: false
         sourceType: trigger-webhook
         targetType: code
       id: webhook_trigger_id-text_extract_code_id
       source: 'webhook_trigger_id'
       sourceHandle: source
       target: 'text_extract_code_id'
       targetHandle: target
       type: custom
       zIndex: 0
     # Code（テキスト抽出） → LLM
     - data:
         isInIteration: false
         isInLoop: false
         sourceType: code
         targetType: llm
       id: text_extract_code_id-llm_node_id
       source: 'text_extract_code_id'
       sourceHandle: source
       target: 'llm_node_id'
       targetHandle: target
       type: custom
       zIndex: 0
     ```
     
     **注意: `config:`セクション形式は動作しない**
     - 以下の形式は使用しない（動作しない）:
       ```yaml
       config:
         method: post
         content_type: application/json
         body_parameters: []
       ```
     - 代わりに、上記の動作する形式を使用する
     
     **動作する形式と動作しない形式の違い:**
     
     | 項目 | 動作する形式（推奨） | 動作しない形式（非推奨） |
     |------|---------------------|----------------------|
     | 構造 | `config:`セクションなし | `config:`セクションあり |
     | `async_mode` | `async_mode: true`（必須） | なし |
     | `body` | `body: []`（必須） | `config.body_parameters: []` |
     | `headers` | `headers: []`（必須） | `config.header_parameters: []` |
     | `method` | トップレベル、大文字（`POST`） | `config.method: post`（小文字） |
     | `content_type` | トップレベル | `config.content_type` |
     | パラメータ定義 | `params: []` | `config.body_parameters: []` |
     | 変数定義 | `variables:`セクションで`_webhook_raw`とパラメータを定義 | なしまたは異なる形式 |
     | `response_body` | `response_body: ''` | `config.response.body` |
     | `status_code` | `status_code: 200` | `config.response.status_code` |
     | `webhook_url` | 空文字列（Difyが自動生成） | 固定URL（動作しない） |
     | `webhook_debug_url` | 空文字列（Difyが自動生成） | 固定URL（動作しない） |
     | `height` | `130`（推奨） | `128` |
     
     **動作する形式の完全な例:**
     ```yaml
     - data:
         async_mode: true
         body: []
         content_type: application/json
         headers: []
         method: POST
         params:
         - name: Webhook_text
           required: false
           type: string
         - name: title
           required: false
           type: string
         response_body: ''
         selected: true
         status_code: 200
         title: Webhook トリガー
         type: trigger-webhook
         variables:
         - label: raw
           required: true
           value_selector: []
           value_type: object
           variable: _webhook_raw
         - label: param
           required: false
           value_selector:
           - _webhook_raw
           - body
           - Webhook_text
           value_type: string
           variable: Webhook_text
         - label: param
           required: false
           value_selector:
           - _webhook_raw
           - body
           - title
           value_type: string
           variable: title
         webhook_debug_url: ''
         webhook_url: ''
       height: 130
       id: '1766733296199'
       position:
         x: -319.99827575683594
         y: 336.0017318725586
       positionAbsolute:
         x: -319.99827575683594
         y: 336.0017318725586
       selected: true
       sourcePosition: right
       targetPosition: left
       type: custom
       width: 242
     ```

7. **WebhookトリガーでLLM処理が必要な場合の自動生成ロジック**:
   
   **重要**: WebhookトリガーでLLM処理が必要な場合、`params`で定義したパラメータが`variables`セクションで正しく抽出されない可能性があるため、**自動的にCodeノードを追加**して`_webhook_raw`から値を抽出する。
   
   **生成ロジック**:
   1. Webhookトリガーノードを生成
      - `params: []`でパラメータを定義（例: `Webhook_text`, `title`）
      - `variables:`セクションで`_webhook_raw`を定義
      - パラメータの`value_selector`は`[_webhook_raw, body, パラメータ名]`に設定（動作しない場合があるが、設定は残す）
   
   2. Codeノード（テキスト抽出）を自動追加
      - WebhookトリガーとLLMノードの間に配置
      - 入力: `_webhook_raw`（Webhookトリガーノードから）
      - コード生成ロジック:
        ```python
        def main(webhook_raw: dict) -> dict:
            # _webhook_rawからパラメータを抽出
            # paramsで定義した各パラメータに対して以下を生成:
            # param_name = webhook_raw.get('body', {}).get('パラメータ名', 'デフォルト値')
            
            return {
                # paramsで定義した各パラメータを出力変数として定義
                # 例: "text": text, "title": title
            }
        ```
      - 出力: `params`で定義した各パラメータに対応する出力変数を生成
        - **出力変数名のマッピング規則**:
          - パラメータ名が`Webhook_text`の場合、出力変数名は`text`（`Webhook_`プレフィックスを除去）
          - その他のパラメータ（例: `title`）はそのまま使用
          - 例: `params`に`Webhook_text`と`title`がある場合、出力は`text`と`title`
        - **出力定義の生成**:
          ```yaml
          outputs:
            text:  # Webhook_text → text
              children: null
              type: string
            title:  # title → title（そのまま）
              children: null
              type: string
          ```
   
   3. LLMノードの生成
      - プロンプトテンプレートでCodeノードの出力を参照
      - 例: `{{#text_extract_code_id.text#}}`
   
   4. エッジの生成
      - Webhookトリガー → Code（テキスト抽出） → LLM → 次のノード
   
   5. レスポンス生成が必要な場合（ワークフローモード）
      - LLMノードの後にCodeノード（レスポンス生成）を追加
      - 入力: Codeノード（テキスト抽出）の出力（例: `title`）、LLMノードの出力（例: `text`）
      - コード生成ロジック:
        ```python
        import json
        
        def main(title: str, summary: str) -> dict:
            # titleがNoneの場合は"タイトルなし"に設定
            if title is None:
                title = "タイトルなし"
            
            # 成功レスポンスを生成（JSONオブジェクトとして返す）
            result = {
                "title": title,
                "summary": summary
            }
            return {"result": json.dumps(result, ensure_ascii=False)}
        ```
      - 出力: `result`（JSON文字列）
      - Endノードで`result`を参照
   
   **生成例（Webhookテキスト要約ワークフロー）**:
   ```yaml
   # 1. Webhookトリガー
   - data:
       async_mode: true
       body: []
       content_type: application/json
       headers: []
       method: POST
       params:
       - name: Webhook_text
         required: false
         type: string
       - name: title
         required: false
         type: string
       variables:
       - label: raw
         required: true
         value_selector: []
         value_type: object
         variable: _webhook_raw
       # パラメータのvariablesも定義（動作しない場合があるが設定は残す）
       - label: param
         required: false
         value_selector: [_webhook_raw, body, Webhook_text]
         value_type: string
         variable: Webhook_text
       - label: param
         required: false
         value_selector: [_webhook_raw, body, title]
         value_type: string
         variable: title
       type: trigger-webhook
       id: 'webhook_trigger_id'
   
   # 2. Codeノード（テキスト抽出）- 自動追加
   - data:
       code: |
         def main(webhook_raw: dict) -> dict:
             # _webhook_rawからWebhook_textを抽出
             text = webhook_raw.get('body', {}).get('Webhook_text', '')
             title = webhook_raw.get('body', {}).get('title', None)
             
             return {
                 "text": text,
                 "title": title
             }
       code_language: python3
       desc: '_webhook_rawからパラメータを抽出'
       outputs:
         text:
           children: null
           type: string
         title:
           children: null
           type: string
       title: テキスト抽出
       type: code
       variables:
       - value_selector:
         - 'webhook_trigger_id'
         - _webhook_raw
         variable: webhook_raw
       id: 'text_extract_code_id'
   
   # 3. LLMノード
   - data:
       prompt_template:
       - id: user
         role: user
         text: '以下のテキストを要約してください:\n\n{{#text_extract_code_id.text#}}'
       type: llm
       id: 'llm_node_id'
   
   # 4. Codeノード（レスポンス生成）- オプション
   - data:
       code: |
         import json
         
         def main(title: str, summary: str) -> dict:
             # titleがNoneの場合は"タイトルなし"に設定
             if title is None:
                 title = "タイトルなし"
             
             # 成功レスポンスを生成（JSONオブジェクトとして返す）
             result = {
                 "title": title,
                 "summary": summary
             }
             return {"result": json.dumps(result, ensure_ascii=False)}
       code_language: python3
       desc: '成功レスポンスJSONを生成'
       outputs:
         result:
           children: null
           type: string
       title: レスポンス生成
       type: code
       variables:
       - value_selector:
         - 'text_extract_code_id'
         - title
         variable: title
       - value_selector:
         - 'llm_node_id'
         - text
         variable: summary
       id: 'response_code_id'
   
   # 5. Endノード
   - data:
       outputs:
       - value_selector:
         - 'response_code_id'
         - result
         variable: result
       type: end
       id: 'end_node_id'
   
   # 6. エッジ
   - source: 'webhook_trigger_id'
     target: 'text_extract_code_id'
   - source: 'text_extract_code_id'
     target: 'llm_node_id'
   - source: 'llm_node_id'
     target: 'response_code_id'
   - source: 'response_code_id'
     target: 'end_node_id'
   ```

8. **Iterationノード（反復処理）の生成**:

   **重要**: Iterationノードを使用する場合、以下の構造を必ず使用する。
   
   **設計原則（要点）:** Iterationは「データ（配列）の反復」、エージェントは「思考・ツールの反復」。詳細は「2.2 処理フローの確認」の「エージェントノードとイテレーションの使い分け」を参照。
   
   **Iterationノードの構造:**
   ```yaml
   - data:
       desc: '反復処理の説明'
       error_handle_mode: remove-abnormal-output  # エラーハンドリングモード（推奨）
       is_parallel: false  # 並列実行するか（true/false）
       iterator_selector:
       - 'array_node_id'  # 配列を出力するノードID
       - array_output_name  # 配列の出力変数名
       output_selector:  # 必須: 出力を指定するノードと変数名
       - 'last_node_in_iteration_id'  # イテレーション内の最後のノードID
       - output_variable_name  # 最後のノードの出力変数名
       output_type: array[string]  # 必須: 出力の型（array[string], array[object], array[number]等）
       parallel_nums: 3  # 並列実行する場合の数（is_parallel: trueの場合）
       selected: false
       start_node_id: '{iteration_node_id}start'  # 必須: iteration-startノードのID（{iteration_node_id}startの形式）
       title: イテレーション
       type: iteration
     height: 443  # イテレーション内のノード数に応じて調整
     id: 'iteration_node_id'  # IterationノードのID
     position:
       x: 1246
       y: 421.5
     positionAbsolute:
       x: 1246
       y: 421.5
     selected: false
     sourcePosition: right
     targetPosition: left
     type: custom
     width: 669  # イテレーション内のノード数に応じて調整
     zIndex: 1
   ```
   
   **重要なポイント:**
   - **`output_selector`を必ず設定**（イテレーション内の最後のノードIDと出力変数名）
   - **`output_type`を必ず設定**（出力の型を指定）
   - **`start_node_id`は`{iteration_node_id}start`の形式**（例: `1733226413055start`）
   - `error_handle_mode: remove-abnormal-output`を推奨（エラー時の動作を制御）
   - `is_parallel: true`の場合、`parallel_nums`を設定
   
   **iteration-startノードの生成:**
   ```yaml
   - data:
       desc: ''
       isInIteration: true
       selected: false
       title: ''  # 空文字列
       type: iteration-start
     draggable: false  # 必須: ドラッグ不可
     height: 48
     id: '{iteration_node_id}start'  # 必須: {iteration_node_id}startの形式
     parentId: '{iteration_node_id}'  # 必須: IterationノードのID
     position:
       x: 24  # Iterationノード内の相対位置
       y: 68
     positionAbsolute:
       x: 1270  # 絶対位置（Iterationノードの位置 + 相対位置）
       y: 489.5
     selectable: false  # 必須: 選択不可
     sourcePosition: right
     targetPosition: left
     type: custom-iteration-start  # 必須: custom-iteration-start
     width: 44
     zIndex: 1002  # 必須: 高いzIndex値
   ```
   
   **重要なポイント:**
   - **`id`は`{iteration_node_id}start`の形式**（例: `1733226413055start`）
   - **`parentId`はIterationノードのID**（必須）
   - **`type: custom-iteration-start`**（必須）
   - **`draggable: false`と`selectable: false`**（必須）
   - **`zIndex: 1002`**（必須、高い値）
   - `isInIteration: true`（必須）
   
   **イテレーション内のノードの生成:**
   ```yaml
   - data:
       # ノード固有の設定（code, llm, tool等）
       isInIteration: true  # 必須: イテレーション内であることを示す
       iteration_id: '{iteration_node_id}'  # 必須: IterationノードのID
       # その他のノード設定...
     id: 'node_in_iteration_id'
     parentId: '{iteration_node_id}'  # 必須: IterationノードのID
     position:
       x: 128  # Iterationノード内の相対位置
       y: 68
     positionAbsolute:
       x: 1374  # 絶対位置（Iterationノードの位置 + 相対位置）
       y: 489.5
     type: custom
     zIndex: 1002  # 必須: 高いzIndex値
   ```
   
   **重要なポイント:**
   - **`parentId`はIterationノードのID**（必須）
   - **`isInIteration: true`**（必須）
   - **`iteration_id`はIterationノードのID**（必須）
   - **`zIndex: 1002`**（必須、高い値）
   - 位置はIterationノード内の相対位置と絶対位置の両方を設定
   
   **イテレーション内のエッジの生成:**
   ```yaml
   - data:
       isInIteration: true  # 必須: イテレーション内であることを示す
       iteration_id: '{iteration_node_id}'  # 必須: IterationノードのID
       sourceType: iteration-start  # または他のノードタイプ
       targetType: tool  # または他のノードタイプ
     id: '{iteration_node_id}start-source-{target_node_id}-target'
     source: '{iteration_node_id}start'  # iteration-startノードのID
     sourceHandle: source
     target: '{target_node_id}'
     targetHandle: target
     type: custom
     zIndex: 1002  # 必須: 高いzIndex値
   ```
   
   **重要なポイント:**
   - **`isInIteration: true`**（必須）
   - **`iteration_id`はIterationノードのID**（必須）
   - **`zIndex: 1002`**（必須、高い値）
   - iteration-startからのエッジ: `source: {iteration_node_id}start`
   
   **Iterationノードの出力参照:**
   - Iterationノードの出力は、`output_selector`で指定したノードの出力を配列として返す
   - 参照方法: `{{#iteration_node_id.output#}}`
   - 例: `{{#1733226413055.output#}}`
   
   **注意事項:**
   - **iteration-endノードは存在しない**（最後のノードが自動的にiteration-endとして機能）
   - イテレーション内の最後のノードからIterationノードへのエッジは不要（自動的に接続される）
   - Iterationノードから次のノードへのエッジは、Iterationノードの`source`ハンドルから接続
   - イテレーション内のノードは、Iterationノードの子ノードとして扱われる
   - イテレーション内のノードの位置は、Iterationノード内の相対位置と絶対位置の両方を設定する必要がある
   
   **生成例（3回検索の繰り返し）:**
   ```yaml
   # 1. Codeノード（配列生成）
   - data:
       code: |
         def main() -> dict:
             search_list = [1, 2, 3]
             return {"search_list": search_list}
       outputs:
         search_list:
           type: array
       type: code
     id: 'array_code_id'
   
   # 2. Iterationノード
   - data:
       iterator_selector:
       - 'array_code_id'
       - search_list
       output_selector:  # 必須
       - 'llm_in_iteration_id'
       - text
       output_type: array[string]  # 必須
       start_node_id: 'iteration_node_idstart'  # 必須: {iteration_node_id}start
       type: iteration
     id: 'iteration_node_id'
   
   # 3. iteration-startノード
   - data:
       type: iteration-start
     id: 'iteration_node_idstart'  # 必須: {iteration_node_id}start
     parentId: 'iteration_node_id'  # 必須
     type: custom-iteration-start  # 必須
     draggable: false  # 必須
     selectable: false  # 必須
     zIndex: 1002  # 必須
   
   # 4. イテレーション内のノード（例: Toolノード）
   - data:
       type: tool
       isInIteration: true  # 必須
       iteration_id: 'iteration_node_id'  # 必須
     id: 'tool_in_iteration_id'
     parentId: 'iteration_node_id'  # 必須
     zIndex: 1002  # 必須
   
   # 5. イテレーション内のノード（例: LLMノード）- 最後のノード
   - data:
       type: llm
       isInIteration: true  # 必須
       iteration_id: 'iteration_node_id'  # 必須
     id: 'llm_in_iteration_id'
     parentId: 'iteration_node_id'  # 必須
     zIndex: 1002  # 必須
   
   # 6. エッジ（iteration-start → Tool）
   - data:
       isInIteration: true  # 必須
       iteration_id: 'iteration_node_id'  # 必須
       sourceType: iteration-start
       targetType: tool
     source: 'iteration_node_idstart'  # iteration-startノードのID
     target: 'tool_in_iteration_id'
     zIndex: 1002  # 必須
   
   # 7. エッジ（Tool → LLM）
   - data:
       isInIteration: true  # 必須
       iteration_id: 'iteration_node_id'  # 必須
       sourceType: tool
       targetType: llm
     source: 'tool_in_iteration_id'
     target: 'llm_in_iteration_id'
     zIndex: 1002  # 必須
   
   # 8. エッジ（Iteration → 次のノード）
   - data:
       isInIteration: false
       sourceType: iteration
       targetType: code
     source: 'iteration_node_id'
     target: 'next_node_id'
   ```

9. **ナレッジ検索ノード（Knowledge Retrieval）の生成**:
   
   **重要: クエリ変数の設定**
   
   **チャットフローモード (`advanced-chat`) の場合:**
   - `query_variable_selector`で`sys.query`を使用する（推奨）
   - 形式: `[start_node_id, sys.query]`
   - **Startノードに明示的な入力フィールドを設定する必要はない**（`sys.query`が自動的に利用可能）
   - Startノードの`variables`は空配列`[]`で可
   - 例: StartノードのIDが`'1736300000000'`の場合: `['1736300000000', 'sys.query']`
   
   **ワークフローモード (`workflow`) の場合:**
   - Startノードに明示的な入力フィールドを設定する必要がある
   - `query_variable_selector`でStartノードの変数名を参照する
   - 形式: `[start_node_id, variable_name]`
   - 例: StartノードのIDが`'1736300000000'`で、変数名が`query`の場合: `['1736300000000', 'query']`
   
   **ナレッジ検索ノードの生成例（advanced-chatモード、multipleモード、ウエイト設定）:**
   ```yaml
   # Startノード（advanced-chatモードでは入力フィールド不要）
   - data:
       desc: ユーザーからの質問を受け取ります
       selected: false
       title: 開始
       type: start
       variables: []  # 空配列（sys.queryが自動的に利用可能）
     height: 88
     id: 'start_node_id'
     position:
       x: 50
       y: 300
     positionAbsolute:
       x: 50
       y: 300
     selected: false
       sourcePosition: right
       targetPosition: left
     type: custom
     width: 244
   
   # Knowledge Retrievalノード
   - data:
       dataset_ids:
       - 'YOUR_DATASET_ID_HERE'  # 後でDifyの管理画面で設定してください
       desc: ナレッジベースから質問に関連する情報を検索・取得します
       multiple_retrieval_config:
         reranking_enable: true
         reranking_mode: weighted  # ウエイト設定を使用（推奨）
         top_k: 3
       query_variable_selector:
       - 'start_node_id'  # StartノードのID（必須）
       - sys.query  # sys.queryを使用（ユーザー入力のクエリ、必須）
       retrieval_mode: multiple
       selected: false
       title: ナレッジベース検索
       type: knowledge-retrieval
     height: 246
     id: 'knowledge_retrieval_node_id'
     position:
       x: 350
       y: 300
     positionAbsolute:
       x: 350
       y: 300
     selected: false
     sourcePosition: right
     targetPosition: left
     type: custom
     width: 244
   ```
   
   **重要なポイント:**
   - **チャットフローモード (`advanced-chat`) の場合:**
     - `query_variable_selector: [start_node_id, sys.query]`を使用する（推奨）
     - Startノードに`variables`を設定する必要はない（空配列`[]`で可）
     - `sys.query`が自動的にユーザー入力のクエリとして利用可能
   - **ワークフローモード (`workflow`) の場合:**
     - Startノードに明示的な入力フィールドを設定する必要がある
     - `query_variable_selector: [start_node_id, variable_name]`の形式で変数名を指定
   - `reranking_mode: weighted`を使用する場合（推奨）、`reranking_model`セクションは不要
   - `reranking_mode: reranking_model`を使用する場合、`reranking_model`セクションが必要:
     ```yaml
     reranking_mode: reranking_model
     reranking_model:
       model: netease-youdao/bce-reranker-base_v1
       provider: siliconflow
     ```
   - `retrieval_mode: single`の場合、`multiple_retrieval_config`セクションは不要
   - `retrieval_mode: multiple`の場合、`multiple_retrieval_config`セクションが必要

10. **モードに応じたノード構成**:
   - **チャットフローモード (`advanced-chat`)**: Answerノードを必ず含める（最後のノード）
   - **ワークフローモード (`workflow`)**: Answerノードは不要、最後のノードで処理を完了（Endノードは自動的に追加される）
   - **エージェントモード (`agent-chat`)**: `model_config`を使用、Answerノードは不要

10. **デフォルト値の設定**:
   - LLMモデル: `gpt-4o` / `openai`
   - Temperature: `0.7`
   - 環境変数は必ずsecretタイプで保存

10.5. **LLMノードの`context`セクション（必須）**:
   
   **重要: すべてのLLMノードに`context`セクションを設定する必要があります。**
   
   - **`context`を使用する場合**:
     ```yaml
     context:
       enabled: true
       variable_selector:
       - 'knowledge_retrieval_node_id'
       - result
     ```
   - **`context`を使用しない場合**:
     ```yaml
     context:
       enabled: false
       variable_selector: []
     ```
   
   **注意事項:**
   - `context`セクションが存在しないと、DSLのインポート時に「Application error: a client-side exception has occurred」エラーが発生する可能性がある
   - すべてのLLMノードに、必ず`context`セクションを設定すること
   - `context`を使用しない場合でも、`enabled: false`と`variable_selector: []`を設定すること

10.6. **LLMノードのプロンプトテンプレート（チャットフローモード）**:
   
   **重要: チャットフローモード (`advanced-chat`) でのユーザー入力の参照**
   
   - **ユーザープロンプトで`{{#sys.query#}}`を使用する（推奨）**
   - `sys.query`は自動的にユーザー入力のクエリとして利用可能
   - Startノードに明示的な入力フィールドを設定する必要はない
   
   **LLMノードの生成例（チャットフローモード、ナレッジ検索あり）:**
   ```yaml
   - data:
       context:
         enabled: true
         variable_selector:
         - 'knowledge_retrieval_node_id'
         - result
       desc: ナレッジベースから取得した情報を基に、質問に対する回答を生成します
       model:
         completion_params:
           temperature: 0.7
         mode: chat
         name: gpt-4o
         provider: openai
       prompt_template:
       - id: system_prompt
         role: system
         text: |
           あなたは、PDFドキュメントの内容を参照しながら質問に回答する専門アシスタントです。
           以下のルールに従って回答してください：
           
           1. ナレッジベースから取得した情報を基に、正確で分かりやすい回答を提供してください
           2. 参照したドキュメントの内容に基づいた情報のみを提供し、推測や憶測は避けてください
       - id: user_prompt
         role: user
         text: |
           以下の質問に対して、ナレッジベースから取得した情報を基に回答してください。
           
           【質問】
           {{#sys.query#}}
           
           【参考情報】
           {{#context#}}
       selected: false
       title: 回答生成
       type: llm
       variables: []
       vision:
         enabled: false
     height: 98
     id: 'llm_node_id'
     # ... position等の設定 ...
   ```
   
   **重要なポイント:**
   - **チャットフローモード (`advanced-chat`) の場合:**
     - ユーザープロンプトで`{{#sys.query#}}`を使用する（推奨）
     - `sys.query`は自動的にユーザー入力のクエリとして利用可能
     - Startノードに`variables`を設定する必要はない
   - **ワークフローモード (`workflow`) の場合:**
     - Startノードに設定した変数名を使用する（例: `{{#start_node_id.query#}}`）
   - `context`セクションは必須（ナレッジ検索を使用する場合: `enabled: true`、使用しない場合: `enabled: false`）

11. **HTTPリクエストノードのbody形式（JSON送信時）:**

   **❌ 誤った形式（JSONパースエラーが発生）:**
   ```yaml
   body:
     data:
     - key: text
       type: text
       value: 'メッセージ内容\n\n{{#llm_node.text#}}'
     type: json
   ```

   **✅ 正しい形式（Slack Webhook等のJSON形式を送信する場合）:**

   ```yaml
   body:
     type: json
     data:
     - id: 'body_data_1'
       key: ''
       type: text
       value: |
         {
           "text": "メッセージ内容\n\n{{#llm_node.text#}}"
         }
   ```

   **注意事項:**
   - `type: json`は`body`の直下に配置（`data`の後ではない）
   - `id`フィールドを必ず追加（例: `'body_data_1'`）
   - `key`フィールドは空文字列`''`にする
   - `value`フィールドにJSONオブジェクト全体を文字列として記述（YAMLの`|`記法を使用）
   - 変数参照はJSONオブジェクト内で使用可能
   - **シンプルなメッセージの場合: Codeノードは不要**。LLMノードから直接HTTPリクエストノードに接続する
   - この形式を使用しないと「Failed to parse JSON」エラーが発生する
   
   **重要: Markdown形式や特殊文字を含むメッセージの場合（400エラーを避けるため）**
   
   メッセージにMarkdown形式（`#`, `**`, `---`など）や改行が多く含まれる場合、変数展開時にJSONとして不正になる可能性があります。この場合、**CodeノードでJSONエスケープ処理を行う必要があります**。
   
   **動作確認済みの形式:**
   
   ```yaml
   # Codeノード（メッセージ生成とJSONエスケープ）
   - data:
       code: |
         import json
         from datetime import datetime
         
         def main(iteration_output: list) -> dict:
             # メッセージを生成
             message = f"# タイトル\n\n"
             message += f"**日時**: {datetime.now().strftime('%Y年%m月%d日 %H:%M:%S')}\n"
             message += "---\n\n"
             
             # 複数の結果をまとめる
             for i, result in enumerate(iteration_output, 1):
                 message += f"## {i}回目の結果\n\n"
                 if isinstance(result, dict):
                     text = result.get('text', str(result))
                 else:
                     text = str(result)
                 message += f"{text}\n\n"
                 message += "---\n\n"
             
             message += "以上です。"
             
             # JSONエスケープ処理（Slack Webhook用）
             # json.dumpsでエスケープし、外側のクォートを除去して返す
             escaped_message = json.dumps(message, ensure_ascii=False)
             # json.dumpsは文字列全体をクォートで囲むので、外側のクォートを除去
             if escaped_message.startswith('"') and escaped_message.endswith('"'):
                 escaped_message = escaped_message[1:-1]
             
             return {"formatted_message": escaped_message}
       code_language: python3
       outputs:
         formatted_message:
           children: null
           type: string
       type: code
     id: message_format_code_id
   
   # HTTP Requestノード（Slack通知）
   - data:
       body:
         type: json
         data:
         - id: 'body_data_1'
           key: ''
           type: text
           value: |
             {
               "text": "{{#message_format_code_id.formatted_message#}}"
             }
       type: http-request
       url: '{{#env.SLACK_WEBHOOK_URL#}}'
     id: slack_notification_id
   ```
   
   **重要なポイント:**
   - **Markdown形式や特殊文字を含むメッセージ**: CodeノードでJSONエスケープ処理を行う
   - **シンプルなメッセージ**: Codeノードなしで直接HTTPリクエストノードに接続可能
   - `json.dumps()`でエスケープし、外側のクォートを除去して返す
   - これにより、改行（`\n`）や特殊文字が正しく`\n`や`\"`などに変換され、JSONとして有効になる
   - **400エラーが発生する場合**: メッセージ内容を確認し、JSONエスケープ処理が必要か判断する

12. **ツール使用時の注意事項:**

   **利用方法の選択基準:**
   
   - **Agentノード経由を推奨する場合:**
     - 出力変数名が不明確なツール
     - 複数のツールを組み合わせる必要がある場合
     - エラーハンドリングを自動化したい場合
     - ツールの動作を柔軟に制御したい場合
   
   - **Toolノード経由を推奨する場合:**
     - 出力変数名が明確なツール（マニュアルに記載がある）
     - シンプルなツール呼び出し
     - 直接的な制御が必要な場合
   
   - **HTTP Request経由を推奨する場合:**
     - ToolノードやAgentノードで対応できない場合
     - カスタムAPIを使用する場合
     - 完全な制御が必要な場合
   
   **Toolノードの出力変数名:**
   
   Toolノードの出力変数名は、ツールによって異なる可能性がある。
   一般的な出力変数名:
   - `result`: 最も一般的
   - `output`: 結果を返すツール
   - `data`: データを返すツール
   - `text`: テキストを返すツール
   - ツール固有の変数名（マニュアルを確認）
   
   **出力変数名が不明な場合の対処:**
   1. まずAgentノード経由の使用を検討
   2. または、HTTP Request経由でAPIを直接呼び出し
   3. 実際の動作を確認してからToolノード経由に変更
   
   **環境変数の設定:**
   - APIキーが必要なツールの場合、`environment_variables`に追加
   - 環境変数名: `{ツール名}_API_KEY`（例: `TAVILY_API_KEY`, `OPENAI_API_KEY`）
   - `value_type: secret`で設定
   - `value: ''`（空文字列、ユーザーが後で設定）
   
   **dependenciesセクション（プラグイン使用時）:**
   - Agentノードや特定のToolノードを使用する場合、`dependencies`セクションを追加
   - 形式:
     ```yaml
     dependencies:
     - current_identifier: null
       type: marketplace
       value:
         marketplace_plugin_unique_identifier: langgenius/openai:0.2.8@...
         version: null
     ```
  - Agentノードを使用する場合、Agentプラグインを追加
  - **プラグインの識別子（`plugin_unique_identifier`）は、Dify環境でエージェントアプリをUI上で作成→DSLエクスポート→その`plugin_unique_identifier`をコピーして使用すること。このリポジトリでは`langgenius/agent:0.0.4@...`が動作確認済み（Dify 1.10以上）**

13. **Slack Webhook URL設定（外部API連携時）:**

ユーザーが選択した設定方法に応じて、以下のようにDSLを生成：

**Startノード方式を選択した場合:**

```yaml
# Startノードに追加
variables:
  - type: file
    variable: file
    # ... 既存のファイル入力設定
  - type: text-input
    label: Slack Webhook URL
    variable: webhook_url
    max_length: 500
    required: false

# HTTP Requestノード
url: '{{#start_node_id.webhook_url#}}'

# environment_variablesは追加しない
```

**環境変数方式を選択した場合:**

```yaml
# environment_variablesに追加
environment_variables:
  - description: 'Slack Webhook URL'
    id: slack_webhook_url_env
    name: SLACK_WEBHOOK_URL
    value: ''
    value_type: secret

# HTTP Requestノード
url: '{{#env.SLACK_WEBHOOK_URL#}}'

# Startノードには追加しない
```

#### 4.2 保存先

生成されたDSLファイルは以下のディレクトリに保存：

```
/Users/kawashimariku/Downloads/DIfy/DSL自動作成/dify-automation/DSL生成/{ファイル名}.yml
```

#### 4.3 生成後の対応

1. **成功メッセージ**:
   ```
   ✅ ワークフロー「{名前}」のDSLを生成しました！
   ファイル: DSL生成/{ファイル名}.yml
   ```

2. **追加の提案**:
   - 改善ポイント
   - 推奨設定
   - 関連するプラグイン

### フェーズ5: Difyへのアップロード（オプション）

DSLファイルが正常に生成された後、ユーザーにデプロイするかを確認します。

#### 5.1 デプロイ確認

DSL生成後、以下のように確認：

```
📤 このDSLファイルをDifyにデプロイしますか？

1. ✅ はい - 自動的にDifyにインポートします
2. ❌ いいえ - 手動でアップロードします

選択してください（1/2）:
```

**前提条件:**
- ブラウザ（Chromium）がデバッグモードで起動済み（`--remote-debugging-port=9222`）
- Difyにログイン済み（`http://localhost/apps` にアクセス可能な状態）

#### 5.2 自動インポート実行

ユーザーが「はい」を選択した場合、直接インポートを実行：

```
📤 DSLファイルを自動インポート中...

実行コマンド:
python tools/dify_connect_import.py DSL生成/{ファイル名}.yml

📂 既存のChromiumブラウザに接続中...
✅ ブラウザに接続しました
✅ インポートダイアログを開きました
📤 ファイルをアップロード中...
✅ ファイルをアップロードしました
🚀 「作成する」ボタンをクリック中...
✅ DSLファイルのインポートが完了しました！
📸 スクリーンショット保存: dify_import_{名前}_{タイムスタンプ}.png
```

#### 5.3 アップロード実行フロー

**シンプルフロー:**

```
[DSL生成完了]
    ↓
[デプロイ確認] → ユーザーが「はい」を選択
    ↓
[DSL自動インポート] → tools/dify_connect_import.py を実行
    ↓
[インポート完了] → スクリーンショット保存
```

**前提条件:**
- ブラウザは手動で起動済み（デバッグモード: `--remote-debugging-port=9222`）
- Difyにログイン済み

#### 5.5 デプロイ完了

アップロードが成功したら：

```
════════════════════════════════════════════════════════════
   ✨ Difyへのインポートが正常に完了しました！   
════════════════════════════════════════════════════════════

📊 完了情報:
  - アプリ名: {アプリケーション名}
  - ファイル: DSL生成/{ファイル名}.yml
  - スクリーンショット: dify_import_{名前}_{タイムスタンプ}.png

🎯 次のステップ:
  1. Difyの管理画面でワークフローを確認
     URL: http://localhost/apps
  
  2. 環境変数の設定（必要な場合）
     - APIキーなどの機密情報を設定
  
  3. テスト実行
     - サンプル入力でワークフローをテスト
     - 各ノードが正しく動作するか確認
  
  4. カスタマイズ
     - 必要に応じてプロンプトやパラメータを調整

📚 詳細情報:
  - DSL作成マニュアル: Dify_DSL作成マニュアル.md
  - ツール使用方法: tools/README.md
```

**ブラウザの終了:**
アップロード完了後、Chromiumブラウザは自動的には閉じません。
必要に応じて手動で閉じるか、次回のために開いたままにしておくことができます。

#### 5.6 エラーハンドリング

アップロードに失敗した場合：

```
❌ アップロードに失敗しました

【よくあるエラーと対処法】

1. 「Chromiumが起動していません」
   → ./tools/launch_browser.sh を実行してください

2. 「DSL ファイルをインポートボタンが見つかりません」
   → Difyのホームページ（/apps）にいることを確認
   → ブラウザでページが完全に読み込まれるまで待つ

3. 「接続エラー」
   → Chromiumが起動しているか確認:
     curl http://localhost:9222/json/version

4. 「依存パッケージがありません」
   → pip3 install -r tools/requirements_dsl_import.txt

【手動インポート】
自動アップロードができない場合、手動でインポートできます：
1. Difyの管理画面を開く: http://localhost/apps
2. 「DSL ファイルをインポート」ボタンをクリック
3. DSL生成/{ファイル名}.yml を選択
4. 「作成する」をクリック

エラーログ: error_{タイムスタンプ}.png に保存されました
```

#### 5.4 スキップした場合

ユーザーが「いいえ」を選択した場合：

```
⏭️  自動デプロイをスキップしました

手動でインポートする場合:
1. Difyの管理画面を開く
   http://localhost/apps

2. 「DSL ファイルをインポート」ボタンをクリック

3. 以下のファイルを選択:
   DSL生成/{ファイル名}.yml

4. 「作成する」をクリック

または、後で自動デプロイする場合:
1. ブラウザをデバッグモードで起動（既に起動済みの場合は不要）
2. Difyにログイン（既にログイン済みの場合は不要）
3. python tools/dify_connect_import.py DSL生成/{ファイル名}.yml
```

---

## ヒアリングのベストプラクティス

### 段階的なヒアリング

一度にすべてを聞かず、段階的に詳細を確認：

1. **概要把握** → 2. **主要処理確認** → 3. **詳細設定** → 4. **最終確認**

### 具体例の提示

ユーザーが不明な場合は、具体例を提示：

```
例えば、こういった処理はいかがですか？
- ファイルをアップロードして要約
- Web検索して情報を整理
- データベースから情報取得してチャート生成
```

### 推奨設定の提案

ユーザーが特に指定しない場合の推奨値：

- **LLMモデル**: gpt-4o（バランスが良い）
- **Temperature**: 0.7（創造性と一貫性のバランス）
- **ファイルサイズ制限**: 15MB
- **リトライ回数**: 3回
- **タイムアウト**: 300秒

### プラグイン推奨

ユースケースに応じたプラグインの提案：

- **データ分析**: hjlarry/database + langgenius/echarts
- **文書処理**: langgenius/mineru + LLM
- **Web情報収集**: Tavily + LLM
- **音声対応**: audio (TTS/ASR)
- **時間ベース**: time

---

## エラーハンドリング

### 不足情報の確認

必須情報が不足している場合は再度確認：

```
以下の情報が必要です：
- [ ] アプリケーション名
- [ ] 入力形式
- [ ] 主要な処理内容
- [ ] 出力形式
```

### 矛盾の指摘

設定に矛盾がある場合は指摘：

```
⚠️ 注意: 
agent-chatモードではワークフローノードは使用できません。
advanced-chatモードに変更するか、エージェント設定を見直してください。
```

### 代替案の提示

実現不可能な要求には代替案を提示：

```
その機能は直接サポートされていませんが、
以下の方法で実現できます：
1. Codeノードでカスタム処理
2. HTTPリクエストで外部API利用
3. プラグインの使用
```

---

## 対話例

### 例1: シンプルな質問応答

**ユーザー**: 「簡単な質問応答ボットを作りたい」

**システム**: 
```
質問応答ボットを作成します！いくつか確認させてください。

【基本情報】
1. アプリケーション名は何にしますか？
2. どのような質問に答えるボットですか？（例: カスタマーサポート、技術Q&A等）

【入力・出力】
3. ユーザーからの入力は自由なテキストでよろしいですか？
4. 会話履歴を保持しますか？

【AI設定】
5. 使用するAIモデルは？（推奨: gpt-4o）
6. ボットの性格や応答スタイルは？（システムプロンプト）
```

### 例2: ファイル処理ワークフロー

**ユーザー**: 「PDFをアップロードして要約してほしい」

**システム**:
```
PDF要約ワークフローを作成します！

【基本設定】
1. アプリケーション名: 「PDF要約システム」でよろしいですか？

【ファイル設定】
2. 対応ファイル形式: PDFのみでよろしいですか？
3. ファイルサイズ制限: 50MBでよろしいですか？
4. 複数ファイルの同時アップロードは必要ですか？

【処理設定】
5. 要約の長さ: 短い/中程度/詳細
6. 要約のスタイル: 箇条書き/段落形式

【追加機能】
7. PDF内の画像も解析しますか？（ビジョン機能）
8. 表やグラフの情報も抽出しますか？
```

### 例3: データベース連携ワークフロー

**ユーザー**: 「データベースから情報を取得してグラフ化したい」

**システム**:
```
データベース連携ワークフローを作成します！

【データベース設定】
1. データベースの種類: MySQL/PostgreSQL/その他
2. 接続情報は環境変数で設定しますか？
3. 実行するSQLクエリは固定ですか？それともユーザー入力ですか？

【データ処理】
4. どのようなグラフを生成しますか？
   - 棒グラフ
   - 折れ線グラフ
   - 円グラフ
   - その他

【出力設定】
5. グラフのタイトルや軸ラベルは？
6. データの集計方法は？

【プラグイン】
このワークフローには以下のプラグインが必要です：
- hjlarry/database (SQL実行)
- langgenius/echarts (チャート生成)
```

### 例4: スケジュールトリガーを使用したワークフロー

**ユーザー**: 「毎時0分にSlackにメッセージを送信したい」

**システム**:
```
定期的なSlack通知ワークフローを作成します！

【基本設定】
1. アプリケーション名: 「毎時0分のSlack通知」でよろしいですか？
2. アプリケーションモード: ワークフローモード (`workflow`) でよろしいですか？

【開始方法】
3. 開始方法を選択してください：
   1. Startノード（手動実行または外部スケジューラー）
   2. スケジュールトリガー（自動実行、推奨）
   3. Webhookトリガー（外部システムからの呼び出し）

【Webhook設定】（Webhookトリガーを選択した場合）
4. HTTPメソッド: POSTでよろしいですか？
   - 選択肢: GET, POST, PUT, DELETE, PATCH
5. コンテンツタイプ: application/jsonでよろしいですか？
   - 選択肢: application/json, application/x-www-form-urlencoded, multipart/form-data, text/plain
6. リクエストから抽出するパラメータはありますか？
   - Query Parameters（URLクエリパラメータ）: 例: user_id, source
   - Header Parameters（リクエストヘッダー）: 例: authorization, content-type
   - Request Body Parameters（リクエストボディ）: 例: message, customer_name, items
7. レスポンス設定: デフォルト（200 OK）でよろしいですか？
   - カスタムレスポンスが必要な場合: ステータスコードとレスポンスボディを指定

【スケジュール設定】（スケジュールトリガーを選択した場合）
4. 実行頻度を選択してください：
   1. 毎時 (`hourly`) - 指定した分に毎時実行
   2. 毎日 (`daily`) - 指定した時刻に毎日実行
   3. 毎週 (`weekly`) - 指定した曜日と時刻に毎週実行
   4. 毎月 (`monthly`) - 指定した日と時刻に毎月実行
   
   どれにしますか？（1/2/3/4）

5. 実行時刻の詳細設定（選択した頻度に応じて確認）：
   
   **毎時を選択した場合:**
   - 実行する分を指定してください（0-59）
   - 例: 0（毎時0分）、30（毎時30分）、37（毎時37分）
   - どれにしますか？
   
   **毎日を選択した場合:**
   - 実行時刻を個別に指定してください：
     1. 何時ですか？（1-12）
     2. 何分ですか？（0-59）
     3. AM または PM どちらですか？
   - 例: 9時、0分、AM → 9:00 AM（毎日9:00）
   - 例: 5時、15分、PM → 5:15 PM（毎日17:15）
   - 例: 12時、0分、PM → 12:00 PM（毎日12:00）
   
   **毎週を選択した場合:**
   - 実行時刻を個別に指定してください：
     1. 何時ですか？（1-12）
     2. 何分ですか？（0-59）
     3. AM または PM どちらですか？
   - 実行する曜日を選択してください（複数選択可）:
     1. 日曜 (`sun`)
     2. 月曜 (`mon`)
     3. 火曜 (`tue`)
     4. 水曜 (`wed`)
     5. 木曜 (`thu`)
     6. 金曜 (`fri`)
     7. 土曜 (`sat`)
   - 例: 9時、0分、AM、月・水・金 → 毎週月・水・金の9:00 AM
   - 例: 5時、15分、PM、日曜 → 毎週日曜の5:15 PM
   
   **毎月を選択した場合:**
   - 実行時刻を個別に指定してください：
     1. 何時ですか？（1-12）
     2. 何分ですか？（0-59）
     3. AM または PM どちらですか？
   - 実行する日を指定してください（複数選択可）：
     - 日付（1-31）: 例: 1（毎月1日）、15（毎月15日）
     - 月末設定: 月末を指定する場合は「月末」と入力
   - 例: 9時、0分、AM、1日 → 毎月1日の9:00 AM
   - 例: 12時、0分、PM、1日と15日と30日 → 毎月1日、15日、30日の12:00 PM
   - 例: 9時、0分、AM、月末 → 毎月末日の9:00 AM

6. タイムゾーン: Asia/Tokyoでよろしいですか？

【Slack設定】
6. Slack Webhook URLの設定方法:
   1. 環境変数で事前設定（セキュア、推奨）
   2. Startノードに入力欄を追加

【メッセージ設定】
7. 送信するメッセージ: 「シーオンです」でよろしいですか？
8. 日時を含めますか？
```

---

## 品質チェックリスト

DSL生成前に以下を確認：

### 構造チェック
- [ ] `app`セクションが正しく定義されている
- [ ] `kind: app`が設定されている
- [ ] `version`が指定されている
- [ ] モードに応じた`workflow`または`model_config`が存在

### ノードチェック
- [ ] すべてのノードに一意のIDがある
- [ ] 開始ノード/トリガーノードが存在
  - [ ] Startノードが存在（通常の開始の場合）
  - [ ] スケジュールトリガーが存在（スケジュール実行の場合）
  - [ ] Webhookトリガーが存在（Webhook実行の場合）
- [ ] チャットフローモード (`advanced-chat`) の場合: Answerノードが存在
- [ ] ワークフローモード (`workflow`) の場合: Answerノードは不要、Endノードで終了
- [ ] ノードタイプが正しい
- [ ] LLMノードを使用する場合:
  - [ ] **すべてのLLMノードに`context`セクションが設定されている（必須）**
    - [ ] `context`を使用する場合: `enabled: true`, `variable_selector: [ノードID, 変数名]`が設定されている
    - [ ] `context`を使用しない場合: `enabled: false`, `variable_selector: []`が設定されている
    - [ ] `context`セクションが存在しないと、DSLのインポート時に「Application error: a client-side exception has occurred」エラーが発生する可能性がある
  - [ ] **プロンプトテンプレートでのユーザー入力の参照:**
    - [ ] **チャットフローモード (`advanced-chat`) の場合:**
      - [ ] ユーザープロンプトで`{{#sys.query#}}`を使用している（推奨）
      - [ ] Startノードに`variables`を設定していない、または空配列`[]`にしている
    - [ ] **ワークフローモード (`workflow`) の場合:**
      - [ ] Startノードに設定した変数名を使用している（例: `{{#start_node_id.query#}}`）
- [ ] ナレッジ検索ノード（Knowledge Retrieval）を使用する場合:
  - [ ] **`query_variable_selector`が正しく設定されている（必須）**
    - [ ] **チャットフローモード (`advanced-chat`) の場合:**
      - [ ] `query_variable_selector: [start_node_id, sys.query]`を使用している（推奨）
      - [ ] Startノードに`variables`を設定していない、または空配列`[]`にしている（`sys.query`が自動的に利用可能）
    - [ ] **ワークフローモード (`workflow`) の場合:**
      - [ ] Startノードに明示的な入力フィールドを設定している
      - [ ] `query_variable_selector: [start_node_id, variable_name]`の形式で変数名を指定している（例: `['start_node_id', 'query']`）
      - [ ] Startノードの変数名が、ユーザー入力の変数名と一致している（例: `query`, `question`, `input`など）
  - [ ] `dataset_ids`が設定されている（後でDifyの管理画面で設定する場合はプレースホルダーでも可）
  - [ ] `retrieval_mode`が設定されている（`single`または`multiple`）
  - [ ] `retrieval_mode: multiple`の場合:
    - [ ] `multiple_retrieval_config`セクションが存在する
    - [ ] `reranking_enable`が設定されている（`true`または`false`）
    - [ ] `reranking_enable: true`の場合:
      - [ ] `reranking_mode`が設定されている（`weighted`または`reranking_model`）
      - [ ] `reranking_mode: weighted`の場合、`reranking_model`セクションは不要
      - [ ] `reranking_mode: reranking_model`の場合、`reranking_model`セクションが必要（`model`と`provider`を指定）
    - [ ] `top_k`が設定されている（数値）

### 条件分岐（If-Else）チェック
- [ ] If-Elseノードを使用する場合:
  - [ ] `cases[].case_id` が一意である（例: `'true'`, `'false'`, `'summary'` など）
  - [ ] 各 `case_id` に対して遷移先が明確になっている（FlowSpecで確定済み）
  - [ ] 条件の `comparison_operator` / `varType` / `variable_selector` が妥当
    - [ ] **文字列（`varType: string`）の完全一致は `comparison_operator: is` を推奨**（`=` は数値比較で使われることがあるため、環境によって型エラー原因になりうる）
    - [ ] **`comparison_operator`はUnicode文字を使用**（`>=`ではなく`≥`、`<=`ではなく`≤`、`!=`ではなく`≠`）
    - [ ] **使用可能な演算子一覧**:
      - 文字列比較: `'contains'`, `'not contains'`, `'start with'`, `'end with'`, `'is'`, `'is not'`, `'empty'`, `'not empty'`
      - 数値比較: `'='`, `'≠'`, `'>'`, `'<'`, `'≥'`, `'≤'`
      - 配列/リスト: `'in'`, `'not in'`, `'all of'`
      - 存在チェック: `'null'`, `'not null'`, `'exists'`, `'not exists'`
  - [ ] **「else相当」の分岐（条件に一致しない場合）**:
    - [ ] `cases`で定義されたconditionに一致しない場合、デフォルトで`sourceHandle: 'false'`から出力される
    - [ ] **エッジのsourceHandleは必ず`'false'`を使用**（`'fail'`や`'else'`ではない）
    - [ ] 例: `sourceHandle: 'false'`（正）、`sourceHandle: 'fail'`（誤）
    - [ ] `cases`にelse用のcase_idを追加する必要はない（Difyが自動的に`'false'`ハンドルを提供）
- [ ] トリガーノードの設定が正しい
  - [ ] スケジュールトリガーの場合:
    - [ ] `type: trigger-schedule`（`schedule-trigger`ではない）
    - [ ] `mode: visual` が設定されている（デフォルト、必須）
    - [ ] **`frequency` が`config`セクションに設定されている（必須、デフォルト値として`daily`を設定）**
    - [ ] **`frequency` がトップレベルにも設定されている（必須、実際の実行頻度: hourly, daily, weekly, monthly）**
    - [ ] `frequency` の値が正しい（hourly, daily, weekly, monthlyのいずれか）
    - [ ] **`timezone`の設定が正しい**:
      - [ ] `config`セクション内は`UTC`（固定）
      - [ ] トップレベルは実際に使用するタイムゾーン（例: `Asia/Tokyo`）
    - [ ] `visual_config` セクションが存在する（必須）
      - [ ] `config`セクションとトップレベルの両方に設定されている
      - [ ] **`config`セクション内の`visual_config`はデフォルト値**（実際の設定とは関係ない）
      - [ ] **トップレベルの`visual_config`が実際の設定**:
        - [ ] `monthly_days`: 毎月の場合のみ使用（例: `[1, 15, 30]`）、使用しない場合は空配列`[]`
        - [ ] `on_minute`: 毎時の場合は`0-59`の数値、毎日/毎週/毎月の場合は`0`（数値、`time`フィールドで時刻を指定するため）
        - [ ] `time`: 毎日/毎週/毎月の場合に使用（例: `'12:00 PM'`, `'4:31 PM'`）、毎時の場合は使用しない
        - [ ] `weekdays`: 毎週の場合のみ使用（例: `['mon', 'wed', 'fri']`）、使用しない場合は空配列`[]`
    - [ ] `height: 130`が設定されている（推奨、128ではない）
    - [ ] `position`と`positionAbsolute`が設定されている（ノードの位置情報）
    - [ ] `selected: false`または`true`が設定されている
    - [ ] `id`がタイムスタンプベースの文字列形式（例: `'20251225171043'`）
    - [ ] `cron_expression` が存在しない（ビジュアル設定を使用するため）
    - [ ] `sourcePosition: right` と `targetPosition: left` が設定されている
  - [ ] Webhookトリガーの場合:
    - [ ] `type: trigger-webhook`（`webhook-trigger`ではない）
    - [ ] **`async_mode: true`が設定されている（必須）**
    - [ ] **`method`が設定されている（必須、大文字）** - `GET`, `POST`, `PUT`, `DELETE`, `PATCH`のいずれか
    - [ ] **`content_type`が設定されている（必須）** - `application/json`, `application/x-www-form-urlencoded`, `multipart/form-data`, `text/plain`のいずれか
    - [ ] **`body: []`が設定されている（必須、空配列でも可）**
    - [ ] **`headers: []`が設定されている（必須、空配列でも可）**
    - [ ] **`params: []`でパラメータを定義**（`body_parameters`ではなく`params`を使用）
    - [ ] **`variables:`セクションで`_webhook_raw`とパラメータを定義**（`params`で定義したパラメータ名と同じ変数名を`variables`にも追加）
    - [ ] **`value_selector`の設定**:
      - `_webhook_raw`の`value_selector: []`（空配列）
      - パラメータの`value_selector: [_webhook_raw, body, パラメータ名]`（ただし動作しない場合がある）
    - [ ] **Codeノードを使用したパラメータ抽出（推奨）**:
      - Webhookトリガーと次のノード（LLM等）の間にCodeノードを追加
      - Codeノードで`_webhook_raw.body.パラメータ名`から値を抽出
      - Codeノードの出力を次のノードで参照
    - [ ] **`response_body: ''`と`status_code: 200`が設定されている**
    - [ ] **`webhook_url`と`webhook_debug_url`が空文字列**（Difyが自動生成）
    - [ ] **`config:`セクションを使用していない**（動作しない形式のため）
    - [ ] `sourcePosition: right` と `targetPosition: left` が設定されている
    - [ ] `height: 130`が設定されている（推奨）

### エッジチェック
- [ ] すべてのノードが適切に接続されている
- [ ] 孤立したノードがない
- [ ] 循環参照がない（意図的でない限り）
- [ ] エッジに `isInLoop: false` が設定されている（ループ内でない場合）
- [ ] `sourceType` と `targetType` が正しい（例: スケジュールトリガーの場合 `trigger-schedule`、Webhookトリガーの場合 `trigger-webhook`）
- [ ] If-Elseノードを使用する場合:
  - [ ] **条件に一致するケース（true相当）**: `sourceHandle`が`cases[].case_id`と一致している（例: `sourceHandle: 'pass'`）
  - [ ] **条件に一致しないケース（else/false相当）**: `sourceHandle: 'false'`を使用（**`'fail'`や`'else'`は不可**）
  - [ ] 少なくとも「真/偽」または必要な全ケースが配線されている（未配線ケースがない）
  - [ ] エッジIDも正しく命名されている（例: `1736300010000-pass-...`、`1736300010000-false-...`）
- [ ] Iterationノードを使用する場合:
  - [ ] Iterationノードからiteration-startノードへのエッジが存在しない（iteration-startはIterationノードの子ノードとして自動的に接続される）
  - [ ] イテレーション内のエッジに `isInIteration: true` が設定されている
  - [ ] イテレーション内のエッジに `iteration_id` が設定されている（IterationノードのID）
  - [ ] イテレーション内のエッジに `zIndex: 1002` が設定されている
  - [ ] iteration-startからのエッジの`source`が`{iteration_node_id}start`の形式になっている
  - [ ] イテレーション内の最後のノードからIterationノードへのエッジが存在しない（自動的に接続される）

### Loopノードチェック（使用する場合）
- [ ] Loopノードを使用する場合:
  - [ ] ループ内エッジ/ノードに `isInLoop: true`（ループ外は `false`）が一貫して設定されている
  - [ ] loop-start / loop-end の接続が正しい（ループ開始点と終了点が明示されている）

### Iterationノードチェック
- [ ] Iterationノードが使用されている場合:
  - [ ] **`output_selector`が設定されている**（イテレーション内の最後のノードIDと出力変数名）
  - [ ] **`output_type`が設定されている**（array[string], array[object], array[number]等）
  - [ ] **`start_node_id`が`{iteration_node_id}start`の形式**（例: `1733226413055start`）
  - [ ] `iterator_selector`が正しく設定されている（配列を出力するノードIDと出力変数名）
  - [ ] `error_handle_mode`が設定されている（推奨: `remove-abnormal-output`）
  - [ ] `is_parallel`が設定されている（true/false）
  - [ ] `is_parallel: true`の場合、`parallel_nums`が設定されている
  - [ ] iteration-startノードが存在する:
    - [ ] `id`が`{iteration_node_id}start`の形式
    - [ ] `parentId`がIterationノードのID
    - [ ] `type: custom-iteration-start`
    - [ ] `draggable: false`
    - [ ] `selectable: false`
    - [ ] `zIndex: 1002`
    - [ ] `isInIteration: true`
  - [ ] イテレーション内のすべてのノードに以下が設定されている:
    - [ ] `parentId`がIterationノードのID
    - [ ] `isInIteration: true`（dataセクション内）
    - [ ] `iteration_id`がIterationノードのID（dataセクション内）
    - [ ] `zIndex: 1002`
  - [ ] iteration-endノードが存在しない（最後のノードが自動的にiteration-endとして機能）
  - [ ] Iterationノードの出力が`{{#iteration_node_id.output#}}`で正しく参照されている
  - [ ] **イテレーション内でのノードタイプ選択**:
    - [ ] **Agentノードはイテレーション内で使用しない（非推奨）** - 動作が不安定になる可能性がある
    - [ ] **イテレーション内ではToolノードを使用する（推奨）** - 安定した動作が期待できる
    - [ ] AgentノードからToolノードへの変更時は、エッジの`sourceType`/`targetType`も`agent`から`tool`に変更する

### 変数チェック
- [ ] 変数参照の記法が正しい（`{{#ID.変数#}}`）
- [ ] 参照先のノードと変数が存在する
- [ ] 環境変数が適切に定義されている

### プラグインチェック
- [ ] 必要なプラグインが`dependencies`に追加されている
- [ ] プラグインの識別子が正しい
- [ ] ツールパラメータが適切に設定されている

### 環境変数チェック（外部API連携時）
- [ ] 外部API（Slack Webhook、HTTP Request等）を使用する場合、環境変数が`environment_variables`に定義されている（環境変数方式を選択した場合）
- [ ] または、StartノードにURL入力欄が追加されている（Startノード方式を選択した場合）
- [ ] HTTP Requestノードで環境変数またはStartノードの入力値が正しく参照されている
- [ ] DSL生成後に、ユーザーに環境変数の設定方法を案内するメッセージを含める（環境変数方式の場合）

### HTTPリクエストノードのbody形式チェック（JSON送信時）
- [ ] JSON形式を送信する場合、`body.type: json`が`body`の直下に配置されている（`data`の後ではない）
- [ ] `body.data`配列の各要素に`id`フィールドが追加されている（例: `'body_data_1'`）
- [ ] `body.data`配列の各要素の`key`フィールドが空文字列`''`になっている
- [ ] `body.data`配列の各要素の`value`フィールドにJSONオブジェクト全体が文字列として記述されている（YAMLの`|`記法を使用）
- [ ] **メッセージの内容を確認**:
  - [ ] **シンプルなメッセージの場合**: Codeノードを使用していない（LLMノードから直接HTTPリクエストノードに接続）
  - [ ] **Markdown形式や特殊文字を含むメッセージの場合**: CodeノードでJSONエスケープ処理を行っている（`json.dumps()`でエスケープし、外側のクォートを除去）
- [ ] 変数参照（`{{#ノードID.出力変数名#}}`）がJSONオブジェクト内で正しく使用されている
- [ ] **400エラーが発生する場合**: メッセージ内容を確認し、JSONエスケープ処理が必要か判断している

### ツール使用時のチェック
- [ ] ツールの利用方法が適切に選択されている（Agent/Tool/HTTP Request）
  - [ ] **重要: イテレーション内ではToolノードを使用する（Agentノードは非推奨）**
  - [ ] Agentノード経由の場合（イテレーション外のみ推奨）:
    - [ ] `agent_parameters`セクションが設定されている（動作確認済みの構造）
      - [ ] `agent_parameters.instruction`が設定されている（`type: constant`, `value: "..."`）
      - [ ] `agent_parameters.model`が設定されている（`type: constant`, `value: {...}`、`provider: langgenius/openai/openai`）
      - [ ] `agent_parameters.query`が設定されている（`type: constant`, `value: "{{#...}}"`、入力変数を参照する場合）
      - [ ] `agent_parameters.tools`が設定されている（`type: constant`, `value: [...]`、詳細なツール設定を含む）
    - [ ] トップレベルの`instruction`は任意（互換用、Dify 1.10以上では`agent_parameters`のみで動作する）
    - [ ] トップレベルの`model`、`strategy`、`max_iteration`は任意（互換用、Dify 1.10以上では`agent_parameters`のみで動作する）
    - [ ] `strategy`は`function_call`に設定されている（トップレベルに設定する場合）
    - [ ] `agent_strategy_label`と`agent_strategy_name`は`FunctionCalling`と`function_calling`を使用（Dify 1.10以上での動作確認済み）
    - [ ] `tools`配列にツールが追加されている（`provider_type: builtin`を含む、シンプルな形式、任意のツールを0個以上追加可能）
    - [ ] トップレベルの`model.provider`は`openai`を使用している（トップレベルに設定する場合、`agent_parameters.model.value.provider`は`langgenius/openai/openai`）
    - [ ] 必須設定:
      - [ ] `agent_strategy_provider_name`が設定されている（`langgenius/agent/agent`）
      - [ ] `plugin_unique_identifier`が設定されている（**重要: 実際の値は、Dify環境でエージェントアプリをUI上で作成→DSLエクスポート→その`plugin_unique_identifier`をコピーして使用すること。このリポジトリでは`langgenius/agent:0.0.4@...`が動作確認済み**）
      - [ ] `output_schema`が設定されている（`null`を推奨、Dify 1.10以上での動作確認済み）
    - [ ] `dependencies`セクションにAgentプラグインが追加されている（必要な場合）
  - [ ] **Toolノード経由の場合（推奨、特にイテレーション内）**:
    - [ ] `provider_id`、`provider_name`、`provider_type: builtin`が設定されている
    - [ ] `tool_name`が正しく設定されている（例: `tavily_search`）
    - [ ] `tool_label`が設定されている
    - [ ] `tool_configurations`で固定パラメータを設定（例: `max_results`, `search_depth`）
    - [ ] `tool_parameters`で動的パラメータを設定（`type: mixed`で変数参照可能）
    - [ ] 出力変数名は通常`text`（ツールによって異なる場合あり）
    - [ ] **Toolノードの推奨設定例（Tavily Search）**:
      ```yaml
      - data:
          provider_id: tavily
          provider_name: tavily
          provider_type: builtin
          tool_name: tavily_search
          tool_label: TavilySearch
          tool_configurations:
            max_results: 5
            search_depth: basic
            include_answer: 0
            include_images: 0
            include_raw_content: 0
          tool_parameters:
            query:
              type: mixed
              value: '{{#start_node_id.input#}}'
          type: tool
      ```
- [ ] HTTP Request経由の場合、APIキーが環境変数として設定されている
- [ ] 環境変数が適切に設定されている（必要な場合）
- [ ] ツールパラメータが適切に設定されている
- [ ] ツールの出力が次のノードで正しく参照されている
- [ ] `version`が`0.1.x`（推奨: `0.1.5`）に設定されている（`DSL/`配下の実エクスポート形式と整合している）

---

## 拡張機能

### テンプレートライブラリ

よく使われるパターンのテンプレート：

1. **シンプルQ&A**: Start → LLM → Answer
2. **RAG検索**: Start → Knowledge Retrieval → LLM → Answer
3. **ファイル処理**: Start → Document Extractor → LLM → Answer
4. **条件分岐**: Start → If-Else → [複数のLLM] → Answer
5. **API連携**: Start → HTTP Request → Code → Answer
6. **データ分析**: Start → Database → Code → Chart → Answer

### カスタマイズオプション

ユーザーの好みに応じて：

- **日本語優先**: 日本語対応モデルとツールを推奨
- **コスト最適化**: より安価なモデルを推奨
- **速度重視**: 高速なモデルとキャッシュを推奨
- **精度重視**: 高性能モデルとリランキングを推奨

---

## 外部API連携時の注意事項

**Slack Webhookを使用する場合:**

1. **設定方法の選択（ヒアリング時に確認）:**

   Slack Webhook URLの設定方法をユーザーに確認：

   ```
   Slack Webhook URLの設定方法を選択してください：
   
   1. Startノードに入力欄を追加（実行時にURLを入力）
   2. 環境変数で事前設定（セキュア）
   
   どちらにしますか？（1/2）
   ```

2. **DSL生成ロジック:**

   **選択1（Startノードに入力欄）の場合:**
   - Startノードの`variables`に`text-input`タイプのフィールドを追加
   - `label: Slack Webhook URL`
   - `variable: webhook_url`
   - `required: false`（オプションとして扱う）
   - HTTP RequestノードのURL: `{{#start_node_id.webhook_url#}}`
   - `environment_variables`には追加しない

   **選択2（環境変数）の場合:**
   - `environment_variables`に`SLACK_WEBHOOK_URL`を追加
   - `value_type: secret`
   - `value: ''`（空文字列、ユーザーが後で設定）
   - HTTP RequestノードのURL: `{{#env.SLACK_WEBHOOK_URL#}}`
   - Startノードには追加しない
   - DSL生成後の案内メッセージで環境変数設定を説明

3. **HTTPリクエストノードのbody形式（重要）:**

   **❌ 誤った形式（JSONパースエラーが発生）:**
   ```yaml
   body:
     data:
     - key: text
       type: text
       value: 'メッセージ内容\n\n{{#llm_node.text#}}'
     type: json
   ```

   **✅ 正しい形式（Slack Webhook等のJSON形式を送信する場合）:**
   ```yaml
   body:
     type: json
     data:
     - id: 'body_data_1'
       key: ''
       type: text
       value: |
         {
           "text": "メッセージ内容\n\n{{#llm_node.text#}}"
         }
   ```

   **重要なポイント:**
   - `type: json`は`body`の直下に配置する
   - `id`フィールドを追加する（例: `'body_data_1'`）
   - `key`フィールドは空文字列`''`にする
   - `value`フィールドにJSONオブジェクト全体を文字列として記述（YAMLの`|`記法を使用）
   - 変数参照（`{{#ノードID.出力変数名#}}`）はJSONオブジェクト内で使用可能
   - **シンプルなメッセージの場合: Codeノードは不要**。LLMノードから直接HTTPリクエストノードに接続する
   
   **重要: Markdown形式や特殊文字を含むメッセージの場合（400エラーを避けるため）**
   
   メッセージにMarkdown形式（`#`, `**`, `---`など）や改行が多く含まれる場合、変数展開時にJSONとして不正になる可能性があります。この場合、**CodeノードでJSONエスケープ処理を行う必要があります**。
   
   **動作確認済みの形式（CodeノードでJSONエスケープ）:**
   
   ```yaml
   # Codeノード（メッセージ生成とJSONエスケープ）
   - data:
       code: |
         import json
         from datetime import datetime
         
         def main(input_data: any) -> dict:
             # メッセージを生成（Markdown形式、改行を含む）
             message = f"# タイトル\n\n"
             message += f"**日時**: {datetime.now().strftime('%Y年%m月%d日 %H:%M:%S')}\n"
             message += "---\n\n"
             message += f"{input_data}\n\n"
             message += "以上です。"
             
             # JSONエスケープ処理（Slack Webhook用）
             # json.dumpsでエスケープし、外側のクォートを除去して返す
             escaped_message = json.dumps(message, ensure_ascii=False)
             # json.dumpsは文字列全体をクォートで囲むので、外側のクォートを除去
             if escaped_message.startswith('"') and escaped_message.endswith('"'):
                 escaped_message = escaped_message[1:-1]
             
             return {"formatted_message": escaped_message}
       code_language: python3
       outputs:
         formatted_message:
           children: null
           type: string
       type: code
     id: message_format_code_id
   
   # HTTP Requestノード（Slack通知）
   - data:
       body:
         type: json
         data:
         - id: 'body_data_1'
           key: ''
           type: text
           value: |
             {
               "text": "{{#message_format_code_id.formatted_message#}}"
             }
       type: http-request
       url: '{{#env.SLACK_WEBHOOK_URL#}}'
     id: slack_notification_id
   ```
   
   **重要なポイント:**
   - **Markdown形式や特殊文字を含むメッセージ**: CodeノードでJSONエスケープ処理を行う
   - **シンプルなメッセージ**: Codeノードなしで直接HTTPリクエストノードに接続可能
   - `json.dumps()`でエスケープし、外側のクォートを除去して返す
   - これにより、改行（`\n`）や特殊文字が正しく`\n`や`\"`などに変換され、JSONとして有効になる
   - **400エラーが発生する場合**: メッセージ内容を確認し、JSONエスケープ処理が必要か判断する

3. **フロー確認フェーズでの確認:**
   - 選択した設定方法をフロー図に明記
   - 環境変数の場合は、設定方法を案内

**ツール（Tool/Agent/HTTP Request）を使用する場合:**

1. **利用方法の選択（ヒアリング時に確認）:**

   ツールを使用する場合、利用方法をユーザーに確認：

   ```
   ツールの利用方法を選択してください：
   
   1. Toolノード経由（推奨、特にイテレーション内）- ワークフロー内で直接ツールを実行
   2. Agentノード経由 - エージェントが自動的にツールを実行（イテレーション外のみ推奨）
   3. HTTP Request経由 - ツールのAPIを直接呼び出し
   
   どちらにしますか？（1/2/3）
   ```
   
   **重要: イテレーション内でのツール使用について**
   - **イテレーション内ではToolノードを使用する（推奨）** - 安定した動作が期待できる
   - **Agentノードはイテレーション内で使用しない（非推奨）** - 動作が不安定になる可能性がある
   - Agentノードは複雑な判断や複数ツールの組み合わせが必要な場合（イテレーション外）に使用

2. **DSL生成ロジック:**

   **選択1（Toolノード経由 - 推奨）の場合:**
   
   **動作確認済みのToolノード構造（Tavily Search）:**
   ```yaml
   - data:
       desc: '検索を実行'
       provider_id: tavily
       provider_name: tavily
       provider_type: builtin
       tool_name: tavily_search
       tool_label: TavilySearch
       tool_configurations:
         exclude_domains: null
         include_answer: 0
         include_domains: null
         include_images: 0
         include_raw_content: 0
         max_results: 5
         search_depth: basic
       tool_parameters:
         query:
           type: mixed
           value: '{{#start_node_id.input#}} {{#iteration_node_id.item#}}'
       type: tool
     height: 246
     id: 'tool_node_id'
     # イテレーション内の場合は以下を追加
     # parentId: 'iteration_node_id'
     # isInIteration: true
     # iteration_id: 'iteration_node_id'
     # zIndex: 1002
   ```
   
   **重要なポイント:**
   - `provider_type: builtin` を設定
   - `tool_configurations` で固定パラメータを設定
   - `tool_parameters` で動的パラメータを設定（`type: mixed` で変数参照可能）
   - 出力変数名は通常 `text`
   - イテレーション内で使用する場合は `parentId`, `isInIteration`, `iteration_id`, `zIndex` を追加

   **選択2（Agentノード経由 - イテレーション外のみ推奨）の場合:**
   
   **設計上の使い分け:** 「2.2 処理フローの確認」の「エージェントノードとイテレーションの使い分け」を参照。
   
   **動作確認済みの構造:**
   
   動作確認済みのAgentノードの構造：
   ```yaml
   - data:
       agent_parameters:
         instruction:
           type: constant
           value: 'エージェントへの指示。ツールの使用方法を指定します。'
         model:
           type: constant
           value:
             completion_params: {}
             mode: chat
             model: gpt-4o-mini  # 推奨モデル（実際にはUIで選択されたモデル名を使用）
             model_type: llm
             provider: langgenius/openai/openai
             type: model-selector
         query:
           type: constant
           value: '{{#sys.query#}}'  # advanced-chatモードの場合、通常はsys.queryを使用
         tools:
           type: constant
           value: []  # ツールは任意で0個以上追加可能。各ツールは以下の構造を持つ:
           # - enabled: true/false  # ツールを有効にするかどうか
           #   extra:
           #     description: ''  # 追加説明（空文字列でも可）
           #   parameters: {}  # または { param_name: { auto: 1, value: null } }  # パラメータ設定
           #   provider_name: time  # または langgenius/duckduckgo/duckduckgo など  # プロバイダー名
           #   schemas: [...]  # ツールのスキーマ定義（詳細なパラメータ定義、Difyマーケットプレイスから取得した完全な構造）
           #   settings: { ... }  # ツールの設定（固定値など）
           #   tool_label: "..."  # ツールの表示名
           #   tool_name: current_time  # または ddgo_search, weather など  # ツール名
           #   type: builtin  # ツールタイプ
           # 注意: ツールの完全な構造は、DifyのUI上でエージェントアプリを作成し、ツールを追加してからDSLをエクスポートすることで取得できる
       agent_strategy_label: FunctionCalling
       agent_strategy_name: function_calling
       agent_strategy_provider_name: langgenius/agent/agent
       desc: 'エージェントの説明'
       # 注意: トップレベルのinstruction/modelは任意（互換用、Dify 1.10以上ではagent_parametersのみで動作）
       # instruction: 'エージェントへの指示。ツールの使用方法を指定します。'  # 任意
       isInIteration: false  # イテレーション内で使用する場合: true
       isInLoop: false
       iteration_id: ''  # イテレーション内で使用する場合: iteration_node_id
       max_iteration: 5
       # 注意: トップレベルのmodelは任意（互換用、Dify 1.10以上ではagent_parametersのみで動作）
       # model:
       #   completion_params:
       #     temperature: 0.3
       #   mode: chat
       #   name: gpt-4o-mini  # 推奨モデル（実際にはUIで選択されたモデル名を使用）
       #   provider: openai
       output_schema: null  # Dify 1.10以上での動作確認済み
       plugin_unique_identifier: '<<AGENT_PLUGIN_IDENTIFIER>>'  # 実際の値は、Dify環境でエージェントアプリをUI上で作成→DSLエクスポート→そのplugin_unique_identifierをコピーして使用すること。このリポジトリではlanggenius/agent:0.0.4@...が動作確認済み
       selected: false
       strategy: function_call
       title: エージェント名
       tool_node_version: '2'
       tools:
       - provider_id: tavily
         provider_name: tavily
         provider_type: builtin
        # NOTE: Toolノード同様、環境によって `search` が存在しない場合があるため `tavily_search` を推奨
        tool_name: tavily_search
       type: agent
       variable_selector:  # オプション: 入力変数を参照する場合
       - 'start_node_id'
       - variable_name
     id: agent_node_id
     parentId: null  # イテレーション内で使用する場合: iteration_node_id
     type: custom
   ```
   
   **重要なポイント（Dify 1.10以上を前提）:**
   - `agent_parameters`セクションを必ず設定する（動作確認済みの構造、必須）
     - `agent_parameters.instruction`: `type: constant`, `value: "..."`で設定（必須）
     - `agent_parameters.model`: `type: constant`, `value: {...}`で設定（必須、`provider: langgenius/openai/openai`、推奨モデル: `gpt-4o-mini`）
     - `agent_parameters.query`: `type: constant`, `value: "{{#sys.query#}}"`で設定（advanced-chatモードの場合、通常は`sys.query`を使用）
     - `agent_parameters.tools`: `type: constant`, `value: [...]`で設定（任意、0個以上追加可能。各ツールは完全な構造を含む必要がある）
   - **トップレベルの`instruction`と`model`は任意（互換用、Dify 1.10以上では`agent_parameters`のみで動作する）**
   - `strategy`は`function_call`を使用（トップレベルに設定する場合）
   - `agent_strategy_label`と`agent_strategy_name`は`FunctionCalling`と`function_calling`を使用（Dify 1.10以上での動作確認済み）
   - `tools`配列はシンプルな形式で設定（`provider_type: builtin`を含む、任意のツールを0個以上追加可能）
   - `variable_selector`は、Startノードなどの入力変数を参照する場合のみ使用（通常は不要）
   - イテレーション内で使用する場合: `isInIteration: true`, `iteration_id`, `parentId`を追加
     - 設計上の使い分けは「2.2 処理フローの確認」の「エージェントノードとイテレーションの使い分け」を参照
     - **注意: イテレーション内でのAgentノード使用は非推奨（Toolノードを推奨）**
   - 必須設定:
     - `agent_strategy_provider_name`: `langgenius/agent/agent`（必須）
     - `plugin_unique_identifier`: Agentプラグインの識別子（必須、**実際の値は、Dify環境でエージェントアプリをUI上で作成→DSLエクスポート→その`plugin_unique_identifier`をコピーして使用すること。このリポジトリでは`langgenius/agent:0.0.4@...`が動作確認済み**）
     - `output_schema`: `null`（推奨、Dify 1.10以上での動作確認済み）
     - `tool_node_version`: `'2'`（必須）
   - `dependencies`セクションにAgentプラグインを追加（必要な場合）
   - Agentノードの出力（通常は`text`）を次のノードに渡す
   - 出力変数名の不確実性を回避できる
   
   **ツールの追加方法:**
   - `agent_parameters.tools.value`は配列で、任意のツールを0個以上追加可能
   - 各ツールは以下の構造を持つ必要がある:
     - `enabled: true/false`: ツールを有効にするかどうか
     - `extra.description: ''`: 追加説明（空文字列でも可）
     - `parameters: {}` または `parameters: { param_name: { auto: 1, value: null } }`: パラメータ設定
     - `provider_name`: プロバイダー名（例: `time`, `langgenius/duckduckgo/duckduckgo`, `langgenius/tavily/tavily`）
     - `schemas: [...]`: ツールのスキーマ定義（詳細なパラメータ定義、Difyマーケットプレイスから取得した完全な構造）
     - `settings: { ... }`: ツールの設定（固定値など）
     - `tool_label`: ツールの表示名
     - `tool_name`: ツール名（例: `current_time`, `ddgo_search`, `tavily_search`, `weather`）
     - `type: builtin`: ツールタイプ
   - **ツールの完全な構造は、DifyのUI上でエージェントアプリを作成し、ツールを追加してからDSLをエクスポートすることで取得できる**

   **選択2（Toolノード経由）の場合:**
   - Toolノードを作成
   - `provider_id`, `provider_name`, `tool_name`を設定
   - `tool_parameters`でパラメータを設定
   - 出力変数名を確認（`result`/`output`/`data`/`text`など）
   - 出力を次のノードに渡す
   - 出力変数名が不明な場合は、Agentノード経由を推奨

   **選択3（HTTP Request経由）の場合:**
   - HTTP Requestノードを作成
   - APIエンドポイントURLを設定
   - APIキーを環境変数として設定（必要な場合）
   - リクエストボディ、ヘッダーを適切に設定
   - レスポンスを次のノードに渡す
   - 出力形式が明確

3. **環境変数の設定:**
   - APIキーが必要なツールの場合、環境変数として追加
   - 環境変数名: `{ツール名}_API_KEY`（例: `TAVILY_API_KEY`）
   - `value_type: secret`で設定
   - DSL生成後の案内メッセージで環境変数設定を説明

---

## 注意事項

1. **機密情報**: APIキー等は必ず環境変数に格納
2. **ファイルサイズ**: 大きなファイルは処理時間とコストに注意
3. **プラグイン依存**: 使用するプラグインがインストールされているか確認
4. **モデル互換性**: 選択したモデルがプロバイダーで利用可能か確認
5. **トークン制限**: LLMの最大トークン数に注意

---

## 出力フォーマット仕様

### YAML構造の基本ルール

1. **インデント**: 2スペース
2. **文字コード**: UTF-8
3. **改行コード**: LF
4. **引用符**: 必要な場合のみ使用

### コメント規則

重要な設定には日本語コメントを付与：

```yaml
model:
  name: gpt-4o  # 推奨: 高性能でコストバランスが良い
  provider: openai
  completion_params:
    temperature: 0.7  # 0.0-2.0: 創造性の調整
```

---

## まとめ

このルールに従って、ユーザーとの対話を通じて適切なDifyワークフローDSLを生成し、自動的にDifyへアップロードします。

**5つのフェーズ:**
1. **初期ヒアリング**: 基本情報の収集
2. **詳細ヒアリング**: 処理フロー、入出力、機能設定の確認
3. **フロー確認**: ワークフロー全体像の提示と最終確認
4. **DSL生成**: YAMLファイルの自動生成
5. **Difyへのアップロード**: 自動インポート（オプション）

**サポートするモード:**
1. **チャットフローモード (`advanced-chat`)**: 会話型インターフェース、Answerノードで回答を表示
2. **ワークフローモード (`workflow`)**: タスク実行型、HTTPエンドポイントとして公開可能、Answerノード不要
3. **エージェントモード (`agent-chat`)**: AIエージェントがツールを自動使用

**サポートする開始方法（ワークフローモード）:**
1. **Startノード**: 手動実行または外部スケジューラーから呼び出し
2. **スケジュールトリガー**: 指定した時刻や間隔で自動実行（ビジュアル設定: `frequency` + `visual_config`。Cron式は使用しない）
3. **Webhookトリガー**: 外部システムからのHTTPリクエストで自動実行

**重要原則:**
1. **段階的ヒアリング**: 一度に全てを聞かない
2. **具体例の提示**: わかりやすく説明
3. **確認重視**: フロー確定前に必ず確認
4. **品質保証**: 生成前にチェックリスト確認
5. **柔軟な対応**: ユーザーの要望に応じてカスタマイズ
6. **ユーザー確認**: アップロード前に必ずユーザーの許可を得る
7. **モードの適切な選択**: 用途に応じてチャットフローまたはワークフローモードを選択

**自動デプロイ機能:**
- ユーザーの許可を得てから実行
- ブラウザは手動で起動済み（デバッグモード）を前提
- Difyへのログイン確認は不要（既にログイン済みを前提）
- エラー時は詳細な対処法を提示
- 手動インポートの方法も案内

---

**作成日**: 2025年12月10日
**最終更新日**: 2026年1月16日



# AGENTS GUIDE

## ⚠️ 最重要: 遂行責任 (Critical: Responsibility to Complete)

## ⚠️ 最重要: 電子カルテ・ORCA連携の安全境界

OpenDolphinNext は、ORCA / WebORCA 連携電子カルテとして扱う。

このリポジトリでの実装・レビュー・テスト・ドキュメント更新では、一般的なWebアプリの品質だけではなく、電子カルテとしての以下を最上位制約とする。

- 正本境界
- 診療録の真正性
- 処方指示の真正性
- ORCA連携の冪等性
- 二重送信防止
- UNKNOWN状態の安全な扱い
- 監査ログのappend-only性
- 患者取り違え防止UI
- 見読性・保存性・説明可能性
- ORCA認証情報と患者情報の秘匿

後方互換性や過去DB遺産よりも、本番運用上の安全性を優先する。
危険な旧仕様を温存するための互換レイヤー、旧API、旧テーブル、旧UI導線を追加してはならない。

詳細仕様は次を正本として参照する。

- `docs/architecture/ehr-orca-source-of-truth-boundary.md`
- `docs/architecture/ehr-chart-prescription-authority.md`
- `docs/architecture/orca-integration-safety-contract.md`
- `docs/testing/ehr-orca-required-test-matrix.md`
- `docs/operations/orca-unknown-state-runbook.md`
- `docs/web-client/ux/medical-safety-ui-rules.md`

これらに反する変更は、たとえテストが通っても Done とみなさない。

**割り当てられたタスクは、可能な限り自律的に完遂せよ。**
- 「方法を提案して終了」ではなく、「設計し、実装し、テストし、動作確認まで完了した状態」で報告すること。
- ユーザーの手を煩わせない。必要な調査、修正、再試行、検証、追加テスト、ドキュメント更新は自律的に行え。
- **中途半端な作業報告は禁止。**
- セキュリティ上の懸念を見つけた場合、「別チケットで後日対応」として放置しない。少なくとも、根本原因の是正方針・再発防止策・検証結果まで揃えて報告すること。
- 「一旦動くからOK」は禁止。**本番運用品質・安全性・保守性**を満たして初めて Done とみなす。

## 0. 現状把握クイックスタート
後続ワーカーは、作業開始直後に以下を確認してから設計に入ること。
- `date -u +%Y%m%dT%H%M%SZ` で RUN_ID を採番する。
- `git status --short` と `git branch --show-current` で、既存変更・作業ブランチ・未追跡成果物を把握する。自分が作った変更以外は勝手に戻さない。
- `docs/README.md`、`docs/managerdocs/README.md`、`web-client/README.md`、`docs/architecture/server-modernization-overview.md`、`docs/runbooks/release-validation.md` を入口として読む。
- UI 変更では `docs/web-client/ux/dads_app_ui_design_rules_20260411.md`、`docs/web-client/ux/web-client-ui-guideline.md`、`web-client/notes/ui-current-contract.md` を確認する。
- セキュリティ・認証・患者文脈・ORCA・添付/画像・health/readiness に関わる場合は、該当する `docs/contracts/*.md` と `web-client/notes/security-spec.md` を必ず確認する。
- 変更対象、信頼境界、攻撃面、最低 3 件の misuse case、実行する検証コマンドを短く整理してから実装する。

### 0.1 医療安全プリフライト

電子カルテ、患者、受付、保険、病名、診療録、処方、診療行為、会計、収納、領収、レセプト、ORCA連携、監査ログ、Web UI重大操作に触れる作業では、実装前に必ず以下を短く整理すること。

- この変更が触る正本は何か。
  - ORCA / WebORCA 正本か。
  - OpenDolphinNext 正本か。
  - cache / snapshot / candidate / audit log か。
- ORCA正本情報をlocal正本化していないか。
- 診療録確定、処方確定、ORCA送信、診察終了、会計送信を混同していないか。
- 確定済み診療録または確定済み処方指示を直接上書きしていないか。
- ORCA送信失敗、警告、不一致、UNKNOWNを成功扱いしていないか。
- idempotency key、再送制御、二重送信防止があるか。
- 監査ログに操作者、対象患者、対象診療録、対象処方、ORCA結果が残るか。
- 患者取り違え防止UIがあるか。
- 重大操作モーダルに患者識別情報が再掲されるか。
- DADSに反するplaceholder依存、disabled依存、重要情報の初期非表示がないか。
- ORCA URL、Basic認証、証明書、証明書パスワードがブラウザ側へ露出していないか。

この整理をせずに実装へ入ってはならない。

## 1. プロジェクト基本ルール
- **目的**: Webクライアント (`web-client`) とモダナイズ版サーバー (`server-modernized`) を、本番運用を前提とした品質で連携・改善すること。
- **主作業対象**: `web-client/` と `server-modernized/`。
- **参照専用**: `client/` および `server/` は Legacy 実装として参照のみとし、**明示指示がない限り変更禁止**。
- **使用言語**: 最終返答は必ず **日本語**。
- **安全性優先**: 後方互換性や過去のデータベース遺産に引きずられて危険な仕様を温存してはならない。
  - セキュリティ・運用性・保守性のために必要であれば、**破壊的変更を許容**する。
  - 「昔からそうなっている」は根拠にならない。
- **禁止事項**:
  - `server/` (Legacyサーバー) の変更。
  - `client/` (Legacyクライアント) の変更。
  - Pythonスクリプトの実行（明示指示がない限り）。
  - 許可なき `worktree` 以外の場所での作業（指示された場合、適切な worktree を作成・移動せよ）。
  - セキュリティ上危険な暫定対応を、根拠や期限なしに残すこと。

### 1.1 リポジトリ構成の現行理解
| Path | 位置づけ | 主な注意 |
| --- | --- | --- |
| `web-client/` | React/Vite の現行 Web クライアント | `package.json` の `verify:web-guard`、`typecheck`、`test`、`build`、`ci` が検証入口。患者文脈を URL / storage に残さない。 |
| `server-modernized/` | Jakarta EE 10 ベースの現行サーバー | REST resource、認証/認可、ORCA 接続、worker 公開面の主対象。 |
| `domain/`, `api-contract/`, `persistence/`, `reporting/` | modernized server の Maven sibling module | `pom.server-modernized.xml` で `server-modernized` と一体ビルドする。API DTO / entity / migration / 帳票変更時に併せて確認する。 |
| `docs/` | enduring docs の正本 hub | current contract / runbook / architecture を置く。dated packet や一時メモを正本にしない。 |
| `web-client/notes/` | web-client current contract | auth、session、patient context、UI、ORCA、security、release gate の Web 側正本。 |
| `ops/` | 環境起動・manual verification harness | Docker / ORCA / smoke の運用入口。 |
| `tests/` | repo-level automated tests | Playwright / review-packet / helper tests。artifact policy を守る。 |
| `scripts/` | thin runner / packaging tools | 既存 runner を優先し、同じ用途の新規スクリプトを乱立させない。 |
| `artifacts/` | evidence / generated outputs | source of truth ではない。RUN_ID 単位で保存し、秘密情報・raw 患者情報を入れない。 |
| `client/`, `server/`, `ext_lib/` | legacy reference | 明示指示なしに変更禁止。現行仕様の根拠にする場合も current docs / current code と照合する。 |

### 1.2 変更種別ごとの主な読み先
| 変更種別 | 先に読む正本 |
| --- | --- |
| 認証・認可・セッション | `web-client/notes/auth-check.md`, `web-client/notes/auth-transition.md`, `web-client/notes/security-spec.md`, `docs/contracts/runtime-config.md` |
| ORCA route / 接続 / readiness | `docs/contracts/orca-route-taxonomy.md`, `docs/contracts/orca-connection.md`, `docs/contracts/orca-master-api.md`, `docs/operations/ORCA_CERTIFICATION_ONLY.md` |
| 電子カルテ正本境界 / ORCA正本境界 | `docs/architecture/ehr-orca-source-of-truth-boundary.md`, `docs/architecture/orca-integration-safety-contract.md`, `docs/contracts/orca-route-taxonomy.md` |
| 診療録確定 / 訂正 / 追記 / 取消 / PDF / export | `docs/architecture/ehr-chart-prescription-authority.md`, `docs/testing/ehr-orca-required-test-matrix.md` |
| 処方指示 / 処方確定 / 変更 / 中止 / 取消 / 再発行 | `docs/architecture/ehr-chart-prescription-authority.md`, `docs/architecture/orca-integration-safety-contract.md` |
| ORCA病名 / diseaseget / diseasev3 | `docs/architecture/ehr-orca-source-of-truth-boundary.md`, `docs/architecture/orca-integration-safety-contract.md`, `docs/testing/ehr-orca-required-test-matrix.md` |
| ORCA診療行為 / medicalmod / 会計送信 / UNKNOWN | `docs/architecture/orca-integration-safety-contract.md`, `docs/operations/orca-unknown-state-runbook.md` |
| 監査ログ / hash chain / append-only | `docs/architecture/ehr-chart-prescription-authority.md`, `docs/testing/ehr-orca-required-test-matrix.md` |
| 医療安全UI / 患者取り違え防止 / 重大操作確認 | `docs/web-client/ux/medical-safety-ui-rules.md`, `docs/web-client/ux/dads_app_ui_design_rules_20260411.md`, `web-client/notes/ui-current-contract.md` |
| health / readiness / runtime config | `docs/contracts/health-endpoints.md`, `docs/contracts/runtime-config.md`, `docs/architecture/server-modernization-overview.md` |
| 添付・文書・患者画像 | `docs/contracts/document-integrity.md`, `docs/contracts/patient-images.md`, `docs/web-client/architecture/document-embedded-attachment-policy.md` |
| Web UI / 患者文脈 | `web-client/notes/ui-current-contract.md`, `web-client/notes/patient-context-contract.md`, `docs/web-client/ux/` |
| release / reviewer packet | `docs/runbooks/release-validation.md`, `docs/runbooks/reviewer-submission-packet.md`, `docs/releases/orca-remediation-cutover.md` |

## 2. セキュリティ最優先ルール (Security First)
**すべての実装・レビュー・修正で、以下を最優先すること。**

### 2.1 信頼境界の原則
- **クライアント入力は信用しない。** リクエスト JSON、フォーム、クエリ、ヘッダ、Cookie、ブラウザ保存値、アップロードファイル名、MIME Type、拡張子、URL、画面上の hidden 値、フロントエンド状態は、いずれも権威情報にしてはならない。
- **外部システム入力も信用しない。** ORCA、オブジェクトストレージ、外部 API、Webhook、添付メタデータ、プロキシ経由値は、必ず検証・正規化・制限すること。
- **権威情報はサーバー側で決定する。** ユーザーID、施設ID、権限、所有者、保存先 URI、オブジェクトキー、digest、監査対象、接続先、可視範囲は、認証情報・サーバー設定・DB 状態から再計算/再解決すること。

### 2.2 設計原則
- **Fail Closed**: 判定不能・設定欠落・例外時は許可側ではなく拒否側に倒すこと。
- **Least Privilege**: 施設一致やログイン済みだけで広範な操作を許可しない。操作単位の最小権限で制御すること。
- **Server-side Enforcement**: 認可・入力検証・監査はサーバー側で強制する。UI の非表示、ボタン制御、ルートガードは補助に過ぎない。
- **Secure by Default**: デバッグ用の緩和、開発便宜のバイパス、詳細な診断応答、広い CORS、弱い Cookie 設定を本番経路に残さない。
- **Root Cause Fix**: 症状隠しではなく、根本原因を直す。フロント修正だけでサーバー欠陥を隠すことは禁止。

### 2.3 今回の再発防止重点事項
以下は**特に厳守**すること。
- クライアントが送ってきた **storage URI / object key / digest / owner / facility などを、そのまま永続化・信頼しない**。サーバー側で再計算・上書きすること。
- **パスワード変更 / パスワードリセット / 権限変更 / MFA リセット / アカウント復旧** 時は、対象ユーザーの **全セッション・トークンを失効** させること。
- **health / readiness / liveness** は外部公開時に最小情報のみ返すこと。例外詳細、内部 URL、接続状態の詳細、構成値、障害理由を匿名応答に含めない。
- **外部接続テストや連携先 URL を任意入力で到達可能にしない**。接続先は allowlist 化し、SSRF の踏み台を作らないこと。
- **施設一致のみで認可完了と見なさない**。閲覧/更新/削除/エクスポート/管理/API 利用などの能力ごとに判定すること。

## 3. 明示的に禁止する危険実装
以下の実装は、明示指示があっても原則禁止とし、必要なら代替案を提案すること。
- クライアント提供の `uri`, `objectKey`, `path`, `digest`, `ownerId`, `facilityId`, `role`, `isAdmin`, `canDelete` 等を権威情報として採用すること。
- 例外メッセージ、スタックトレース、SQL 文、接続先 URL、内部パス、設定値を API 応答や UI にそのまま返すこと。
- 匿名利用可能な health/readiness に、内部障害理由や接続先詳細を出すこと。
- 任意 URL への fetch / connect test / redirect / proxy / webhook 中継など、**SSRF に繋がる機能**を無制限に実装すること。
- パスワードリセットや権限変更後も、既存セッションを生存させること。
- 文字列連結による SQL / JPQL / shell command / HTML / JavaScript 生成。
- `eval` 系 API や、監査されていないテンプレート実行・式展開を使うこと。
- ユーザー入力ベースのファイルパス操作、任意パス保存、任意オブジェクト削除、パストラバーサルを招く処理。
- ファイルアップロードを、拡張子や自己申告 MIME のみで許可すること。
- フロントエンドで秘密情報、認可判定、管理者フラグ、接続先資格情報を保持すること。
- 長期利用トークンや高権限資格情報を `localStorage` / `sessionStorage` に保存すること（明示的かつ厳格な理由がない限り禁止）。
- `dangerouslySetInnerHTML` や同等機能を、監査済みサニタイザ・テストなしで使用すること。
- CSRF / CORS / CSP / セキュリティヘッダを、理由なく緩めること。
- デフォルトパスワード、テストアカウント、サンプル実資格情報、固定トークンをコード・設定・ドキュメントに残すこと。
- パスワード、セッショントークン、Basic 認証ヘッダ、ORCA 資格情報、患者個人情報をログへ平文出力すること。

## 4. 領域別の必須セキュリティ要件

### 4.1 認証・認可・セッション
- 認可は**サーバー側で**、操作ごとの能力単位（閲覧/作成/更新/削除/承認/エクスポート/管理/連携設定）で判定すること。
- 「ログイン済み」「同一施設」「画面が見えている」を認可の代替にしてはならない。
- パスワード変更、管理者によるリセット、MFA リセット、権限変更、アカウント停止/復旧時は、対象ユーザーの全セッション・Remember-Me・API トークンを失効させること。
- セッション固定化対策として、ログイン成功時や権限昇格時はセッション識別子をローテーションすること。
- Cookie を使う場合は `HttpOnly` / `Secure` / `SameSite` を適切に設定し、用途に応じて有効期限を短くすること。
- ログイン、失敗、ロック、解除、権限変更、認可拒否は監査ログに残すこと。

### 4.2 データ・ストレージ・添付・画像
- 添付ファイル・画像・文書の保存先キー、URI、ファイル名、digest、所有者情報は**サーバー側で生成**すること。
- クライアントが送信した保存先 URI や object key をそのまま保存・読取・削除に使ってはならない。
- 読取・更新・削除時は、DB 上の所有者/施設/権限とサーバー側の保存先制約を両方検証すること。
- バケット/プレフィックス/ディレクトリは allowlist で制限し、任意オブジェクト参照・削除を防ぐこと。
- アップロードは allowlist 方式で種別を制限し、**magic bytes / サイズ / 拡張子 / Content-Type / 寸法** を検証すること。
- 可能なものは再エンコード・正規化し、危険なメタデータや余分な埋め込みを落とすこと。
- ZIP 展開やアーカイブ処理では Zip Slip、Zip Bomb を考慮すること。

### 4.3 API・エラー処理・ヘルスチェック
- 4xx/5xx 応答に内部実装詳細を載せない。クライアント向けメッセージは簡潔・安全な内容に限定すること。
- 詳細エラーは構造化ログに残し、クライアントには必要に応じて相関 ID のみ返すこと。
- health/liveness/readiness は用途別に分離し、外部公開経路では生死判定の最小情報のみ返すこと。
- CORS は必要最小限の origin / method / header のみに許可すること。ワイルドカードや資格情報付きの広域許可を避けること。
- レート制限や abuse 対策を、ログイン、パスワードリセット、検索、エクスポート、アップロード等に適用すること。

### 4.4 外部連携・SSRF 対策
- ORCA を含む外部接続先は、**scheme / host / port / path** または名前付き接続定義で allowlist 化すること。
- 任意 URL 入力から直接接続テストやサーバーサイド fetch を行わないこと。
- TLS 検証、タイムアウト、再試行上限、接続失敗時の安全なエラー処理を実装すること。
- 資格情報は安全な設定経路でのみ管理し、ログ・例外・画面表示に露出させないこと。
- 開発用に insecure HTTP を許す場合でも、限定環境・限定接続先・明確な切替条件を設けること。

### 4.5 Webクライアント
- Web クライアントは**信頼境界ではない**。認可や監査の主責務を持たせないこと。
- シークレット、管理者判断、医療データの可視制御、機微な業務ルールをフロントのみで完結させないこと。
- ユーザー入力やサーバー返却 HTML/Markdown を描画する場合は、必ずエスケープまたは監査済みサニタイザを用いること。
- `dangerouslySetInnerHTML` 等の危険 API は、代替不能で監査済みの場合に限り、理由・サニタイズ方法・テストを残して使用すること。
- トークン/資格情報は可能な限り HttpOnly Cookie に寄せ、ブラウザ保存領域への長期保持を避けること。
- 画面非表示・ルーティング制限・ボタン無効化は UX であり、認可そのものではない。
- クライアントログ、エラートラッキング、分析タグに患者情報や機微資格情報を送らないこと。

### 4.6 DB・クエリ・マイグレーション
- SQL / JPQL / Criteria はバインド変数・プレースホルダを使い、文字列連結を禁止する。
- マイグレーションでは利便性のための広い権限付与を行わない。必要最小限の権限に留めること。
- セキュリティ上危険な過去仕様を温存するためだけの列・フラグ・分岐は増やさないこと。
- 削除/更新系処理は認可・所有権・監査をセットで見直すこと。

### 4.7 ログ・監査・設定・ドキュメント
- ログには RUN_ID、相関 ID、実行者、対象、結果を残し、秘密情報・患者個人情報は最小化/マスキングすること。
- `*.sample` 設定ファイルには実シークレットを入れない。すべてプレースホルダと説明に置き換えること。
- セキュリティ関連の設定値を追加/変更したら、`README`、運用手順、サンプル設定、ロールバック手順を更新すること。
- 「この設定を有効にしないと危険」という事項は、ドキュメントに明記すること。

## 5. 開発・ドキュメントルール
- **正本ドキュメント**:
  - 正本索引は `docs/README.md`。
  - manager handoff / release 判定は `docs/managerdocs/README.md`。
  - web current contract は `web-client/README.md` と `web-client/notes/`。
  - web-client の UI 構築ルールは `docs/web-client/ux/dads_app_ui_design_rules_20260411.md` を参照し、`docs/web-client/ux/web-client-ui-guideline.md` と合わせて設計判断に使う。
  - server / release gate は `docs/architecture/server-modernization-overview.md` と `docs/runbooks/release-validation.md`。
- **現行ハブ**: `docs/README.md` / `docs/managerdocs/README.md` / `web-client/README.md` を入口とする。
- **文字コード**: 日本語を含むファイルは **UTF-8 (BOMなし)** で保存。
- **Windows/macOS 混在時の文字化け再発防止**:
  - Windows / macOS のどちらで編集しても、**エディタの自動判定に任せず UTF-8 (BOMなし) を明示**して開くこと。
  - Windows 環境では、エディタ・ターミナル・新規保存時の**既定文字コードを UTF-8 (BOMなし) に統一**し、CP932 / Shift_JIS の自動選択や暗黙の継承を使わないこと。
  - 日本語ドキュメントを更新したら、**保存後に UTF-8 指定で再読込して目視確認**し、文字化けしたまま上書きしないこと。
  - `AGENTS.md`、`docs/`、`web-client/notes/` など日本語を含む正本ドキュメントは、**Shift_JIS / CP932 / UTF-8 with BOM で保存しない**こと。
  - 文字化けを見つけた場合は、そのまま追記で直そうとせず、**git 上の正常版または内容復元後の UTF-8 BOMなし全文で置き換えてから**作業を続けること。
  - 改行コード差分だけのつもりでも、日本語ファイルでは **コミット前に UTF-8 / BOMなし / 文字化けなし** を確認すること。
- **RUN_ID**: 作業開始時に `YYYYMMDDThhmmssZ` を採番し、ログや報告で使用する。
- **セキュリティ変更時のドキュメント更新は必須**:
  - 認証/認可/セッション/外部連携/ヘルスチェック/添付保存/監査ログに影響する変更では、該当ドキュメントを必ず更新すること。
  - 「コードだけ直して文書未更新」は不完了とみなす。
- **正本と証跡の分離**:
  - current contract は `docs/contracts/`、`docs/managerdocs/`、`web-client/notes/` に寄せる。
  - workflow 実行手順は `docs/runbooks/` と `docs/releases/` に寄せる。
  - background / research / history は `docs/reference/` に置く。
  - dated packet / prompt / handoff / closeout / review docs は `docs/archive/` または `docs/implementation/` の位置づけを確認し、current 導線に混ぜない。
  - generated evidence / screenshots / HAR / traces / review bundles は `artifacts/` に置き、source of truth に昇格させない。
- **生成物の扱い**:
  - `target/`、`dist/`、`test-results/`、`output/`、`tmp/`、`*.war`、review zip、`.DS_Store`、`__MACOSX`、`Thumbs.db` を通常のレビュー対象に混ぜない。
  - 生成物を提出物に含める必要がある場合は、runbook の packet 生成・検証手順に従い、manifest / hash / sanitize 済み要約を揃える。

## 6. 環境・インフラ
- **起動**: `WEB_CLIENT_MODE=npm ./setup-modernized-env.sh` を使用。
  - ログイン情報は同スクリプト内の記載に従うこと。
- **再ビルド所要時間**: `docker compose build server-modernized-dev` は依存DLで時間がかかる。
  - 推奨待機時間: **7〜10分**（初回は **15分** を見込む）。
  - タイムアウト設定時は **最低 10分** 以上を指定すること。
- **ORCA連携**: 開発完了まで WebORCA Trial を標準接続先として使う。`docs/operations/ORCA_CERTIFICATION_ONLY.md` の手順を厳守し、ログを残すこと。
  - **標準接続先**: `https://weborca-trial.orca.med.or.jp/`（XML/UTF-8 + Basic, `ORCA_MODE=weborca`, `ORCA_API_SCHEME=https`, `ORCA_API_PORT=443`）。
  - 公開 Trial の Basic 値であっても、repo / review package / 実行ログ / summary / test fixture には raw 値を書かない。実行時に `ORCA_API_USER` / `ORCA_API_PASSWORD` またはローカル secret store から供給し、証跡では set/unset と sanitized classification だけを残すこと。
  - ローカルの正本は `./orca.env.local` か `~/.config/opendolphin/orca.env` とし、`ORCA_ENV_FILE` がある場合はそれを優先する。`setup-modernized-env.sh` / `.ps1` / `ops/tests/orca/api-smoke.sh` / `web-client` の `npm run dev` はこれを自動読込する。
- **本番相当設定の検証**:
  - 認証、Cookie、CORS、ORCA 接続、添付保存、エラーハンドリングは、可能な限り本番相当設定で確認すること。
  - 開発専用の緩和設定を使った場合は、報告に明記すること。

### 6.1 標準検証コマンド
変更範囲に応じて、最低限の focused test と full gate を組み合わせること。実行できない場合は、理由・代替検証・残リスクを報告する。

| 対象 | 標準コマンド |
| --- | --- |
| Web guard | `cd web-client && npm run verify:web-guard` |
| Web typecheck | `cd web-client && npm run typecheck` |
| Web unit test | `cd web-client && npm run test:ci` または対象を絞った `npm test -- --run <test-file>` |
| Web build / full CI | `cd web-client && npm run ci` |
| Server focused test | `mvn -f pom.server-modernized.xml -pl server-modernized -am -Dtest=<TestClass> test` |
| Server static/full verify | `mvn -f pom.server-modernized.xml -pl server-modernized -am -Pstatic-analysis verify` |
| Release smoke | `cd web-client && node scripts/runtime-ready-smoke.mjs` |
| Doc/config guards | `bash server-modernized/tools/ci/check-doc-links.sh`、`bash server-modernized/tools/ci/check-config-contract.sh`、`bash server-modernized/tools/ci/check-no-direct-runtime-lookup.sh --root "$(git rev-parse --show-toplevel)"` |

### 6.2 変更種別ごとの検証目安
- Web UI のみ: `verify:web-guard`、対象 Vitest、`typecheck`、必要に応じて `build` とブラウザ目視確認。
- Web の auth/session/patient context: 上記に加え、storage / URL scrub / CSRF / logout cleanup の異常系 test を追加または更新する。
- Server resource / auth / ORCA / storage: focused Maven test、改ざん入力・認可拒否・fail closed test、`-Pstatic-analysis verify` を実行する。
- contract / docs のみ: Markdown link / config contract / 該当 grep を実行し、コード正本と矛盾しないことを確認する。
- release / reviewer packet: `docs/runbooks/release-validation.md` の順序を正本とし、古い RUN_ID や別ブランチの evidence を流用しない。

## 7. ワーキングフロー (作業手順)
1. **理解**:
   - 指示内容と `docs/README.md`、`docs/managerdocs/README.md`、`web-client/README.md` を確認する。
   - web-client の UI 構築ルールとして `docs/web-client/ux/dads_app_ui_design_rules_20260411.md` を確認する。
   - server 側の current contract / release gate は `docs/architecture/server-modernization-overview.md` と `docs/runbooks/release-validation.md` を確認する。
   - 対象変更の **資産・信頼境界・攻撃面** を把握する。
2. **脅威モデリング**:
   - 少なくとも以下を確認すること。
     - 未認証アクセス
     - 権限昇格 / 横展開
     - 任意オブジェクト参照 / データ流出
     - SSRF / 外部接続悪用
     - セッション固定 / セッション残存
     - XSS / CSRF / CORS 逸脱
     - 情報漏えい（health, error, log, analytics）
   - **最低 3 件の misuse case** を想定してから実装に入ること。
3. **設計**:
   - UI 側の見た目修正ではなく、サーバー側の根本原因是正を優先すること。
   - セキュリティ上必要なら API 契約やデータ構造の変更を許容すること。
   - 危険な入力は「受け取って無害化」より「受け入れない/上書きする」を優先すること。
4. **実装**:
   - `web-client/` と `server-modernized/` に対して修正を行う。
   - `client/` / `server/` は参照のみとする。
   - 一時的な TODO, FIXME, デバッグ用緩和、秘密情報直書きを残さないこと。
   - 既存 helper / service / guard / test pattern を優先し、同じ責務の独自実装を増やす前に `rg` で既存実装を探すこと。
   - DTO / API 契約を変える場合は server、web-client、docs/contracts、web-client/notes、test fixture を同時に見直すこと。
5. **検証**:
   - ローカルで起動確認し、エラーが出たら自律的に修正する。
   - 正常系だけでなく、**異常系・認可拒否・改ざん入力・境界条件** を検証すること。
   - セキュリティに関わる修正では、少なくとも以下を確認すること。
     - 改ざんした `facilityId` / `ownerId` / `uri` / `digest` / role で突破できないこと
     - パスワード変更/リセット後に旧セッションが使えないこと
     - health/readiness が過剰情報を返さないこと
     - 例外応答に内部詳細が漏れないこと
     - 任意 URL 接続や許可外ホスト接続が拒否されること
     - XSS/HTML 注入が成立しないこと
6. **静的解析・品質確認**:
   - `server-modernized` は、定義済みの unit/integration test・静的解析・ビルドを実行し、重大な新規警告を残さないこと。
   - `web-client` は、`package.json` に定義された lint / typecheck / test / build を実行すること。
   - 依存追加・更新時は、既知の重大脆弱性の有無も確認すること。
   - `npm run ci` と `mvn ... -Pstatic-analysis verify` が重い場合でも、少なくとも対象 focused test と guard を先に通し、full gate 未実行なら理由を報告すること。
7. **Git操作**:
   - `worktree` 作業時は、報告前に必ずコミットを行うこと。
   - `main` ブランチへのマージ指示時は、現在の作業ディレクトリの内容をマージすること。
   - 作業開始時に存在した unrelated diff / untracked artifact は、自分の変更として staging しない。必要なら最終報告で「既存変更」として分けて記載する。
8. **報告**:
   - `【ワーカー報告】` ヘッダーを使用。
   - 実施内容、結果、残課題、更新したドキュメントを明記。
   - ファイル・ディレクトリ・ZIP・sidecar などの成果物を提示する場合は、単なるパス文字列ではなく、クリック可能な Markdown リンク形式で提示すること。
     - 例: `[FINAL_REPORT.md](/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient/docs/implementation/example/FINAL_REPORT.md)`
     - sha256 / size / count などのメタデータは併記してよいが、対象ファイル自体は必ずリンクにすること。
   - セキュリティ影響のある変更では、**脅威・対策・検証結果・残リスク** を必ず含めること。
   - "Done" の定義を満たしてから報告せよ。

## 8. Done の定義
以下を満たしていない限り、完了扱いにしてはならない。
- 機能/修正が意図どおり動作する。
- 正常系に加えて、異常系・権限逸脱・改ざん入力の検証が完了している。
- 新たな重大セキュリティリスクを導入していない。
- 認証/認可/セッション/ヘルスチェック/外部接続/添付保存に関わる変更は、再発防止策まで反映済みである。
- ログ・エラー応答・画面・サンプル設定に秘密情報や内部詳細が漏れていない。
- 必要なドキュメント更新が完了している。
- worktree 作業時はコミット済みである。

## 9. マネージャー・ワーカー間連絡 (AI Agent間連携)
- **マネージャー**:
  - 指示は具体的かつ、ワーカーが迷わず完遂できる情報を含めよ。`【ワーカー指示】` を使用。
  - 並列可能なタスクは適切に振り分け、各ワーカーに十分な情報（プロンプト）を与えよ。
  - セキュリティ影響のある作業では、対象資産・信頼境界・禁止ショートカット・確認すべき misuse case を指示に含めること。
- **ワーカー**:
  - 指示された範囲を逸脱せず、しかし範囲内の障害は独力で排除せよ。`【ワーカー報告】` を使用。
  - 実装中に見つけたセキュリティリスクは、その場で握り潰さず、修正または具体的な再発防止策を報告に含めること。
  - 「ハードニングは後で」「レビューで見てもらう前提」は禁止。少なくとも自分の担当範囲では塞いでから報告すること。

## 10. Dockerコンテナ運用ルール
- **worktree作業時（並列作業前提）**:
  - 各 worktree 専用のコンテナを作成・使用すること（コンテナ名に worktree 名やブランチ名を含める等で識別可能にする）。
  - **他の worktree 由来のコンテナは操作禁止**（停止・削除・再起動等）。
  - 自身の worktree 用コンテナのみ自律的に作成・起動・再構築してよい。
- **masterブランチ上での作業時**:
  - 単独作業が前提のため、上記制限は適用しない。既存コンテナの操作も許可。
- **セキュリティ観点の補足**:
  - コンテナ起動時に秘密情報を標準出力へ流さないこと。
  - 開発用の緩和設定やテスト資格情報を、他 worktree や共有環境へ持ち込まないこと。

## 11. サブエージェントルール
- サブエージェントが使用可能な場合は積極的にサブエージェントを動かし、自分のコンテキストを圧迫しないよう運用すること。
- ただし、実行環境の上位指示でサブエージェント利用が明示許可制の場合は、その上位指示を優先する。許可がない場合は自分で調査・実装し、必要なら報告で分割案だけ提示する。
- サブエージェントを使用する場合、別途指示がない限りモデルは `gpt-5.5`、reasoning effort は `medium` を使用すること。
- サブエージェントへのプロンプトには、必ず各自専用の `worktree` を作成してそこで作業するよう明示すること。
- サブエージェントを使った場合は、**ハングしている場合を除き**、原則として作業終了まで待機し、完了結果を確認してから次の判断に進むこと。
- ただし、セキュリティに関わる判断（認可、秘密情報、外部接続、権限変更）は、最終的に自分で整合性を確認してから報告すること。

### 11.1 電子カルテ・ORCA連携サブエージェント追加仕様

作業量が多い場合、マネージャーエージェントは積極的にサブエージェントを使うこと。

ただし、サブエージェントは単なる調査係ではなく、明確な成果物、検証コマンド、差分、残リスクを返す単位で起動する。

サブエージェントを使う場合、原則として次を守る。

- 各サブエージェントは専用worktreeで作業する。
- 各サブエージェントは他worktreeのコンテナ、成果物、未追跡ファイルを操作しない。
- サブエージェントのモデル指定が可能な場合、原則 `gpt-5.4 high` を使う。
- サブエージェントには、担当範囲、禁止事項、読むべき正本、検証コマンド、報告形式を明示する。
- セキュリティ、ORCA正本境界、診療録真正性、処方真正性、監査ログ、患者取り違え防止UIの最終判断は、マネージャーが再確認する。
- サブエージェントの報告をそのまま鵜呑みにせず、マネージャーが矛盾、漏れ、過剰実装、危険な互換維持を確認する。

大きな作業では、原則として次の分割を使う。

| サブエージェント | 主担当 | 主な確認対象 |
| --- | --- | --- |
| Server Authority Agent | 診療録・処方・監査ログ | chart revision、prescription authority、DB guard、append-only、hash chain |
| ORCA Integration Agent | ORCA連携 | patientget、patientmod、accept、diseaseget、diseasev3、medicalmod、UNKNOWN、idempotency |
| Web Safety UI Agent | Web UI | 患者ヘッダー、重大操作確認、ORCA警告、不一致、DADS準拠、アクセシビリティ |
| Test Gate Agent | テスト・CI | required test matrix、focused tests、route inventory、security guard、CI evidence |
| Docs/Runbook Agent | 文書・運用 | current contract、runbook、UNKNOWN運用、監査ログ保全、reviewer packet |

マネージャーは次を行う。

1. 作業工程表を作成する。
2. 各サブエージェントへ専用worktree作成を指示する。
3. 各サブエージェントの担当範囲が重複しすぎないようにする。
4. サブエージェントの成果をレビューする。
5. マージ順を決める。
6. コンフリクトを解消する。
7. 統合後に必要なfocused testとfull gateを実行する。
8. AGENTS.md、docs、runbook、test matrixの更新漏れを確認する。
9. 最終報告では、サブエージェント別の成果、検証結果、残リスク、未実行コマンドを明記する。

## 12. worktree 整理ルール
- 作業完了後、作業ブランチや `master` へ必要な内容を取り込んだら、現在のリポジトリに紐づく補助 `worktree` を棚卸しすること。
  - `git worktree list --porcelain` で登録済み worktree を確認する。
  - 併せて、リポジトリ親ディレクトリや `$CODEX_HOME/worktrees` 配下に残った関連作業ディレクトリを確認する。
- 各 worktree について、削除前に必ず以下を確認すること。
  - `git status --short` が clean か。
  - HEAD / branch / master との差分。
  - `git cherry master <branch>` や `git diff master..<branch>` 等で、必要な変更が既に作業ブランチまたは `master` に取り込まれているか。
- 未取り込みの有用な変更がある場合は、必要最小限だけ現在の作業ブランチへ取り込むこと。
  - 自分が作成した worktree 以外でも、このリポジトリに紐づく作業内容であれば同じ基準で扱う。
  - ただし、意図不明な変更や衝突リスクの高い変更は、勝手に破棄せず、差分と判断理由を報告する。
- 取り込み済み、または不要と判断できる worktree は、`rm -rf` ではなく `git worktree remove <path>` で削除すること。
  - 削除後は `git worktree prune` を実行し、`git worktree list --porcelain` で登録が main worktree のみになったことを確認する。
  - 空になった親ディレクトリだけが残った場合は、内容が空であることを確認してから `rmdir` で削除してよい。
- 最終報告には、削除した worktree、取り込んだ未反映内容、残したディレクトリがあればその理由、最終 `git status --short` を明記すること。

## 13. 電子カルテ・ORCA連携 最上位仕様

### 13.1 正本境界

次は ORCA / WebORCA が正本である。OpenDolphinNext 側で独立正本として作成・更新・削除してはならない。

- 患者番号
- 患者基本情報
- 保険情報
- 公費情報
- 保険組合せ
- 受付
- 診療科
- ORCA受付に紐づく担当医・担当者情報
- 病名
- 診療行為
- 算定
- 会計
- 収納
- 領収
- レセプト
- 請求関連情報

OpenDolphinNext 側で保持できるのは、表示キャッシュ、診療時点スナップショット、送信候補、ORCAリクエスト、ORCAレスポンス、警告、エラー、不一致、UNKNOWN、監査ログに限る。

次は OpenDolphinNext が正本である。

- 診療録本文
- SOAP
- 診療経過
- 所見
- 医師の判断
- 患者への説明内容
- 処方指示の記録
- 処方変更・中止・取消・再発行の記録
- 診療録に添付・紐付く文書
- 診療録確定履歴
- 診療録訂正・追記・取消・無効化履歴
- ORCA送信候補
- ORCA送信リクエスト
- ORCAレスポンス
- ORCA警告
- ORCAエラー
- ORCA不一致
- ORCA監査ログ
- ORCAから取得した患者・受付・保険・病名・会計情報の参照スナップショット

ORCA送信成功だけをもって診療録確定としてはならない。診療録確定、処方確定、ORCA送信、診察終了、会計送信は別概念として管理する。

### 13.2 ORCA連携APIの原則

ORCA連携は必ずサーバー側アダプタを経由する。WebクライアントからORCA APIを直接呼んではならない。

原則として次の公式API系統を使う。

- 患者基本情報取得: `patientgetv2`
- 患者作成・更新: `patientmodv2`
- 受付: `acceptmodv2`, `acceptlstv2`
- 病名取得: `diseasegetv2?class=01` 相当
- 病名追加・変更・削除・転帰更新: `diseasev3` 相当
- 診療行為・処方・算定候補送信: `medicalmodv2` 相当
- 会計・収納・領収・帳票・請求関連情報: ORCA公式API経由の参照cacheまたはsnapshot

禁止する方式:

- CLAIM連携への新規依存
- `diseasev2` への新規依存
- ORCA DB直接参照
- ORCA DB直接更新
- Web clientから `/api01rv2`, `/orca22`, `/api21` などの生ORCA pathへ到達する構成
- ORCA URL、Basic認証、証明書、証明書パスワードのブラウザ露出

### 13.3 診療録仕様

診療録には少なくとも次の状態を持たせる。

- DRAFT
- FINAL
- AMENDED
- ADDENDUM
- CANCELLED
- VOIDED

FINAL以後は、本文、SOAP、所見、説明内容、タイトル、添付文書を直接更新してはならない。変更は必ず訂正、追記、取消、無効化のeventとして追加する。

診療録確定時には、少なくとも次を保存する。

- 入力者
- 代行入力者
- 医師確定者
- 確定日時
- 作成日時
- 更新日時
- 対象患者
- 診療日
- ORCA患者番号
- ORCA受付ID
- 診療科
- 担当医
- 保険組合せ
- 確定時点のORCA患者snapshot
- 確定時点のORCA受付snapshot
- 確定時点のORCA保険snapshot
- 確定時点のORCA病名snapshot
- 確定時点の処方指示snapshot
- 確定時点のORCA送信候補snapshot
- 確定時点のORCA警告・不一致snapshot

### 13.4 処方指示仕様

処方指示は OpenDolphinNext 側の正本として構造化保存する。少なくとも次を保存する。

- 薬剤名
- 薬剤コード
- 規格
- 剤形
- 用法
- 用量
- 単位
- 日数
- 院内 / 院外
- 内服 / 外用 / 注射
- 頓用
- コメント
- 入力者
- 代行入力者
- 確定者
- 確定日時
- 変更、中止、取消、再発行、再送信の履歴

確定済み処方指示を直接上書きしてはならない。ORCA送信結果で処方指示を無断変更してはならない。

### 13.5 ORCA送信状態・冪等性

ORCA送信には必ず idempotency key を持たせる。

次の状態を区別する。

- DRAFT
- READY_TO_SEND
- SENDING
- SENT
- ORCA_ACCEPTED
- ORCA_WARNING
- ORCA_REJECTED
- ORCA_UNMATCHED
- UNKNOWN
- NEEDS_REVIEW
- RETRY_REQUESTED
- CANCEL_REQUESTED
- CANCELLED

UNKNOWNは成功ではない。
UNKNOWN状態では、ORCA側再取得、照合、手動確認、再送可否判断を経るまで、登録済み、会計済み、反映済みとして表示してはならない。

### 13.6 監査ログ・真正性

次の操作は必ず監査ログに残す。

- ログイン
- ログアウト
- 患者閲覧
- 診療録作成
- 診療録更新
- 診療録確定
- 訂正
- 追記
- 取消
- 無効化
- 処方作成
- 処方確定
- 処方変更
- 処方中止
- 処方取消
- 処方再発行
- ORCA送信
- ORCA再送
- ORCA送信取消
- ORCA警告確認
- ORCA不一致確認
- 会計送信
- 監査ログ閲覧

監査ログには少なくとも次を含める。

- 操作者
- 対象患者
- 対象診療録
- 対象処方
- 操作時刻
- 操作種別
- 変更前後
- 端末情報
- request id
- ORCA連携結果
- payload hash
- previous hash
- event hash

監査ログはappend-onlyとし、一般ユーザーが更新・削除できないようにする。可能な限りhash chain等の改ざん検知を実装する。

### 13.7 Web UI 医療安全仕様

主要画面では患者識別情報を常時表示する。少なくとも次を確認できること。

- 患者番号
- 氏名
- 生年月日
- 性別
- 年齢
- 受付日
- 診療科
- 担当医
- 保険組合せ
- ORCA受付ID
- ORCA由来情報の取得日時

重大操作モーダルには患者識別情報を再掲する。

重大操作には確認フローを置く。

- 診療録確定
- 診療録訂正
- 診療録取消
- 処方確定
- 処方変更
- 処方中止
- 処方取消
- ORCA送信
- 再送
- 診察終了
- 会計送信

ORCA警告、エラー、不一致、ORCA側のみ存在する情報、送信失敗、UNKNOWN、保留を初期非表示にしてはならない。

フォームでは以下を守る。

- labelを必ず置く
- 必須 / 任意を示す
- 入力条件をsupport textで示す
- placeholderで説明を代用しない
- エラーは原因と次に取るべき行動を具体的に示す
- disabledボタンに安易に頼らない
- disabledを使う場合は、直近に理由と有効化条件を明示する
- 入力値変更だけで突然ORCA送信、画面遷移、ダイアログ表示を行わない

## 14. レビュー・実装時の必須ゲート

### 14.1 Criticalとして扱う危険経路

次を見つけた場合はCriticalまたはHighとして扱い、原則として同一作業内で塞ぐ。

- ORCA正本情報をlocal正本化するAPI
- local患者CRUD
- local病名CRUD
- ORCA DB直接参照・直接更新
- CLAIM連携への新規依存
- `diseasev2` への新規依存
- Web clientからORCA APIを直接呼ぶ実装
- ORCA認証情報のブラウザ露出
- 確定済み診療録の直接上書き
- 確定済み処方指示の直接上書き
- ORCA送信失敗を登録済み・会計済み扱いする実装
- UNKNOWNを成功扱いする実装
- 患者識別情報なしで重大操作できるUI
- ORCA警告・不一致・ORCA側のみ情報を利用者に見せないUI
- 監査ログなしの診療録確定、処方確定、ORCA送信、会計送信

### 14.2 必須テスト

該当する変更では、最低限次のテストを追加または更新する。

- ORCA正本領域のlocal CRUDが本番到達不能であること
- Web clientからORCA APIへ直接到達できないこと
- ブラウザbundleにORCA認証情報が含まれないこと
- ORCA送信失敗時に反映済み扱いしないこと
- UNKNOWN状態を成功扱いしないこと
- 確定済み診療録を直接上書きできないこと
- 確定済み診療録タイトルを直接更新できないこと
- 確定済み処方指示を直接上書きできないこと
- 診療録確定時snapshotが保存されること
- ORCA警告、不一致、ORCA側のみ情報が保存・表示されること
- idempotency key により二重送信を防止すること
- 監査ログがappend-onlyであること
- 重大操作モーダルに患者識別情報が表示されること
- disabled理由、フォームラベル、support text、具体的エラーが表示されること
- placeholderで説明を代用していないこと
- 重要情報をaccordion/details/disclosure内だけに隠していないこと

### 14.3 実ORCA確認が必要な場合

ORCA連携の実動作確認が必要な場合は、`docs/operations/ORCA_CERTIFICATION_ONLY.md` と `docs/operations/orca-unknown-state-runbook.md` に従う。

公開TrialのBasic値や認証情報は、repo、review package、実行ログ、summary、test fixtureにraw値で残さない。証跡では set/unset、sanitized classification、接続先種別だけを記録する。

---
**「ユーザーは君の成功を待っている。言い訳ではなく、成果を届けよ。」**

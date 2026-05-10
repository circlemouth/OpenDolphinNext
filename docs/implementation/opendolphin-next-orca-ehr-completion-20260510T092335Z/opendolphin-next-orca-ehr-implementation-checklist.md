# OpenDolphinNext ORCA連携電子カルテ成立要件 実装チェックリスト

- Status: active implementation checklist
- RUN_ID: `20260510T092335Z`
- Created: 2026-05-10
- Scope: `web-client/`, `server-modernized/`, `domain/`, `api-contract/`, `persistence/`, `reporting/`, `docs/`, `ops/`, `scripts/`, `tests/`
- Legacy reference only: `client/`, `server/`

## 0. 目的

OpenDolphinNext を ORCA / WebORCA 連携電子カルテとして本番運用可能にするため、正本境界、ORCA連携、診療録真正性、処方指示、会計連携、監査ログ、UI医療安全、テストの不足を解消する。

本ドキュメントは、後方互換性を考慮しない新規本番設計を前提とする。過去DB遺産、旧CLAIM連携、ローカル正本化された患者・病名・会計データは維持対象としない。

ORCA API は患者取得・受付・診療行為・病名・患者登録・収納情報などの公式 API 領域に分かれる前提で扱う。病名は `diseasegetv2` と `diseasev3`、診療行為・処方・算定候補は `medicalmodv2` を正規連携口とする。

参照:

- [ORCA API仕様 overview](https://www.orca.med.or.jp/receipt/users/tec/api/overview.html)
- [ORCA 患者病名登録2 diseasev3](https://www.orca.med.or.jp/receipt/users/tec/api/diseasemod2.html)
- [ORCA 中途終了データ作成 medicalmodv2](https://www.orca.med.or.jp/receipt/users/tec/api/medicalmod.html)

## 1. 完了条件

- [ ] ORCA正本領域を OpenDolphinNext 側で独立正本として作成・更新・削除できない。
- [ ] OpenDolphinNext正本領域である診療録本文、SOAP、所見、説明内容、処方指示記録、文書、確定履歴、訂正・追記・取消履歴が不変性を持って保存される。
- [ ] 診療録確定と ORCA送信結果が別概念として管理される。
- [ ] ORCA患者・受付・保険・病名・診療行為・会計・収納・領収・レセプトは、取得キャッシュ、診療時点スナップショット、送信候補、レスポンス、照合結果、監査ログとしてのみ保存される。
- [ ] Webクライアントは ORCA API を直接呼ばず、ORCA認証情報、接続URL、証明書情報を保持しない。
- [ ] ORCA送信成功、失敗、警告、不一致、他端末使用中、患者不在、通信失敗、証明書異常が区別され、UIと監査ログに残る。
- [ ] 患者取り違え防止、重大操作確認、警告表示、エラー表示が DADSルールに基づいて実装される。
- [ ] 実ORCA接続試験、ORCAモック試験、ユニット試験、統合試験、E2E試験、監査ログ試験、UI安全試験がCIで確認できる。

## 2. 正本境界の再定義

### 2.1 ORCA正本領域

- [ ] 患者番号、患者基本情報、保険情報、公費情報、保険組合せ、受付、診療科、ORCA受付に紐づく担当医・担当者、病名、診療行為、算定、会計、収納、領収、レセプト、請求関連情報は ORCA / WebORCA を唯一の正本と定義する。
- [ ] OpenDolphinNext 側では ORCA正本情報を表示用キャッシュ、診療時点スナップショット、ORCA送信候補、ORCA送信リクエスト、ORCAレスポンス、警告・エラー・不一致情報、差分照合結果、連携状態、監査ログに限定して保存する。
- [ ] ORCA正本情報を保存するテーブルには `source_system=ORCA`, `orca_patient_id`, `orca_acceptance_id` または受付複合キー, `perform_date`, `department_code`, `physician_code`, `insurance_combination_number`, `fetched_at`, `source_api`, `source_request_id`, `source_trace_id`, `cache_expires_at`, `snapshot_reason`, `snapshot_created_at` を持たせる。

### 2.2 OpenDolphinNext正本領域

- [ ] 診療録本文、SOAP、診療経過、所見、医師の判断、患者への説明内容、処方指示の記録、処方変更・中止・取消の記録、診療録に添付・紐付く文書、診療録確定履歴、診療録訂正・追記・取消履歴、ORCA送信候補、ORCA連携ログ、ORCA由来情報の診療時点スナップショットは OpenDolphinNext を正本と定義する。
- [ ] OpenDolphinNext正本情報は ORCAレスポンスによって直接上書きしない。
- [ ] ORCA送信結果は診療録や処方指示の状態ではなく連携結果として紐付ける。
- [ ] 診療録確定と ORCA会計送信を1つの操作に混同しない。

## 3. 既存ローカル正本化機能の撤去・置換

### 3.1 患者ローカル正本の撤去

- [x] `/api/local/patients/mutation` を廃止する。
- [ ] OpenDolphinNext 側だけで患者を作成・更新する API を削除する。
- [ ] 患者作成・更新は ORCA `patientmodv2` 相当のサーバーアダプタ経由に一本化する。
- [ ] 患者取得は ORCA `patientgetv2` または患者一覧系 API を経由する。
- [ ] `d_patient` 相当のテーブルはローカル正本ではなく `orca_patient_cache` に再設計する。
- [ ] 患者キャッシュには取得日時、取得API、ORCA患者番号、ORCAレスポンス要約、最終照合日時を保存する。
- [ ] 患者キャッシュ更新失敗時に古いキャッシュを現在の正本として表示しない。
- [ ] UI上で古い患者キャッシュには「ORCA再取得未完了」「取得日時」を表示する。

### 3.2 保険・公費・保険組合せローカル正本の撤去

- [ ] `d_health_insurance` 相当のテーブルをローカル正本として使用しない。
- [ ] 保険情報は `orca_insurance_cache` と `encounter_insurance_snapshot` に分離する。
- [ ] 保険組合せ番号を診療日、受付、診療科、患者番号とセットで保持する。
- [ ] 保険変更後に過去の診療録スナップショットを上書きしない。
- [ ] 保険変更後の ORCA送信では、送信前に保険組合せ差分を表示する。

### 3.3 受付ローカル正本の撤去

- [ ] `d_patient_visit` 相当の受付情報を ORCA受付正本として扱わない。
- [ ] ORCA受付情報は `orca_acceptance_cache` として保存する。
- [ ] 院内ワークフロー状態は `encounter_workflow_state` として別管理する。
- [ ] `encounter_workflow_state` は `NOT_STARTED`, `IN_PROGRESS`, `CHART_DRAFT`, `CHART_FINALIZED`, `ORCA_SEND_PREPARED`, `ORCA_SENDING`, `ORCA_SENT`, `ORCA_FAILED`, `ORCA_NEEDS_REVIEW`, `BILLING_WAITING`, `CLOSED` に限定する。
- [ ] ORCA受付取消時に `encounter_workflow_state` を自動削除しない。
- [ ] ORCA受付取消時は `ORCA_ACCEPTANCE_CANCELLED` の連携イベントを作成し、診療録側には警告を出す。
- [ ] ORCA受付が存在しない診療録は ORCA送信不可とする。
- [ ] ORCA受付が存在しない診療録を確定できるかどうかは運用設定で制御する。

### 3.4 病名ローカル正本の撤去

- [ ] `d_diagnosis` 相当のローカル病名正本テーブルを廃止する。
- [x] `/api/local/diagnoses` の作成・更新・削除APIを廃止する。
- [x] 病名は `orca_disease_cache`, `orca_disease_snapshot`, `orca_disease_operation`, `orca_disease_audit_event` に分離する。
- [ ] ORCA病名取得は `diseasegetv2?class=01` 相当に統一する。
- [ ] ORCA病名更新は `diseasev3` 相当に統一する。
- [ ] `diseasev2`、CLAIM、ORCA DB直接参照による病名正本化を廃止する。
- [ ] ORCA送信失敗時にローカル病名を登録済みと表示しない。
- [ ] 診療録本文中の病名記載と ORCA病名を UI/API/DB で分離する。

## 4. 新DB設計

- [ ] `orca_patient_cache` を作成し、ORCA患者ID、内部患者参照、氏名、カナ、生年月日、性別、住所/電話要約、source metadata、取得日時、cache expiry、raw response hash、normalized payload を保存する。
- [ ] `orca_acceptance_cache` を作成し、ORCA患者ID、受付日/時刻/番号、診療科、担当医、保険組合せ、受付状態、source metadata、取消日時、normalized payload を保存する。
- [ ] `encounter_insurance_snapshot` を作成し、encounter/chart revision、ORCA患者ID、受付日、保険組合せ、保険/公費要約、snapshot reason を固定する。
- [ ] `chart_document`, `chart_revision`, `chart_revision_event`, `chart_module`, `chart_attachment` を作成または再設計する。
- [ ] `chart_revision.status` は `DRAFT`, `FINAL`, `AMENDED`, `ADDENDUM`, `CANCELLED`, `VOIDED` に限定する。
- [ ] `FINAL` 以降の本文、SOAP、モジュール、タイトルを直接更新不可にする。
- [ ] 確定済み文書の訂正・追記・取消は新 revision/event として扱い、原文を物理削除しない。
- [ ] `prescription_order`, `prescription_order_revision`, `prescription_order_event`, `prescription_order_item`, `prescription_orca_transmission` を作成または再設計する。
- [ ] 処方状態は `DRAFT`, `FINAL`, `CHANGED`, `STOPPED`, `CANCELLED`, `REISSUED` に限定する。
- [ ] 確定済み処方を直接上書き不可にし、変更・中止・取消・再発行はイベントとして保存する。
- [ ] `orca_operation`, `orca_transmission`, `orca_response_summary`, `orca_reconciliation_result` を作成する。
- [ ] ORCA operation status は `PREPARED`, `READY_TO_SEND`, `SENDING`, `ORCA_ACCEPTED`, `ORCA_REJECTED`, `ORCA_WARNING`, `ORCA_UNMATCHED`, `ORCA_CONFLICT`, `NETWORK_FAILED`, `CERTIFICATE_FAILED`, `AUTH_FAILED`, `UNKNOWN`, `NEEDS_REVIEW`, `CANCELLED` に限定する。
- [ ] 同一 `idempotency_key` の二重送信をサーバー側で拒否する。
- [ ] `UNKNOWN` は成功扱いせず、ORCA再照合完了まで UI に要確認として表示する。
- [ ] `authoritative_audit_event` を append-only / hash chain 付きに再設計または拡張する。
- [ ] 監査ログに ORCA認証情報、証明書パスワード、Basic認証文字列を保存しない。
- [ ] ORCA raw XML を保存する場合は暗号化し、アクセス権限を限定する。

## 5. ORCA連携アダプタ

- [ ] `OrcaClient` を唯一の ORCA通信口にする。
- [ ] Webクライアントから ORCA URL へ直接到達できないようにする。
- [ ] Vite開発プロキシから `/orca22`, `/api01rv2`, `/api21` 等の生ORCAプロキシを削除する。
- [ ] ORCA接続URL、Basic認証、クライアント証明書、証明書パスワードはサーバー側設定だけに置く。
- [ ] ORCA通信はすべてサーバー側の監査対象にする。
- [ ] APIごとに `OrcaPatientAdapter`, `OrcaAcceptanceAdapter`, `OrcaInsuranceAdapter`, `OrcaDiseaseAdapter`, `OrcaMedicalAdapter`, `OrcaIncomeAdapter`, `OrcaReportAdapter`, `OrcaSystemAdapter` を分離する。
- [ ] `OrcaApiResult` を作成し、result code/message、business/transport status、warnings、errors、unmatched、ORCA only、renumbered/reassigned identifiers、needsUserReview、perform date、department、physician、insurance combination、raw hash、normalized response を持たせる。
- [ ] ORCAレスポンスを成功/失敗だけに変換しない。
- [ ] `Api_Result=000` でも警告・不一致があれば `needsUserReview=true` にする。
- [ ] 他端末使用中、患者不在、通信失敗、証明書異常、認証失敗、XML不正、ORCA警告、ORCA不一致を別 status として扱う。
- [ ] xml2 / UTF-8 を明示し、XML生成時に患者番号、診療日、診療科、医師、保険組合せを必須検証する。
- [ ] XMLパーサは未知フィールドを破棄せず、監査用に要約または hash を保存する。
- [ ] Adapter ごとに contract test と ORCA API mock を持つ。

## 6. 患者・受付・保険実装

- [ ] `GET /api/orca/official/patientgetv2?id={orcaPatientId}&format=json` または同等の official patient read wrapper を実装し、ORCA患者取得、`orca_patient_cache` 保存、取得日時、sourceSystem、cacheStatus、stale を返す。
- [ ] 患者不在時は単純な HTTP 404 ではなく業務エラー `ORCA_PATIENT_NOT_FOUND` として扱う。
- [ ] `POST /api/orca/official/patientmodv2/outpatient/create` と `POST /api/orca/official/patientmodv2/outpatient/update` を唯一の患者 mutation route とし、送信前差分と送信後再取得を強制する。
- [ ] ORCA送信失敗時にローカル患者情報を更新済みにしない。
- [ ] 患者削除は原則実装しない。
- [ ] `GET /api/orca/official/appointments/list?date=...` と `GET /api/orca/official/appointments/patient?...` を受付取得 route として実装する。
- [ ] 受付取得結果を `orca_acceptance_cache` に保存し、ORCA患者番号、受付日、診療科、担当医、保険組合せを保持する。
- [ ] `encounter_id` と ORCA受付情報の紐付けテーブルを作る。
- [ ] ORCA受付取消、診療科・担当医・保険組合せ変更を検知して診療録画面に警告/差分を表示する。
- [ ] 保険情報取得結果を `orca_insurance_cache` に保存し、診療録確定時に `encounter_insurance_snapshot` を作る。
- [ ] 保険組合せ未選択や保険変更後の再送では、押下時に具体理由と差分を表示する。

## 7. 診療録正本実装

- [ ] 診療録状態 `DRAFT`, `FINAL`, `AMENDED`, `ADDENDUM`, `CANCELLED`, `VOIDED` を実装する。
- [ ] `FINAL` は本文、SOAP、所見、説明内容、添付文書、タイトルを直接編集不可にする。
- [ ] `POST /api/charts/{chartId}/revisions/{revisionId}/finalize` を実装する。
- [ ] 確定時に患者番号、氏名、生年月日、性別、診療日、ORCA受付IDまたは受付なし理由、診療科、担当医、保険組合せ、確定者、代行入力者、本体内容を必須検証する。
- [ ] 確定時に患者・受付・保険・病名・処方候補・算定候補のスナップショットと `content_hash` を作る。
- [ ] `entered_by` と `finalized_by` を分離し、代行入力時は `entry_mode=DELEGATED` を保存する。
- [ ] `POST /api/charts/{chartId}/revisions/{revisionId}/amend|addendum|cancel` を実装し、理由必須、変更前後要約、監査ログを保存する。
- [ ] PDF/CSV/JSON エクスポートは訂正・追記・取消履歴、処方指示履歴、ORCA連携履歴、診療時点スナップショットを含める。

## 8. 処方指示正本実装

- [ ] `POST /api/prescriptions` を実装し、診療録リビジョンに紐付く `DRAFT` 処方指示を作成する。
- [ ] 薬剤コード、薬剤名、規格、剤形、用法、用量、単位、日数、院内/院外、内服/外用/注射/頓用、一般名処方フラグ、医師コメント、入力者、作成日時を保存する。
- [ ] `POST /api/prescriptions/{prescriptionId}/finalize` を実装し、確定者、確定日時、処方内容 hash を保存する。
- [ ] 確定済み処方の直接更新を禁止し、処方確定は診療録確定とは別操作にする。
- [ ] `change`, `stop`, `cancel`, `reissue` をイベントとして実装し、理由と変更前後内容を保存する。
- [ ] `POST /api/local/orca/medical-candidates/from-chart/{chartRevisionId}` を local candidate route として実装し、診療録・処方指示から ORCA送信候補を作る。
- [ ] 送信候補作成時に変換不能項目や ORCAコード未解決項目を `NEEDS_REVIEW` / 送信不可にする。
- [ ] `POST /api/local/orca/medical-operations/prepare` と official `POST /api/orca/official/chart-support/medical-mod-v2` を組み合わせ、prepare/send の分離と `medicalmodv2` 相当の送信を実装する。
- [ ] 送信前確認に患者、受付、診療科、医師、保険組合せ、候補を表示し、送信後に ORCA側結果を再取得・差分照合する。

## 9. 病名ORCA連携実装

- [ ] `GET /api/local/diagnoses/{patientId}?baseMonth=...` の ORCA mirror read model、または official read wrapper を通じて ORCA `diseasegetv2?class=01` 相当から取得する。
- [x] 取得結果を `orca_disease_cache` に保存し、取得日時、基準月、診療科、保険組合せ、ORCA患者番号、stale を保持する。
- [ ] local prepare route と official `POST /api/orca/official/chart-support/disease-mod-v3` を組み合わせ、ORCA `diseasev3` 相当に送信する。
- [ ] 旧 `diseasev2`、CLAIM病名送信、ORCA DB直接更新/参照を使わない。
- [ ] `OrcaDiseaseMutationRequest` は operation、ORCA患者ID、基準月、診療日、診療科、医師、保険組合せ、病名コード、補足コード、疑い、開始/終了日、転帰、カルテ名、病名区分、レセプト表示、保険病名、主病名/副病名を持つ。
- [ ] `OrcaDiseaseMutationResponse` は result、warnings、unmatched、orcaOnly、renumbered、needsUserReview、operationStatus を持つ。
- [ ] 警告、不一致、ORCAのみ病名、連番付け替え情報を無視しない。
- [ ] ORCA送信成功後に必ず病名を再取得し、再取得結果だけを ORCA病名表示の根拠にする。
- [ ] 病名 UI は「ORCA登録病名」「診療録本文中の病名記載」「未送信候補」を分離し、入力だけで ORCA送信しない。

## 10. 診療行為・会計・収納・レセプト

- [ ] 診療録・処方指示から `orca_medical_candidate` を作成し、ORCA正本ではないことを明示する。
- [ ] `medicalmodv2` 相当の送信では患者番号、診療日、診療科、医師コード、保険組合せ、ORCA受付存在、患者/保険情報 freshness、会計済み衝突を検証する。
- [ ] ORCAレスポンスを構造化保存し、送信後に ORCA側診療行為情報を再取得して差分表示する。
- [ ] ORCA会計情報取得 API をサーバーアダプタ経由で呼び、`orca_billing_cache` に保存する。
- [ ] OpenDolphinNext 側で会計金額や収納済み状態を独立更新できる API を作らない。
- [ ] 領収書・請求書は ORCA帳票取得結果として扱い、帳票取得履歴を監査ログに保存する。
- [ ] レセプト情報を OpenDolphinNext 正本として持たず、ORCA由来キャッシュまたは帳票スナップショットとして扱う。

## 11. Webクライアント医療安全UI

- [ ] 主要画面に患者ヘッダーを常時表示し、ORCA患者番号、内部参照ID、氏名、カナ、生年月日、年齢、性別、受付日、診療科、担当医、保険組合せ、ORCA取得日時、キャッシュ状態を表示する。
- [ ] モーダル内の重大操作確認にも患者識別情報を再掲する。
- [ ] 診療録確定/訂正/取消、処方確定/中止/取消、病名ORCA送信、診療行為ORCA送信、会計送信、診察終了に確認フローを実装する。
- [ ] 「診療録確定」「会計へ送信」「診察終了」「ORCA送信成功」を別概念として表示する。
- [ ] 成功、失敗、警告、情報、要確認をセマンティックに分け、原因と次に取るべき行動を示す。
- [ ] ORCA警告、不一致、ORCA側のみ存在する情報を隠さない。
- [ ] 全フォームにラベル、必須/任意、サポートテキスト、具体的エラーを持たせる。
- [ ] 入力値変更だけで ORCA送信、突然のダイアログ、画面遷移をしない。
- [ ] `disabled` に頼らず、押下後に不足条件を表示する。やむを得ず `disabled` を使う場合は理由と有効化条件を近くに表示する。
- [ ] ボタン優先度、配置、44px以上の押下領域を DADS に沿って統一する。

## 12. 監査ログ・真正性

- [ ] ログイン、ログアウト、患者閲覧、診療録作成/保存/確定/訂正/追記/取消、文書添付/削除、処方作成/確定/変更/中止/取消/再発行、ORCA患者/受付/保険/病名取得、ORCA病名/診療行為送信、ORCA会計/帳票取得、ORCA送信失敗/再送/取消、エラー、権限拒否を記録する。
- [ ] 監査ログは操作者、ロール、対象患者、ORCA患者番号、診療録、処方、ORCA操作、時刻、操作種別、変更前後要約、端末情報、IP/user-agent hash、request/trace ID、ORCA連携結果、警告/エラー/不一致要約、event hash、previous hash を保存する。
- [ ] 監査ログは append-only とし、削除/更新 API を作らない。
- [ ] 一般ユーザーと管理者のいずれも監査ログ改ざんができない設計にする。
- [ ] hash chain 検証バッチ、バックアップ、復元手順を実装・文書化する。

## 13. セキュリティ

- [ ] ORCA接続URL、Basic認証、クライアント証明書、証明書パスワードはサーバー秘密情報ストアに限定する。
- [ ] ORCA認証情報をフロント環境変数、ブラウザログ、サーバーログ、監査ログ、テストスナップショットに出さない。
- [ ] サーバーログ、ブラウザコンソール、エラーレスポンス、監査ログに患者情報を過剰に出さない。
- [ ] PHI を含むテーブル、PDF/エクスポート、添付文書の権限を制御する。
- [ ] 患者閲覧、診療録作成/確定/訂正、処方入力/確定、ORCA患者更新、ORCA病名送信、ORCA診療行為送信、ORCA会計情報閲覧、監査ログ閲覧の権限を定義する。

## 14. 保存性・見読性・バックアップ

- [ ] 診療録、訂正履歴、追記履歴、取消履歴、処方指示履歴、ORCA連携履歴、ORCA送信失敗履歴、ORCA警告・不一致履歴を Web画面で表示できる。
- [ ] 診療録を印刷/PDF出力できる。
- [ ] 患者単位、診療日単位、期間指定でエクスポートできる。
- [ ] エクスポート対象に診療録本文、SOAP、処方指示、訂正・追記・取消履歴、ORCA連携履歴、ORCA由来スナップショットを含める。
- [ ] 診療録正本DB、監査ログDB、添付文書ストレージのバックアップ手順を実装する。
- [ ] ORCAキャッシュは復元対象だが正本ではないことを明記する。
- [ ] 復元後に監査ログ hash chain と診療録 content hash を検証する。
- [ ] ORCA障害時でも OpenDolphinNext 正本データを閲覧できるようにする。

## 15. テスト実装

- [ ] 患者キャッシュ metadata、ローカル患者/病名 CRUD 不在、確定済み診療録/タイトル/処方の直接更新不可、訂正/追記/取消/処方変更イベント、ORCA送信失敗、warning/unmatched、監査 hash chain の unit test を実装する。
- [ ] ORCA adapter の患者取得/不在、受付一覧/取消、保険、病名取得/追加/変更/削除/転帰/警告/不一致/ORCA側のみ、診療行為送信、会計/帳票、他端末使用中、通信断、証明書異常、認証失敗をテストする。
- [ ] 受付取得から診療録作成、確定時 snapshot、処方確定から ORCA候補作成、診療行為送信成功/失敗、病名送信成功/失敗、会計済み衝突、受付取消、保険変更後 snapshot 不変を統合テストする。
- [ ] E2E で患者選択、患者ヘッダー、下書き保存、確定確認、確定後直接編集不可、訂正/追記/取消、処方作成/確定/中止、ORCA送信前確認、成功/失敗/警告/不一致表示、患者取り違え防止、PDF、期間エクスポートを確認する。
- [ ] UI/a11y でラベル、プレースホルダー説明代用禁止、重大操作確認、重要警告初期表示、disabled 理由、キーボード操作、フォーカス、コントラスト、ボタン配置、患者ヘッダー視認性をテストする。
- [ ] セキュリティテストで bundle への ORCA URL/Basic/証明書情報混入、生ORCAパス到達、ログ/監査ログ credential 混入、患者情報過剰エラー、権限なし操作を拒否できることを確認する。

## 16. 運用・設定

- [ ] ORCA接続URL、Basic認証、クライアント証明書、証明書パスワード、timeout、retry、APIごとの有効/無効をサーバー設定にする。
- [ ] 開発環境でもブラウザに ORCA認証情報を渡さない。
- [ ] ORCA接続、証明書期限、DB、監査ログ書き込みの health check を実装する。
- [ ] ORCA障害時は UI に「ORCA連携停止中」を表示しつつ、診療録正本閲覧を可能にする。
- [ ] ORCA送信失敗、`UNKNOWN`, `NEEDS_REVIEW` の一覧画面を作る。
- [ ] 再送前に現在 ORCA状態、前回送信との差分、患者・受付・保険組合せを再確認し、監査ログに保存する。
- [ ] ORCA側で会計済みの場合は再送を原則禁止し、管理者確認フローにする。
- [ ] ORCA障害時の診療録/処方作成可否、会計送信不可表示、復旧後再照合、ネットワーク障害時の `UNKNOWN` 処理、DB障害時読み取り専用モード、復元後 ORCA再照合を文書化する。

## 17. 旧実装・危険経路の削除チェック

- [ ] ローカル患者作成/更新 API を削除する。
- [ ] ローカル病名作成/更新/削除 API を削除する。
- [ ] ORCA DB直接病名参照コード、CLAIM病名送信コード、`diseasev2` 依存を削除する。
- [ ] 診療録確定済みタイトル直接更新経路、確定済み処方 payload 直接上書き経路を削除する。
- [ ] Webクライアントの生ORCAプロキシ設定、ORCA認証情報を扱うフロント設定を削除する。
- [ ] ORCA送信成功を診療録確定と同義に扱う UI 文言、ORCA送信失敗時に登録済み/反映済みと表示する文言、重要警告を初期非表示にする UI を削除または変更する。

## 18. 実ORCA接続試験チェック

- [ ] ORCA患者取得正常系/不在/更新成功/更新失敗を確認する。
- [ ] ORCA受付一覧取得/受付取消/保険組合せ取得を確認する。
- [ ] ORCA病名取得/追加/変更/削除/転帰更新/警告/不一致/ORCA側のみ病名を確認する。
- [ ] ORCA診療行為送信成功/警告/失敗、他端末使用中、会計情報、収納情報、帳票取得を確認する。
- [ ] 通信断後の再送、timeout 後の `UNKNOWN`、二重クリックで二重送信されないこと、サーバー再起動後の送信状態復元を確認する。

## 19. リリース判定チェック

- [ ] ORCA正本領域のローカル CRUD が残っていない。
- [ ] 診療録確定済み直接更新経路、確定済み処方直接更新経路が残っていない。
- [ ] ORCA認証情報がブラウザへ露出しない。
- [ ] ORCA送信に idempotency key がある。
- [ ] ORCA警告・エラー・不一致が UI と監査ログに保存される。
- [ ] 患者ヘッダーが主要画面に表示され、重大操作に確認フローがある。
- [ ] 診療録 PDF 出力と期間エクスポートができる。
- [ ] 監査ログ hash chain 検証ができる。
- [ ] 実ORCA接続試験、ORCAモック試験、DADS観点 UI テストが完了している。
- [ ] 本番運用前に ORCA接続情報、証明書期限監視、DB/監査/添付バックアップ、復元試験、障害時/再送/照合手順、患者取り違え防止 UI、ロール権限、監査ログ閲覧権限を確認する。

## 20. 実装優先順位

### Phase 1: 正本境界の是正

- [ ] ローカル患者CRUDを廃止する。
- [ ] ローカル病名CRUDを廃止する。
- [ ] Webクライアントの生ORCAプロキシを廃止する。
- [ ] ORCAアダプタをサーバー側に一本化する。
- [ ] 診療録確定済み直接更新経路を封じる。
- [ ] 処方指示の正本モデルを作る。

### Phase 2: ORCA連携の安全化

- [ ] ORCA共通レスポンスモデルを作る。
- [ ] ORCA操作テーブルを作る。
- [ ] 冪等性と送信状態管理を実装する。
- [ ] 病名 `diseasev3` の警告・不一致パースを実装する。
- [ ] `medicalmodv2` の警告・エラー分類を実装する。
- [ ] ORCA再取得・差分照合を実装する。

### Phase 3: 診療録・処方の真正性

- [ ] 診療録リビジョンモデルを完成させる。
- [ ] 訂正・追記・取消イベントを実装する。
- [ ] 代行入力者と医師確定者を分離する。
- [ ] 処方変更・中止・取消・再発行履歴を実装する。
- [ ] 診療録確定時スナップショットを実装する。

### Phase 4: 医療安全UI

- [ ] 患者ヘッダーを全主要画面に統一実装する。
- [ ] 重大操作確認モーダルを統一実装する。
- [ ] ORCA警告・不一致表示を統一実装する。
- [ ] `disabled` 依存を減らし、理由表示へ変更する。
- [ ] ボタン優先度・配置をDADS基準に統一する。

### Phase 5: 保存性・監査・運用

- [ ] 監査ログをappend-only化する。
- [ ] hash chain検証を実装する。
- [ ] PDF・印刷・期間エクスポートを完成させる。
- [ ] バックアップ・復元手順を整備する。
- [ ] 実ORCA接続試験を完了する。
- [ ] 本番運用手順書を整備する。

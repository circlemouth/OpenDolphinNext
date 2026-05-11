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
- [x] OpenDolphinNext 側だけで患者を作成・更新する API を削除する。
- [x] 患者作成・更新は ORCA `patientmodv2` 相当のサーバーアダプタ経由に一本化する。
- [x] 患者取得は ORCA `patientgetv2` または患者一覧系 API を経由する。
- [ ] `d_patient` 相当のテーブルはローカル正本ではなく `orca_patient_cache` に再設計する。
- [x] 患者キャッシュには取得日時、取得API、ORCA患者番号、ORCAレスポンス要約、最終照合日時を保存する。
- [x] 患者キャッシュ更新失敗時に古いキャッシュを現在の正本として表示しない。
- [ ] UI上で古い患者キャッシュには「ORCA再取得未完了」「取得日時」を表示する。

### 3.2 保険・公費・保険組合せローカル正本の撤去

- [ ] `d_health_insurance` 相当のテーブルをローカル正本として使用しない。
- [x] 保険情報は `orca_insurance_cache` と `encounter_insurance_snapshot` に分離する。
- [x] 保険組合せ番号を診療日、受付、診療科、患者番号とセットで保持する。
- [x] 保険変更後に過去の診療録スナップショットを上書きしない。
- [ ] 保険変更後の ORCA送信では、送信前に保険組合せ差分を表示する。

### 3.3 受付ローカル正本の撤去

- [ ] `d_patient_visit` 相当の受付情報を ORCA受付正本として扱わない。
- [x] ORCA受付情報は `orca_acceptance_cache` として保存する。
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
- [x] `diseasev2`、CLAIM、ORCA DB直接参照による病名正本化を廃止する。
- [ ] ORCA送信失敗時にローカル病名を登録済みと表示しない。
- [ ] 診療録本文中の病名記載と ORCA病名を UI/API/DB で分離する。

## 4. 新DB設計

- [x] `orca_patient_cache` を作成し、ORCA患者ID、内部患者参照、氏名、カナ、生年月日、性別、住所/電話要約、source metadata、取得日時、cache expiry、raw response hash、normalized payload を保存する。
- [x] `orca_acceptance_cache` を作成し、ORCA患者ID、受付日/時刻/番号、診療科、担当医、保険組合せ、受付状態、source metadata、取消日時、normalized payload を保存する。
- [x] `encounter_insurance_snapshot` を作成し、encounter/chart revision、ORCA患者ID、受付日、保険組合せ、保険/公費要約、snapshot reason を固定する。
- [ ] `chart_document`, `chart_revision`, `chart_revision_event`, `chart_module`, `chart_attachment` を作成または再設計する。
  - [x] `chart_document`, `chart_revision`, `chart_revision_event` の最小 schema と JPA entity を追加した。`chart_module` / `chart_attachment` の詳細再設計は後続 revision/export 実装で継続確認する。
- [x] `chart_revision.status` は `DRAFT`, `FINAL`, `AMENDED`, `ADDENDUM`, `CANCELLED`, `VOIDED` に限定する。
- [x] `FINAL` 以降の本文、SOAP、モジュール、タイトルを直接更新不可にする。
- [ ] 確定済み文書の訂正・追記・取消は新 revision/event として扱い、原文を物理削除しない。
- [x] `prescription_order`, `prescription_order_revision`, `prescription_order_event`, `prescription_order_item`, `prescription_orca_transmission` を作成または再設計する。
- [x] 処方状態は `DRAFT`, `FINAL`, `CHANGED`, `STOPPED`, `CANCELLED`, `REISSUED` に限定する。
- [x] 確定済み処方を直接上書き不可にし、変更・中止・取消・再発行はイベントとして保存する。
- [x] `orca_operation`, `orca_transmission`, `orca_response_summary`, `orca_reconciliation_result` を作成する。
  - [x] 2026-05-10T21:15Z: 共通 ORCA operation ledger migration を追加し、status / retry / idempotency / request-response hash / sanitized response summary / reconciliation result を raw body・credential なしで永続化する schema test を固定した。
- [x] ORCA operation status は `PREPARED`, `READY_TO_SEND`, `SENDING`, `ORCA_ACCEPTED`, `ORCA_REJECTED`, `ORCA_WARNING`, `ORCA_UNMATCHED`, `ORCA_CONFLICT`, `NETWORK_FAILED`, `CERTIFICATE_FAILED`, `AUTH_FAILED`, `UNKNOWN`, `NEEDS_REVIEW`, `CANCELLED` に限定する。
  - [x] 2026-05-10T21:15Z: `orca_operation` の check constraint と `OrcaOperationLedgerSchemaTest` で不正 status を拒否することを固定した。
- [x] `diseasev3` は server-generated `idempotency_key` の二重送信をサーバー側で拒否する。
- [x] `diseasev3` の transport 例外は `NETWORK_FAILED` / `needsUserReview=true` として operation に保存し、成功扱いにしない。
- [x] `UNKNOWN` は成功扱いせず、ORCA再照合完了まで UI に要確認として表示する。
  - [x] `close-and-send-to-billing` の `ORCA_UNKNOWN` / `operationStatus=UNKNOWN` / `needsUserReview=true` は Charts の診察終了成功に潰さず、会計待ち遷移と患者タブ終了を停止して要確認を初期表示する。
  - [x] 2026-05-10T21:59Z: `medicalmodv2` zero-like response も completion evidence 欠落時は `UNKNOWN` とし、`Medical_Uid` が返った場合も `tmedicalgetv2` read-only 再取得・照合を通過するまで `ORCA_MEDICAL_REGISTERED` に昇格しない server-side fail-closed path を固定した。
- [x] `authoritative_audit_event` を append-only / hash chain 付きに再設計または拡張する。
- [ ] 監査ログに ORCA認証情報、証明書パスワード、Basic認証文字列を保存しない。
- [ ] ORCA raw XML を保存する場合は暗号化し、アクセス権限を限定する。

## 5. ORCA連携アダプタ

- [ ] `OrcaClient` を唯一の ORCA通信口にする。
- [ ] Webクライアントから ORCA URL へ直接到達できないようにする。
- [ ] Vite開発プロキシから `/orca22`, `/api01rv2`, `/api21` 等の生ORCAプロキシを削除する。
- [ ] ORCA接続URL、Basic認証、クライアント証明書、証明書パスワードはサーバー側設定だけに置く。
- [ ] ORCA通信はすべてサーバー側の監査対象にする。
- [ ] APIごとに `OrcaPatientAdapter`, `OrcaAcceptanceAdapter`, `OrcaInsuranceAdapter`, `OrcaDiseaseAdapter`, `OrcaMedicalAdapter`, `OrcaIncomeAdapter`, `OrcaReportAdapter`, `OrcaSystemAdapter` を分離する。
- [x] `OrcaApiResult` を作成し、result code/message、business/transport status、warnings、errors、unmatched、ORCA only、renumbered/reassigned identifiers、needsUserReview、perform date、department、physician、insurance combination、raw hash、normalized response を持たせる。
- [ ] ORCAレスポンスを成功/失敗だけに変換しない。
- [x] `diseasev3` は `Api_Result=000` でも警告・不一致があれば `needsUserReview=true` にする。
- [ ] 他端末使用中、患者不在、通信失敗、証明書異常、認証失敗、XML不正、ORCA警告、ORCA不一致を別 status として扱う。
- [ ] xml2 / UTF-8 を明示し、XML生成時に患者番号、診療日、診療科、医師、保険組合せを必須検証する。
- [ ] XMLパーサは未知フィールドを破棄せず、監査用に要約または hash を保存する。
- [ ] Adapter ごとに contract test と ORCA API mock を持つ。

## 6. 患者・受付・保険実装

- [x] `GET /api/orca/official/patientgetv2?id={orcaPatientId}&format=json` または同等の official patient read wrapper を実装し、ORCA患者取得、`orca_patient_cache` 保存、取得日時、sourceSystem、cacheStatus、stale を返す。
- [x] 患者不在時は単純な HTTP 404 ではなく業務エラー `ORCA_PATIENT_NOT_FOUND` として扱う。
- [x] `POST /api/orca/official/patientmodv2/outpatient/create` と `POST /api/orca/official/patientmodv2/outpatient/update` を唯一の患者 mutation route とし、送信前差分と送信後再取得を強制する。
- [x] ORCA送信失敗時にローカル患者情報を更新済みにしない。
- [x] 患者削除は原則実装しない。
- [ ] `GET /api/orca/official/appointments/list?date=...` と `GET /api/orca/official/appointments/patient?...` を受付取得 route として実装する。
- [x] 受付取得結果を `orca_acceptance_cache` に保存し、ORCA患者番号、受付日、診療科、担当医、保険組合せを保持する。
- [ ] `encounter_id` と ORCA受付情報の紐付けテーブルを作る。
- [ ] ORCA受付取消、診療科・担当医・保険組合せ変更を検知して診療録画面に警告/差分を表示する。
- [ ] 保険情報取得結果を `orca_insurance_cache` に保存し、診療録確定時に `encounter_insurance_snapshot` を作る。
- [ ] 保険組合せ未選択や保険変更後の再送では、押下時に具体理由と差分を表示する。

## 7. 診療録正本実装

- [ ] 診療録状態 `DRAFT`, `FINAL`, `AMENDED`, `ADDENDUM`, `CANCELLED`, `VOIDED` を実装する。
- [ ] `FINAL` は本文、SOAP、所見、説明内容、添付文書、タイトルを直接編集不可にする。
  - [x] 本文 / SOAP / module payload / title / current revision pointer の直接 UPDATE / DELETE は service guard と DB trigger で拒否する。添付文書の詳細 revision/export 連携は B-04 で継続する。
- [x] `POST /api/charts/{chartId}/revisions/{revisionId}/finalize` を実装する。
- [x] 確定時に患者番号、氏名、生年月日、性別、診療日、ORCA受付IDまたは受付なし理由、診療科、担当医、保険組合せ、確定者、代行入力者、本体内容を必須検証する。
  - [x] finalize API skeleton は ORCA患者番号、氏名、生年月日、性別、encounter、診療日、受付IDまたは受付なし理由、診療科、担当医、保険組合せ、確定者、canonical content JSON を必須検証する。代行入力者の永続項目は後続 revision context 拡張で継続する。
  - [x] 保存済み `entered_by_user_id` を代行入力者の authority とし、`entry_mode` / `delegated_by_user_id` は `entered_by_user_id` と `finalized_by_user_id` から server-side に導出・検証する。
- [ ] 確定時に患者・受付・保険・病名・処方候補・算定候補のスナップショットと `content_hash` を作る。
  - [x] server-side canonical content/context から `content_hash` を生成し、FINALIZED event と `chart_revision` に記録する。患者・受付・保険・病名・処方候補・算定候補の full snapshot は B-04 / Worker C-D 連携後に継続する。
  - [x] `snapshot_manifest_json` skeleton を server-side validated context から生成し、ORCA患者番号、encounter、受付IDまたは受付なし理由、診療科、担当医、保険組合せ、後続 snapshot 統合待ち status を hash/export に含める。full snapshot entity 連携は Worker A/C/D 統合後に継続する。
- [x] `entered_by` と `finalized_by` を分離し、代行入力時は `entry_mode=DELEGATED` を保存する。
- [ ] `POST /api/charts/{chartId}/revisions/{revisionId}/amend|addendum|cancel` を実装し、理由必須、変更前後要約、監査ログを保存する。
  - [x] amend/addendum/cancel API skeleton は locked revision のみを対象にし、理由・actor を必須化し、訂正/追記は新 revision と event、取消は event として元 revision を物理更新しない。authoritative audit log 連携は Worker F の audit chain と合わせて継続する。
  - [x] `chart_revision_event` は DB trigger で UPDATE / DELETE を拒否し、理由・変更前後要約・event hash の後書き改ざんを防止する。authoritative audit log 連携は Worker F の audit chain と合わせて継続する。
- [ ] PDF/CSV/JSON エクスポートは訂正・追記・取消履歴、処方指示履歴、ORCA連携履歴、診療時点スナップショットを含める。
  - [x] chart export contract に chart revision events、before/after summary、reason、actor、content hash を含めることを追加した。reporting 実装は B-04 継続。
  - [x] `GET /api/charts/{chartId}/revisions/export` を追加し、施設境界で chart revision JSON export に revision/event 履歴、reason、actor、content hash、allowlist 済み summary を含める。PDF/CSV、処方指示履歴、ORCA連携履歴の統合は Worker C-D / reporting 連携後に継続する。
  - [x] `GET /api/charts/{chartId}/revisions/export.csv` を追加し、JSON export と同じ revision/event 履歴を固定列 CSV として出力する。raw ORCA / credential redaction と spreadsheet formula injection neutralization を通す。PDF と処方/ORCA履歴の統合は B-05 継続。
  - [x] reporting PDF payload の `chartRevisionEvents` を summary section に投影し、訂正・追記・取消履歴の reason、actor、hash、before/after summary を allowlist/redaction 付きで表示できるようにした。処方指示履歴、ORCA連携履歴、診療時点 full snapshot は Worker C-D 統合後に継続する。
  - [x] chart revision JSON/CSV export は server-generated snapshot manifest summary を allowlist/redaction 付きで含める。処方指示履歴、ORCA連携履歴、full snapshot entity は Worker A/C/D 統合後に継続する。
  - [x] chart revision JSON export は allowlist/redaction 済み payload から `exportHash` を計算し、revision/event/snapshot summary の欠落・差し替え検出に使えるようにする。
  - [x] chart revision JSON export の `exportHash` は allowlist 順の canonical projection を使い、allowlist 外 key、raw secret 差分、JSON key order で揺れないことを focused test で固定する。
  - [x] chart revision JSON export は `exportSchemaVersion=1` / `exportHashAlgorithm=SHA-256` を返し、hash material に含める。
  - [x] chart revision JSON export は `revisionCount` / `eventCount` を返し、canonical `exportHash` material に含める。
  - [x] chart revision JSON export は `currentRevisionId` が revision list から欠落した不整合を 409 で拒否する。
  - [x] chart revision JSON export は server-derived `currentRevisionStatus` を返し、canonical `exportHash` material に含める。
  - [x] chart revision JSON export は server-derived `currentRevisionNumber` を返し、canonical `exportHash` material に含める。
  - [x] chart revision JSON export は server-derived `currentRevisionContentHash` を返し、canonical `exportHash` material に含める。

## 8. 処方指示正本実装

- [x] `POST /api/prescriptions` を実装し、診療録リビジョンに紐付く `DRAFT` 処方指示を作成する。
- [x] 薬剤コード、薬剤名、規格、剤形、用法、用量、単位、日数、院内/院外、内服/外用/注射/頓用、一般名処方フラグ、医師コメント、入力者、作成日時を保存する。
- [x] `POST /api/prescriptions/{prescriptionId}/finalize` を実装し、確定者、確定日時、処方内容 hash を保存する。
- [x] 確定済み処方の直接更新を禁止し、処方確定は診療録確定とは別操作にする。
- [x] `change`, `stop`, `cancel`, `reissue` をイベントとして実装し、理由と変更前後内容を保存する。
- [x] `POST /api/local/orca/medical-candidates/from-chart/{chartRevisionId}` を local candidate route として実装し、診療録・処方指示から ORCA送信候補を作る。
- [x] 送信候補作成時に変換不能項目や ORCAコード未解決項目を `NEEDS_REVIEW` / 送信不可にする。
- [ ] `POST /api/local/orca/medical-operations/prepare` と official `POST /api/orca/official/chart-support/medical-mod-v2` を組み合わせ、prepare/send の分離と `medicalmodv2` 相当の送信を実装する。
- [ ] 送信前確認に患者、受付、診療科、医師、保険組合せ、候補を表示し、送信後に ORCA側結果を再取得・差分照合する。

## 9. 病名ORCA連携実装

- [x] `GET /api/local/diagnoses/{patientId}?baseMonth=...` の ORCA mirror read model、または official read wrapper を通じて ORCA `diseasegetv2?class=01` 相当から取得する。
- [x] 取得結果を `orca_disease_cache` に保存し、取得日時、基準月、診療科、保険組合せ、ORCA患者番号、stale を保持する。
- [x] official `POST /api/orca/official/chart-support/disease-mod-v3` で ORCA `diseasev3` 相当の送信、server-derived context、冪等キー、operation 保存を行う。
- [x] 旧 `diseasev2`、CLAIM病名送信、ORCA DB直接更新/参照を使わない。
- [ ] `OrcaDiseaseMutationRequest` は operation、ORCA患者ID、基準月、診療日、診療科、医師、保険組合せ、病名コード、補足コード、疑い、開始/終了日、転帰、カルテ名、病名区分、レセプト表示、保険病名、主病名/副病名を持つ。
- [x] `OrcaDiseaseMutationResponse` 相当の `ChartSupportDiseaseModV3Response` は result、warnings、unmatched、needsUserReview、operationStatus を持つ。
- [x] `diseasev3` の警告・不一致を無視せず、`ORCA_WARNING` / `ORCA_UNMATCHED` と `needsUserReview=true` へ分類する。
- [x] `diseasev3` の ORCAのみ病名、連番付け替え情報を無視せず、sanitized response / operation summary に保存する。
- [x] `diseasev3` ORCA accepted 後に `diseasegetv2` を再取得し、再取得結果だけを ORCA病名表示の根拠にする。再取得不可時は `NEEDS_REVIEW` として成功扱いにしない。
- [x] Web client は `postMutationMirrorStatus=connected` の `postMutationMirror` だけを病名送信後の主一覧へ反映し、再取得不可時は warning / 要確認として登録済み表示にしない。
- [x] 病名 UI は「ORCA登録病名」「診療録本文中の病名記載」「未送信候補」を分離し、入力だけで ORCA送信しない。

## 10. 診療行為・会計・収納・レセプト

- [x] 診療録・処方指示から `orca_medical_candidate` を作成し、ORCA正本ではないことを明示する。
- [ ] `medicalmodv2` 相当の送信では患者番号、診療日、診療科、医師コード、保険組合せ、ORCA受付存在、患者/保険情報 freshness、会計済み衝突を検証する。
- [ ] ORCAレスポンスを構造化保存し、送信後に ORCA側診療行為情報を再取得して差分表示する。
  - [x] 2026-05-10T21:59Z: `close-and-send-to-billing` は `medicalmodv2` response を sanitized `response_json` として保存し、送信直後に `tmedicalgetv2` で ORCA側中途終了データを再取得・照合する。UI 差分表示の完成は後続 D/E queue で継続。
- [x] ORCA会計情報取得 API をサーバーアダプタ経由で呼び、`orca_billing_cache` に保存する。
  - [x] 2026-05-10T22:30Z: `/api/orca/official/chart-support/income-info` は `incomeinfv2` transport response を `orca_billing_cache` へ hash と sanitized summary として保存し、保存失敗時は成功応答にしない。
  - [x] 2026-05-11T00:22Z: `OrcaChartSupportResourceTest` は public `income-info` resource が `facilityId` / ORCA patient / base date / request-response body を server-side cache command へ渡し、`orca_billing_cache` 保存失敗時に HTTP 503 で fail closed することを固定した。
- [x] OpenDolphinNext 側で会計金額や収納済み状態を独立更新できる API を作らない。
  - [x] 2026-05-10T22:30Z: `orca_billing_cache` は `source_system=ORCA` の cache 境界とし、schema/test/docs で raw invoice/insurance や local source を拒否する。会計金額・収納済み状態を local authority として更新する resource は追加していない。
- [x] 領収書・請求書は ORCA帳票取得結果として扱い、帳票取得履歴を監査ログに保存する。
  - [x] 2026-05-10T22:30Z: `/api/orca/official/reports/{type}` は ORCA report response を `orca_report_snapshot` へ hash/sanitized summary として保存し、audit detail は invoice/Data_Id raw ではなく hash と存在有無に限定する。
  - [x] 2026-05-10T23:18Z: `orca_report_snapshot.server_storage_object_key` / `server_storage_digest` は server が request/response hash と report type から生成し、raw patient / invoice / Data_Id / client-provided key を保存しない。
  - [x] 2026-05-10T23:22Z: `orca_report_snapshot.storage_upload_status` / upload time / retention until を追加し、binary object を `UPLOADED` 扱いにするには server-generated key/digest と retention metadata が必須になる DB gate を追加した。
  - [x] 2026-05-11T00:02Z: `OrcaReportBinaryStorageService` は DB snapshot の server-generated key/digest と content SHA-256 が一致する場合だけ object storage へ put し、digest mismatch / snapshot mismatch / disabled storage は upload 前に fail closed する。
  - [x] 2026-05-11T00:22Z: `OrcaReportDocumentResourceTest` は public report resource が `orca_report_snapshot` command を作成し、snapshot 保存失敗時に帳票取得成功へ進めず HTTP 503 で fail closed することを固定した。
  - [x] 2026-05-11T00:42Z: `/api/orca/official/reports/{type}` は snapshot receipt から server-internal binary upload command を作り、storage 有効時だけ object storage へ staging する。client 由来の storage key/digest/retention は受け取らず、response は `storageUploadStatus` / `reportBinaryAvailable` のみを返し、upload 失敗時は HTTP 503 で fail closed する。
  - [x] 2026-05-11T01:02Z: release-validation の server contract gate は `OrcaReportDocumentResourceTest` / `OrcaBillingCacheStoreTest` / `OperationsHealthResourceTest` を含み、billing/report/readiness coverage を `ReleaseValidationRunbookContractTest` で固定した。
  - [x] 2026-05-11T01:22Z: ORCA billing/report live profile は同一 RUN_ID の exact selected-candidate preflight 後続に限定し、`income-info` / `/api/orca/official/reports/{type}` の evidence を `orca_billing_cache` / `orca_report_snapshot` の sanitized hash・server-generated storage key/digest・`storageUploadStatus` / `reportBinaryAvailable` だけに限定する contract を固定した。
  - [x] 2026-05-11T01:42Z: `qa-orca-billing-report-live-profile.mjs` dry-run harness を追加し、candidate discovery と exact selected-candidate preflight の sanitized summary が揃う場合だけ billing/report live profile に進めること、summary に raw patient / insurance / credential / ORCA body / browser artifact 情報を含めないことを固定した。
  - [x] 2026-05-11T02:02Z: reviewer submission packet は `qa/billing-report-live-profile/summary.sanitized.json` のみを allowlist copy / validate し、dry-run が live ORCA 実行済み・会計済み・収納済み・レセプト正本化として扱われる誤読と raw artifact / raw patient key 参照を拒否する。
  - [x] 2026-05-11T02:22Z: `qa-orca-billing-report-live-handoff.mjs` を追加し、ready dry-run summary と manual approval reference hash が揃う場合だけ人手 live validation へ進める handoff evidence を作る。handoff 自体は live ORCA traffic を実行せず、raw artifact / raw patient / raw invoice / raw `Data_Id` / storage key/digest flag と capture env を拒否する。
  - [x] 2026-05-11T02:42Z: `qa-orca-billing-report-live-result.mjs` を追加し、operator live result を sanitized record として正規化する。accepted evidence は ORCA由来 cache/snapshot の hash・件数・invoice/data id hash・server-generated storage key/digest presence・`storageUploadStatus` / `reportBinaryAvailable` に限定し、raw identifier / raw artifact / storage key/digest / upload failure を拒否する。
  - [x] 2026-05-11T03:03Z: reviewer submission packet は `qa/billing-report-live-result/result.sanitized.json` を allowlist copy / validate し、ready handoff hash、ORCA由来 hash-only cache/snapshot evidence、server-generated storage boundary、upload failure / blocker なしを要求する。raw identifier / raw artifact / storage key/digest が result evidence に混入した場合は packet 作成を拒否する。
  - [x] 2026-05-11T03:22Z: reviewer submission packet dry-run は `requiredCloseoutFiles` / `requiredPacketFiles` を JSON 出力し、`qa/billing-report-live-result/result.sanitized.json` の欠落を packet 生成前に fail する。dry-run は出力先へ書き込まず、closeout fixture が operator result evidence まで揃っていることを focused test で固定した。
  - [x] 2026-05-11T03:42Z: `qa-orca-billing-report-live-result.mjs --print-operator-result-template` を追加し、operator が raw ORCA body / 帳票本文 / raw patient / invoice / `Data_Id` / `Medical_Uid` / storage key/digest / browser artifact を追記せず、server-derived hash/status だけで sanitized result input を作る contract を固定した。
- [x] レセプト情報を OpenDolphinNext 正本として持たず、ORCA由来キャッシュまたは帳票スナップショットとして扱う。
  - [x] 2026-05-10T22:30Z: `orca_report_snapshot` は `source_system=ORCA` と固定 report type/status を持つ snapshot 境界であり、restore/recovery docs でも local snapshot を正本昇格しないことを明記した。

## 11. Webクライアント医療安全UI

- [ ] 主要画面に患者ヘッダーを常時表示し、ORCA患者番号、内部参照ID、氏名、カナ、生年月日、年齢、性別、受付日、診療科、担当医、保険組合せ、ORCA取得日時、キャッシュ状態を表示する。
  - [x] 2026-05-10T21:16Z: 共通 `PatientIdentityBar` に医療安全患者ヘッダー行を追加し、Charts の患者ヘッダーで受付日、診療科、担当医、保険組合せ、ORCA source/cache status を visible 表示する段階適用を実施した。Patients / Mobile Images は同じ共通 component を継続利用し、全主要画面の完全統一は後続 heartbeat で Reception などへ拡張する。
  - [x] 2026-05-11T10:11Z: Mobile Images の共通 `PatientIdentityBar` に router state `encounter` 由来の受付日、診療科、担当医、保険組合せ、内部参照ID、`遷移文脈 / unverified` の ORCA取得状態を visible 表示する段階適用を実施した。Mobile Images 側では ORCA正本再取得や同期済み表示は行わず、患者画像アップロード完了を ORCA同期済みと混同しない。
  - [x] 2026-05-11T11:17Z: Reception の既存患者受付/患者検索モーダル内受付登録ペインへ共通 `PatientIdentityBar` を追加し、患者ID、氏名/カナ、受付日、診療科、担当医、保険 context、`ORCA受付対象確認 / verified|checking|unverified` を visible 表示する段階適用を実施した。未確定の保険組合せは `保険（組合せ未確定）` と表示し、client 側で ORCA 組合せ番号や受付成立を捏造しない。
  - [x] 2026-05-11T11:55Z: Patients 詳細ペインの共通 `PatientIdentityBar` に、選択患者と一致する encounter context 由来の内部参照ID、受付/診療日、診療科、担当医、保険組合せ、`患者管理同期状態 / fresh|stale|missing|unverified` を visible 表示する段階適用を実施した。不一致 patientId の encounter context はヘッダーへ混ぜず、Patients UI を server-side authority の代替にしない。
- [ ] モーダル内の重大操作確認にも患者識別情報を再掲する。
  - [x] 2026-05-10T21:59Z: 共通 `CriticalOperationConfirmDialog` を追加し、患者識別情報、実行操作名、対象サマリ、distinct confirm label を alertdialog 内に再掲する契約を固定した。Charts の ORCA 送信確認へ適用し、confirm CTA を `ORCAへ送信する` に分離した。
  - [x] 2026-05-11T12:23Z: `DiagnosisEditPanel` の病名 ORCA 送信確認を共通 `CriticalOperationConfirmDialog` へ移行し、ORCA患者番号、診療日、診療科、保険組合せ、操作、病名属性、ORCA送信コード、再取得待ちを alertdialog 内に再掲した。
- [ ] 診療録確定/訂正/取消、処方確定/中止/取消、病名ORCA送信、診療行為ORCA送信、会計送信、診察終了に確認フローを実装する。
  - [x] 2026-05-10T21:59Z: 診療行為 ORCA 送信の確認フローを共通重大操作 modal へ移行した。診療録確定/処方確定/取消/診察終了など全操作の完全統一は後続で継続する。
  - [x] 2026-05-11T12:23Z: 病名 ORCA 送信（登録/更新/削除/削除病名整理）の確認フローを共通重大操作 modal へ移行した。UI confirm は患者取り違え防止と誤操作低減の補助であり、認可・永続化・監査 enforcement は server-side の責務として残す。
- [ ] 「診療録確定」「会計へ送信」「診察終了」「ORCA送信成功」を別概念として表示する。
- [ ] 成功、失敗、警告、情報、要確認をセマンティックに分け、原因と次に取るべき行動を示す。
- [ ] ORCA警告、不一致、ORCA側のみ存在する情報を隠さない。
- [ ] 全フォームにラベル、必須/任意、サポートテキスト、具体的エラーを持たせる。
- [ ] 入力値変更だけで ORCA送信、突然のダイアログ、画面遷移をしない。
- [ ] `disabled` に頼らず、押下後に不足条件を表示する。やむを得ず `disabled` を使う場合は理由と有効化条件を近くに表示する。
  - [x] 2026-05-10T22:30Z: Charts の低レベル `ORCA 送信` は precheck 不足だけでは native disabled にせず、近傍 guard note / `aria-disabled=true` / 押下時 warning banner で不足条件を表示し、確認 modal と transport へ進まないことを focused test で固定した。
  - [x] 2026-05-10T23:13Z: Charts の通常導線 `診察終了して会計へ送信` も precheck 不足だけでは native disabled にせず、近傍 guard note / `aria-disabled=true` / 押下時 warning banner で不足条件を表示し、finish hook と transport へ進まないことを focused test で固定した。
  - [x] 2026-05-11T00:02Z: `DiagnosisEditPanel` の quick ORCA病名登録ボタンは ORCA mirror unavailable / read-only だけでは native disabled にせず、近傍理由 `diagnosis-mutation-block-reason` と押下時 `ORCA病名操作を停止` notice で不足条件を表示し、confirm / mutation へ進まないことを focused test で固定した。
  - [x] 2026-05-11T00:22Z: `OrderDockPanel` の quick-add / group-add は patient context 不足、read-only、missing master、fallback data だけでは native disabled にせず、近傍理由 `order-dock-edit-block-reason` と押下時 `オーダー追加を停止` notice で不足条件を表示し、editor を開かないことを focused test で固定した。
  - [x] 2026-05-11T00:42Z: `OrderDockPanel` の bundle edit / copy / delete は patient context 不足、read-only、missing master、fallback data だけでは native disabled にせず、近傍理由 `order-dock-edit-block-reason` と押下時 `オーダー編集/コピー/削除を停止` notice で不足条件を表示し、editor / delete confirm を開かないことを focused test で固定した。
  - [x] 2026-05-11T01:02Z: `OrderDockPanel` の処方履歴 `新規（空）` / `直近処方をコピーして開始` は patient context 不足、read-only、missing master、fallback data だけでは native disabled にせず、近傍理由 `order-dock-edit-block-reason` と押下時 `処方履歴取り込み/直近処方コピーを停止` notice で不足条件を表示し、editor を開かないことを focused test で固定した。
  - [x] 2026-05-11T01:22Z: `OrderDockPanel` の頻用オーダー apply は patient context 不足、read-only、missing master、fallback data で候補反映時に `頻用オーダー反映を停止` notice で不足条件を表示し、editor を開かず modal を維持することを focused test で固定した。
  - [x] 2026-05-11T01:43Z: `OrderDockPanel` の検索入力 / category select は操作自体を受けられない入力欄として native disabled を維持しつつ、近傍理由 `order-dock-search-block-reason` と `aria-describedby` で不足条件を表示することを focused test で固定した。
  - [x] 2026-05-11T02:02Z: `OrderBundleEditPanel` embedded footer submit は read-only / missing master / fallback data だけでは native disabled にせず、近傍 edit block reason と押下時 `保存操作を停止` notice で不足条件を表示し、mutation へ進まないことを focused test で固定した。
  - [x] 2026-05-11T02:22Z: `OrderRecommendationModal` のカテゴリ scope はカテゴリ未選択時に native disabled を維持しつつ、近傍理由 `order-recommend-category-scope-reason` と `aria-describedby` で横断 scope の代替を表示することを focused test で固定した。
  - [x] 2026-05-11T02:42Z: `DoCopyDialog` の適用ボタンは転記元なし / Do対象未選択で native disabled を維持しつつ、近傍理由 `charts-do-copy-apply-block-reason` と `aria-describedby` で不足条件を表示することを focused test で固定した。
  - [x] 2026-05-11T03:02Z: `PastHubPanel` の SOAP Do転記入口は転記可能 SOAP なし / セクション記載なしで native disabled を維持しつつ、近傍理由 `past-hub-do-copy-*` と `aria-describedby` で不足条件を表示することを focused test で固定した。
  - [x] 2026-05-11T03:22Z: `PatientSummaryPanel` の保存ボタンは read-only / 保存中 / 変更なしで native disabled を維持しつつ、近傍理由 `charts-patient-summary-save-block-reason` と `aria-describedby` で不足条件を表示することを focused test で固定した。
  - [x] 2026-05-11T03:43Z: `SoapNotePanel` の保存ボタンは read-only / 履歴表示 / 保存中で native disabled を維持しつつ、近傍理由 `soap-note-save-block-reason` と `aria-describedby` で不足条件を表示することを focused test で固定した。
- [ ] ボタン優先度、配置、44px以上の押下領域を DADS に沿って統一する。

## 12. 監査ログ・真正性

- [ ] ログイン、ログアウト、患者閲覧、診療録作成/保存/確定/訂正/追記/取消、文書添付/削除、処方作成/確定/変更/中止/取消/再発行、ORCA患者/受付/保険/病名取得、ORCA病名/診療行為送信、ORCA会計/帳票取得、ORCA送信失敗/再送/取消、エラー、権限拒否を記録する。
- [ ] 監査ログは操作者、ロール、対象患者、ORCA患者番号、診療録、処方、ORCA操作、時刻、操作種別、変更前後要約、端末情報、IP/user-agent hash、request/trace ID、ORCA連携結果、警告/エラー/不一致要約、event hash、previous hash を保存する。
- [x] 監査ログは append-only とし、削除/更新 API を作らない。
- [ ] 一般ユーザーと管理者のいずれも監査ログ改ざんができない設計にする。
- [ ] hash chain 検証バッチ、バックアップ、復元手順を実装・文書化する。

## 13. セキュリティ

- [ ] ORCA接続URL、Basic認証、クライアント証明書、証明書パスワードはサーバー秘密情報ストアに限定する。
- [ ] ORCA認証情報をフロント環境変数、ブラウザログ、サーバーログ、監査ログ、テストスナップショットに出さない。
  - [x] 2026-05-10T20:42Z: `check-sensitive-evidence-redaction.sh` を追加し、review-target の browser bundle / test-results / Playwright output / test snapshots に `Authorization` / Cookie / JSESSIONID / CSRF / Basic 値 / ORCA credential env assignment / raw ORCA body/XML / HAR / trace / video / screenshot / `error-context.md` が混入した場合に fail する。既存の `verify:no-public-secrets` と `verify:no-direct-orca-proxy-config` は web-client の公開 Vite env と生 ORCA proxy/credential config を継続検査する。
- [ ] サーバーログ、ブラウザコンソール、エラーレスポンス、監査ログに患者情報を過剰に出さない。
  - [x] 2026-05-10T20:42Z: `check-sensitive-evidence-redaction.sh` は review-target の text output/snapshot に raw ORCA response markers、`Patient_Name` / `WholeName` / `Home_Address`、保険番号系 field が残る場合も fail する。release validation と audit-log contract に guard を追加し、reviewer packet は sanitized extracted subset だけを同梱する方針へ固定した。
- [ ] PHI を含むテーブル、PDF/エクスポート、添付文書の権限を制御する。
- [ ] 患者閲覧、診療録作成/確定/訂正、処方入力/確定、ORCA患者更新、ORCA病名送信、ORCA診療行為送信、ORCA会計情報閲覧、監査ログ閲覧の権限を定義する。

## 14. 保存性・見読性・バックアップ

- [ ] 診療録、訂正履歴、追記履歴、取消履歴、処方指示履歴、ORCA連携履歴、ORCA送信失敗履歴、ORCA警告・不一致履歴を Web画面で表示できる。
- [ ] 診療録を印刷/PDF出力できる。
- [ ] 患者単位、診療日単位、期間指定でエクスポートできる。
- [ ] エクスポート対象に診療録本文、SOAP、処方指示、訂正・追記・取消履歴、ORCA連携履歴、ORCA由来スナップショットを含める。
- [x] 診療録正本DB、監査ログDB、添付文書ストレージのバックアップ手順を実装する。
  - [x] 2026-05-10T21:13Z: `docs/runbooks/backup-restore-hash-verification.md` を追加し、診療録/処方正本DB、監査ログDB、添付/患者画像 object storage inventory、ORCA cache/snapshot の backup preflight と restore read-only 手順を固定した。tracked evidence は sanitized summary/hash/count だけに限定し、raw DB dump/object payload/raw ORCA body/HAR/trace/video/screenshot/PHI/credential を禁止する。
- [x] ORCAキャッシュは復元対象だが正本ではないことを明記する。
  - [x] 2026-05-10T21:13Z: restore 後の local `ORCA_SENT` / `ORCA_CONFIRMED` / cache / snapshot を ORCA 正本へ昇格しないこと、server-side ORCA adapter による再取得・差分照合まで比較対象に限定することを runbook、ORCA outage recovery、audit contract に反映した。
- [x] 復元後に監査ログ hash chain と診療録 content hash を検証する。
  - [x] 2026-05-10T21:13Z: `check-backup-restore-runbook.sh` を追加し、`AuditChainVerifier.verifyAll()`、chart/prescription content hash verification、document integrity、object inventory digest、ORCA re-alignment 前の read-only fail-closed 境界が release validation から外れないことを CI guard と `RepoGuardScriptsTest` で固定した。
- [ ] ORCA障害時でも OpenDolphinNext 正本データを閲覧できるようにする。

## 15. テスト実装

- [ ] 患者キャッシュ metadata、ローカル患者/病名 CRUD 不在、確定済み診療録/タイトル/処方の直接更新不可、訂正/追記/取消/処方変更イベント、ORCA送信失敗、warning/unmatched、監査 hash chain の unit test を実装する。
- [ ] ORCA adapter の患者取得/不在、受付一覧/取消、保険、病名取得/追加/変更/削除/転帰/警告/不一致/ORCA側のみ、診療行為送信、会計/帳票、他端末使用中、通信断、証明書異常、認証失敗をテストする。
- [ ] 受付取得から診療録作成、確定時 snapshot、処方確定から ORCA候補作成、診療行為送信成功/失敗、病名送信成功/失敗、会計済み衝突、受付取消、保険変更後 snapshot 不変を統合テストする。
- [ ] E2E で患者選択、患者ヘッダー、下書き保存、確定確認、確定後直接編集不可、訂正/追記/取消、処方作成/確定/中止、ORCA送信前確認、成功/失敗/警告/不一致表示、患者取り違え防止、PDF、期間エクスポートを確認する。
- [ ] UI/a11y でラベル、プレースホルダー説明代用禁止、重大操作確認、重要警告初期表示、disabled 理由、キーボード操作、フォーカス、コントラスト、ボタン配置、患者ヘッダー視認性をテストする。
- [ ] セキュリティテストで bundle への ORCA URL/Basic/証明書情報混入、生ORCAパス到達、ログ/監査ログ credential 混入、患者情報過剰エラー、権限なし操作を拒否できることを確認する。
  - [x] 2026-05-10T20:42Z: `verify:no-public-secrets`、`verify:no-direct-orca-proxy-config`、`verify:no-blocked-orca-route-strings`、`check-audit-append-only.sh`、`check-sensitive-evidence-redaction.sh`、`RepoGuardScriptsTest` で bundle/test output/snapshot/audit guard の credential/PHI leakage regression を固定した。権限なし操作の full authorization matrix は各 owning worker の server resource tests と release gate で継続確認する。

## 16. 運用・設定

- [ ] ORCA接続URL、Basic認証、クライアント証明書、証明書パスワード、timeout、retry、APIごとの有効/無効をサーバー設定にする。
- [ ] 開発環境でもブラウザに ORCA認証情報を渡さない。
- [ ] ORCA接続、証明書期限、DB、監査ログ書き込みの health check を実装する。
  - [x] `/api/health/readiness` に sanitized `auditLog` check を追加し、authoritative audit chain head の write path lock が取れない場合は `audit_log_write_unavailable` で全体 readiness を fail-closed にする。会計送信と `tmedicalgetv2` 再照合は audit write path が利用できない場合、ORCA transport 前に 503 を返す。
  - [x] 2026-05-10T23:06Z: `/api/health/readiness` に sanitized `orcaBillingCache` check を追加し、`orca_billing_cache` / `orca_report_snapshot` schema が利用できない場合は `orca_billing_cache_unavailable` で全体 readiness を fail-closed にする。SQL、内部例外、raw table detail は返さない。
- [ ] ORCA障害時は UI に「ORCA連携停止中」を表示しつつ、診療録正本閲覧を可能にする。
  - [x] App shell は `/api/health/readiness` の sanitized ORCA check が `DOWN` または取得失敗の場合、全ロールに `ORCA連携停止中` の compact status だけを表示する。正常時は非表示とし、URL、host、credential、raw error は表示しない。
- [ ] ORCA送信失敗、`UNKNOWN`, `NEEDS_REVIEW` の一覧画面を作る。
  - [x] `GET /api/local/encounters/orca-transmissions/review` で `ORCA_UNKNOWN` / `ORCA_FAILED` / `CORRECTION_REQUIRED` の server-side facility scoped sanitized 一覧を返す。
  - [x] Reception が review 一覧を初期表示し、`ORCA_UNKNOWN` / `ORCA_FAILED` / `CORRECTION_REQUIRED` を折りたたまず要確認として表示する。表示は患者ID、encounter / schedule key、operation status、Api_Result、開始時刻、次アクションに限定し、idempotency key / request ID / trace ID / raw ORCA body / 保険組合せ / 伝票番号 / 連番を出さない。
- [ ] 再送前に現在 ORCA状態、前回送信との差分、患者・受付・保険組合せを再確認し、監査ログに保存する。
  - [x] `POST /api/local/encounters/orca-transmissions/{transmissionId}/reconcile-temporary-medical` で review transmission を server-side facility scoped に限定し、保存済み snapshot から `tmedicalgetv2` read-only 再照合を行う。client 提供の patient / facility / insurance / voucher / sequential / `Medical_Uid` / URL / raw XML は受け取らず、照合結果は `needsUserReview=true` の sanitized summary と監査ログに限定する。
  - [x] Reception の ORCA送信要確認一覧から `ORCA状態を再照合` を実行し、client は transmission ID だけを送る。画面は一致件数/総件数と要確認状態だけを表示し、`Medical_Uid` 値、保険組合せ、raw ORCA body、trace/request/idempotency を表示しない。
- [ ] ORCA側で会計済みの場合は再送を原則禁止し、管理者確認フローにする。
  - [x] `tmedicalgetv2` 照合の `Medical_Mode` / `Medical_Mode2` が open (`0`) 以外の場合は server が `resendBlocked=true` / `ORCA_TEMPORARY_MEDICAL_MODE_LOCKED` を返し、Reception は再送停止と管理者確認を表示する。client は解除判定を作らず、`Medical_Uid` 値、保険組合せ、raw ORCA body は表示しない。
- [ ] ORCA障害時の診療録/処方作成可否、会計送信不可表示、復旧後再照合、ネットワーク障害時の `UNKNOWN` 処理、DB障害時読み取り専用モード、復元後 ORCA再照合を文書化する。
  - [x] `docs/runbooks/orca-outage-recovery.md` を追加し、ORCA outage 中の許可操作、禁止操作、`ORCA_UNKNOWN` 処理、復旧後 `tmedicalgetv2` 再照合、証跡ポリシーを sanitized contract として固定する。
  - [x] DB write path / 監査ログ書き込み degraded 時は read-only mode とし、監査不能な診療録変更・処方変更・ORCA送信・再照合反映を fail-closed にする。backup restore 後は監査ログ hash chain と診療録 content hash を検証し、ORCA再取得・差分照合が完了するまで local 状態を正本昇格しない。
  - [x] `/api/local/prescription-orders` と `/api/local/prescription-orders/do-import` は audit write path が利用できない場合、処方 payload 永続化前に `audit_log_write_unavailable` で 503 fail-closed にする。
  - [x] `/api/karte/document`、`/api/karte/document/{id}`、`/api/karte/revisions/revise`、`/api/karte/revisions/restore` は audit write path が利用できない場合、診療録 payload 永続化前に `audit_log_write_unavailable` で 503 fail-closed にする。
  - [x] `/api/patients/{patientId}/images` の patient image upload は audit write path が利用できない場合、multipart 解析・外部保存準備・DB 永続化前に `audit_log_write_unavailable` で 503 fail-closed にする。

## 17. 旧実装・危険経路の削除チェック

- [x] ローカル患者作成/更新 API を削除する。
  - [x] 2026-05-10T19:20Z: active source/current docs に `/api/local/patients/mutation(s)` と `LocalPatientMutation*` が再混入しない `verify:no-local-patient-mutation` guard を `verify:web-guard` に追加した。患者作成・更新の現行導線は ORCA official patientmodv2 bridge とし、local patient search 以外の local mutation surface がないことを継続検証する。
- [x] ローカル病名作成/更新/削除 API を削除する。
- [x] ORCA DB直接病名参照コード、CLAIM病名送信コード、`diseasev2` 依存を削除する。
- [x] 診療録確定済みタイトル直接更新経路、確定済み処方 payload 直接上書き経路を削除する。
  - [x] `KarteDocumentWriteService.updateTitle` は `TMP` 以外の診療録タイトル直接更新を `karte.document.finalized_update_denied` / HTTP 409 で拒否し、確定済みタイトル変更を revision/event 経由に限定する。
  - [x] `/api/local/prescription-orders` と `/api/local/prescription-orders/do-import` は server-derived `encounter_projection` が会計待ち・取消・閉鎖相当の場合、処方 payload 永続化前に `prescription_order_finalized_update_denied` / HTTP 409 で拒否する。client 提供の encounter/patient/facility は権威にせず、projection の facility/patient 不一致は `encounter_not_found` として扱う。
  - [x] 2026-05-10T19:29Z: `check-finalized-write-guards.sh` を release validation に追加し、上記の拒否実装・保存前順序・regression test を CI guard として固定した。
- [x] Webクライアントの生ORCAプロキシ設定、ORCA認証情報を扱うフロント設定を削除する。
  - [x] `web-client/vite.config.ts` から `/api21`, `/api01rv2`, `/orca22` 等の生 ORCA/WebORCA proxy、ORCA Basic 認証 header 注入、ORCA 証明書 agent 読込、ORCA header 操作を削除し、Vite proxy は server-modernized `/api` entrypoint 中継に限定する。
  - [x] `web-client` の `npm run dev` は ORCA env file を自動読込せず、`verify:no-direct-orca-proxy-config` で Vite config / env sample への生 ORCA proxy・ORCA credential config 再混入を fail する。
  - [x] 2026-05-10T19:40Z: `verify:no-direct-orca-proxy-config` が `verify:web-guard` と release validation に含まれていることを確認し、生 ORCA/WebORCA path、ORCA credential/certificate variable、ORCA TLS bypass、ORCA header filtering config の再混入を継続検証する。
- [x] ORCA送信成功を診療録確定と同義に扱う UI 文言、ORCA送信失敗時に登録済み/反映済みと表示する文言、重要警告を初期非表示にする UI を削除または変更する。
  - [x] 2026-05-10T18:00Z: Patients の新患登録・既存患者更新・ORCA既存患者取込で、write accepted と ORCA正本再取得済みを分けて表示し、未確認時に「反映済み/登録済み」と誤認させる文言を同期確認表現へ変更した。
  - [x] 2026-05-10T18:18Z: Charts の既存患者更新 dialog と共通患者取込 recovery で `canonical 再取得` / `完了扱い` の内部語を利用者に表示せず、ORCA正本の再取得による同期確認表現へ正規化した。
  - [x] 2026-05-10T18:29Z: Patients の patientmodv2 / ORCA既存患者取込 result message、toast、監査 summary から `canonical 再取得` / `完了扱い` / 単純な取込完了表現を除き、ORCA正本再取得による同期確認表現へ統一した。
  - [x] 2026-05-10T18:08Z: DiagnosisEditPanel の diseasev3 成功後 copy を `反映しました` から `ORCA再取得結果で同期確認しました` に変更し、ORCA accepted と ORCA登録病名表示の境界を明示した。
  - [x] Charts の ORCA summary / timeline で `medicalmodv2` 送信を単純な「成功」表示にせず、`送達確認` として表示し、会計済み判定・診療録確定とは別概念であることを初期表示の説明に含める。
  - [x] 2026-05-10T18:39Z: Reception の billing projection で `送信済` transmission signal が `会計済み` workflow と誤認されないよう、会計待ち/再計待では「送信済は会計済みではありません。収納確認まで会計待ちです。」を初期表示し、カード/詳細テストで固定した。
  - [x] 2026-05-10T18:52Z: Patients の `missingMaster` / `fallbackUsed` / 非 server-local dataSource による患者編集停止理由を `通信詳細` disclosure の外へ出し、ORCA正本確認不能時の重要警告を初期表示するテストで固定した。
  - [x] 2026-05-10T18:59Z: Charts action bar の compact header collapsed 状態で `fallbackUsed` が `詳細` disclosure 内だけに隠れないよう、暫定データ警告を初期表示の alert として出し、ORCA送信・会計送信・印刷前の再取得要求をテストで固定した。
  - [x] 2026-05-10T19:09Z: Charts の患者ヘッダーで `missingMaster` / `fallbackUsed` を pill だけにせず、ORCA正本確認が必要な alert と再取得アクションを初期表示し、`details` 外に出ることをテストで固定した。
  - [x] 2026-05-10T20:41Z: `verify:medical-safety-ui-copy` を `verify:web-guard` に追加し、ORCA送信成功/反映/会計済み/診療録確定を混同する visible copy と重要警告を details/disclosure へ戻す文言を production UI/current docs で拒否する。`OrcaSummary` と `ChartsPage` の focused tests で送達確認・要確認 alert が初期表示かつ details 外であることを固定した。

## 18. 実ORCA接続試験チェック

- [x] 2026-05-10T21:59Z: `ops/tests/orca/live-trial-checklist.sh --dry-run --run-id <RUN_ID>` と `check-live-orca-trial-harness.sh` を追加し、runtime-ready、medical-information probe、candidate discovery、exact read-only preflight、approved acceptmodv2、fullflow、Phase 4 medicalmodv2、sensitive evidence guard の順序を sanitized dry-run で固定した。actual live pass ではないため、下記の実ORCA接続試験項目は未完了のまま維持する。
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
- [x] 監査ログ hash chain 検証ができる。
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
- [x] `medicalmodv2` の警告・エラー分類を実装する。
- [ ] ORCA再取得・差分照合を実装する。

### Phase 3: 診療録・処方の真正性

- [ ] 診療録リビジョンモデルを完成させる。
- [ ] 訂正・追記・取消イベントを実装する。
- [x] 代行入力者と医師確定者を分離する。
- [ ] 処方変更・中止・取消・再発行履歴を実装する。
- [ ] 診療録確定時スナップショットを実装する。

### Phase 4: 医療安全UI

- [ ] 患者ヘッダーを全主要画面に統一実装する。
- [ ] 重大操作確認モーダルを統一実装する。
- [ ] ORCA警告・不一致表示を統一実装する。
- [ ] `disabled` 依存を減らし、理由表示へ変更する。
- [ ] ボタン優先度・配置をDADS基準に統一する。

### Phase 5: 保存性・監査・運用

- [x] 監査ログをappend-only化する。
- [x] hash chain検証を実装する。
- [ ] PDF・印刷・期間エクスポートを完成させる。
- [ ] バックアップ・復元手順を整備する。
- [ ] 実ORCA接続試験を完了する。
- [ ] 本番運用手順書を整備する。

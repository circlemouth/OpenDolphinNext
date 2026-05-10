# ORCA Connection 契約

## 目的
施設別 ORCA 接続設定を fail-closed で解決し、資格情報の暗号化責務を 2FA から分離する。

## 非機能方針
- 後方互換は保持しない。
- 施設未解決時の「最後に保存したレコード」 fallback を禁止する。
- explicit `defaultFacilityId` が未設定のときに runtime facility / runtime ORCA config へ fallback しない。
- ORCA 資格情報の暗号鍵は 2FA 用鍵と分離する。
- ログ / 監査 / readiness で接続先詳細を出さない。
- `testedScope` や optional module visibility はこの契約に含めない。connection API は施設別接続設定だけを返す。

## 保存モデル
- 設定ファイルまたは永続化モデルは次の論理構造を持つ。
```json
{
  "defaultFacilityId": "facility-a",
  "facilities": {
    "facility-a": {
      "mode": "weborca",
      "baseUrl": "https://example.invalid",
      "username": "user-a",
      "passwordEncrypted": "...",
      "clientAuthEnabled": false,
      "clientCertificateP12Encrypted": null,
      "clientCertificatePassphraseEncrypted": null,
      "caCertificateEncrypted": null,
      "version": 1,
      "updatedAt": "2026-03-20T00:00:00Z"
    }
  }
}
```
- `defaultFacilityId` は明示設定のみ許可する。
- `facilityId` / `defaultFacilityId` には `null` / blank / 大文字小文字を問わない予約語 `default` を許可しない。
- 施設更新時に `defaultFacilityId` を暗黙変更してはならない。
- `PUT /api/admin/orca/connection` は施設別接続設定のみ更新する。
- `PUT /api/admin/orca/connection/default-facility` は `{"defaultFacilityId":"..."}` を受け取り、default facility 切替だけを行う。
- `serverUrl` は設定保存時に検証し、userinfo を含む URL は拒否する。userinfo を黙って除去・正規化して保存してはならない。

## 解決順序
1. 呼び出し引数の facilityId
2. 認証 principal の facilityId
3. `defaultFacilityId`
4. 上記で解決できなければ `facility_configuration_missing`

## 禁止する fallback
- [x] `_default` を「最後に編集した施設」で上書きしない。
- [x] `records.values().iterator().next()` を fallback に使わない。
- [x] facilityId 未解決時に別施設へ接続しない。
- [x] store 不在 / `defaultFacilityId` 未設定 / `facility_configuration_missing` のとき runtime config へ接続しない。

## Secret Protector 契約
- `factor2.aes-key-b64` は 2FA のみ。
- `orca.credentials.aes-key-b64` を新設し、ORCA password / client certificate / CA certificate の暗号化にのみ使う。
- ORCA 鍵ローテーション時に TOTP secret が影響を受けないこと。
- TOTP 鍵ローテーション時に ORCA 資格情報が影響を受けないこと。

## 管理アップロード契約
- `PUT /api/admin/orca/connection` の `clientCertificate` / `caCertificate` filename は表示・監査用メタデータに限定し、保存先パスや信頼境界の判断に使わない。
- filename から path separator、quote、CRLF、制御文字を除去し、path segment が含まれる場合は末尾の basename のみ採用する。
- filename が空または長すぎる場合はフィールドごとの安全な fallback 名を使う。

## ロギング / 監査契約
- 記録してよいもの
  - facilityId
  - mode
  - credentialConfigured
  - clientAuthEnabled
  - caConfigured
  - pushConfigured
  - pushTenantConfigured
  - version
- 記録してはいけないもの
  - baseUrl
  - host
  - port
  - scheme
  - username
  - password
  - certificate 内容
  - pathPrefix
  - userinfo
- failure response / audit details / readiness / summary log / detail log は raw URL、userinfo、host、secret path、credential を含めない。

## 実装タスク
- [x] `SecondFactorSecurityConfig` から ORCA 用保護器を分離し、`OrcaCredentialSecurityConfig` 等の専用設定クラスを追加する。
- [x] `OrcaConnectionConfigStore` の record 選択ロジックを fail-closed に書き換える。
- [x] default facility 変更 API / 操作を接続設定更新から分離する。
- [x] `OrcaTransportSettings.auditSummary()` を抽象化済み情報だけ返すよう変更する。
- [x] readiness / 監査ログ / 例外メッセージを sanitize する。
- [x] exact facility hit / explicit default / unresolved failure / protector separation のテストを追加する。

## 受け入れ条件
- [x] facilityId が不明なときに別施設設定へ接続しない。
- [x] 施設 A 更新後も default facility が変化しない。
- [x] 2FA 鍵と ORCA 鍵を別々に回しても相互影響しない。
- [x] ログと readiness 応答に接続先詳細が含まれない。

## Charts Disease Mirror
- Charts の病名正本は ORCA `diseasegetv2?class=01` の再取得結果です。`/api/local/diagnoses/{patientId}?baseMonth=yyyyMM` の server-side projection から `diseasegetv2` を呼ぶ。`baseMonth` は server が `yyyyMM` として検証し、ORCA `Base_Date` と cache `base_month` の authority にする。呼び出し施設は認証済み request context の facilityId で解決し、クライアント提供の facilityId / owner / URL は使わない。
- `diseasegetv2` は既存の ORCA transport / runtime config / allowlist に従い、任意 URL 入力から接続しない。失敗時は `orcaMirrorStatus=unavailable` の sanitized state だけを返し、base URL、host、credential、raw XML、stack trace は返さない。ORCA `Api_Result=21`（対象病名なし）は取得成功の 0 件として扱い、unavailable と混同しない。`includeEnded=true` は server が `Select_Mode=All` に変換し、client は raw XML / raw query を指定しない。
- mirror response は ORCA projection を `diseases`、既存 local-only disease を `pendingLocalDiseases` として分離する。ORCA unavailable 時に local-only disease を `diseases` へ fallback しない。ORCA projection は表示名だけでなく `Disease_Single` component 列、`Disease_Supplement_Single`、転帰受信 code、server 計算 `orcaSnapshotHash` を保持する。
- `POST /api/local/diagnoses` は公開しない。病名の作成・更新・削除は local table mutation ではなく ORCA `diseasev3` official bridge と送信後 `diseasegetv2` 再取得で扱う。
- ORCA 病名の永続化境界は `orca_disease_cache`, `orca_disease_snapshot`, `orca_disease_operation`, `orca_disease_audit_event` に分離する。`orca_disease_cache` は `source_system=ORCA` と取得 source metadata、`fetched_at`、`cache_expires_at`、`raw_response_hash`、normalized payload を保存する。`/api/local/diagnoses/{patientId}` は `diseasegetv2` 成功 projection をこの cache に反映し、cache 書き込み失敗時は成功表示せず `orcaMirrorStatus=unavailable` に倒す。`orca_disease_snapshot` は診療録確定・送信前確認・照合などの固定時点、`orca_disease_operation` は冪等性付き diseasev3/fetch operation、`orca_disease_audit_event` は hash chain 用の要約監査情報だけを持つ。raw ORCA XML、資格情報、患者詳細、保険詳細はこれらのテーブルへ平文保存しない。
- ORCA `masterlastupdatev3` は master update catalog の `disease_master` dataset として扱い、Charts disease mirror と病名候補検索は `masterVersion` を返す。master update の失敗詳細や ORCA 接続先情報は Charts response に出さない。

## Official Patient Read Cache
- 患者取得は `/api/orca/official/patientgetv2` から ORCA `patientgetv2` を呼び、取得ごとに `orca_patient_cache` を更新する。cache は display/read-through cache であり、OpenDolphinNext 側の患者正本ではない。
- 施設は認証済み request context の facilityId で解決し、client 提供の facilityId、owner、role、任意 URL、storage key、digest は使わない。
- API response body は既存 ORCA official 互換を維持し、source metadata は response header と監査 details に限定して返す。`X-Orca-Cache-Status` は `CURRENT`, `NOT_FOUND`, `NEEDS_REVIEW`, `UNAVAILABLE` 等の cache state、`X-Orca-Stale` は live ORCA 取得では `false` とし、cache-only fallback を current 表示に使わない。
- `Api_Result=10` または患者不在 wording は `ORCA_PATIENT_NOT_FOUND` business status として扱い、単純な HTTP 404 や local fallback success に変換しない。
- `orca_patient_cache` は `source_system=ORCA`, `source_api=patientgetv2`, `source_request_id`, `source_trace_id`, `fetched_at`, `cache_expires_at`, `cache_status`, `business_status`, `raw_response_hash`, normalized payload を保存する。raw ORCA body、credential、接続先 URL、Cookie、Authorization、CSRF は保存しない。

## Charts Disease Mutation
- Charts からの ORCA 病名登録・更新・削除は `/api/orca/official/chart-support/disease-mod-v3` だけを使う。
- server は facility / patient access / department / insurance / target disease を server-side で再検証し、クライアント提供の facilityId、任意 URL、raw XML、`Request_Number` を信用しない。
- `baseMonth` は `yyyyMM` 形式だけを許可し、形式不正は ORCA transport 前に拒否する。payload に `physicianCode` または top-level `insuranceCombinationNumber` が含まれる場合は server-derived encounter context との完全一致を確認し、一致後も送信 XML、冪等キー、operation 保存には server-derived 値を使う。不一致は ORCA transport 前に fail closed する。
- `create|update` は `Disease_Single` component 列を必須にし、`Disease_Code` 単独・自由文字列だけの登録は拒否する。未コード化は明示確認済みの `uncodedAccepted=true` のときだけ許可する。
- `Disease_Insurance_Class`、`Disease_Category`、`Disease_Class`、`Disease_Receipt_Print`、`Disease_Receipt_Print_Period`、`Insurance_Disease`、`Discharge_Certificate`、`Main_Disease_Class`、`Sub_Disease_Class` は ORCA 仕様コードの allowlist だけを transport 前に受け付ける。UI 表示語や自由文字列をそのまま送信コードとして扱わない。
- `operation=create|update|delete|organizeDeletedDiseases` は server-owned enum とする。通常 create/update/delete は `Request_Number` を送らず、delete は `Disease_OutCome=O` を server が生成する。`Request_Number=01` は `organizeDeletedDiseases` の削除病名整理だけで生成する。
- 転帰送信値は server allowlist で `ACTIVE=` 空、`CURED=F`、`DEATH=D`、`DISCONTINUED=P`、`DELETED=O` に固定する。`C` と `S` は送らず、`TRANSFERRED` は Trial 実送信確認まで ORCA 送信を block する。
- ORCA warning / unmatch は固定フィールドに normalize し、患者情報、内部 URL、資格情報、raw XML、stack trace を API/UI/監査ログへ出さない。`Disease_Unmatch_Info` は ORCA 側に存在する未照合病名として code/name、補足名、入外、主病、疑い、開始日、転帰日、転帰、overflow flag だけを保持する。`Organize_Information` は連番付け替え結果の sanitized summary として診療科と開始日だけを保持する。
- server は diseasev3 送信前に server-generated request hash から冪等キーを作成し、同一 facility の同一 diseasev3 request を二重送信として ORCA transport 前に拒否する。送信後は `orca_disease_operation` に request / response hash、固定 `operationStatus`、`needsUserReview`、warning/unmatch summary を保存し、raw XML や資格情報は保存しない。ORCA transport が例外で終了した場合も、raw response body なしの `NETWORK_FAILED` / `needsUserReview=true` summary を operation に保存し、成功扱いにしない。ORCA が mutation を受け付けた場合も、直後の `diseasegetv2` 再取得が `connected` になるまで `postMutationMirrorStatus=unavailable` / `NEEDS_REVIEW` とし、local optimistic result を正本表示にしない。
- mutation 成功後の Charts 表示は ORCA `diseasegetv2` 再取得結果だけを正本とし、楽観更新や local fallback で成功扱いにしない。

## ORCA API Result Classification
- ORCA adapter は `open.dolphin.orca.model.OrcaApiResult` を共通の sanitized result summary として使う。保存・監査・API 応答に載せるのは result code/message category、固定 operation status、warnings/errors/unmatched/orca-only/renumbered summary、`needsUserReview`、perform date、department、physician、insurance combination、request/response hash などの allowlist field に限定し、raw ORCA body、資格情報、接続先 URL、患者詳細、保険詳細は含めない。
- mutation 系分類は `ORCA_ACCEPTED`, `ORCA_REJECTED`, `ORCA_WARNING`, `ORCA_UNMATCHED`, `ORCA_CONFLICT`, `NETWORK_FAILED`, `CERTIFICATE_FAILED`, `AUTH_FAILED`, `UNKNOWN`, `NEEDS_REVIEW` の固定 status を使う。warning/unmatched は `Api_Result` が正常でも `needsUserReview=true` とし、成功表示に潰さない。
- `Api_Result` が zero-like でも completion evidence が欠ける場合は `UNKNOWN` とし、ORCA 再照合または post-mutation re-fetch が完了するまで成功扱いにしない。HTTP 401/403 は `AUTH_FAILED`、TLS/certificate 系 failure は `CERTIFICATE_FAILED`、その他 transport failure は `NETWORK_FAILED` として区別する。
- diseasev3 と medicalmodv2 の response parser はこの分類を使い、病名の ORCA only / unmatch / warning、診療行為の warning / completion evidence 欠落を共通 status に正規化する。

## ORCA Operation Ledger
- ORCA 送信・取得・照合の共通台帳は `orca_operation`, `orca_transmission`, `orca_response_summary`, `orca_reconciliation_result` に分離する。既存の disease / billing / prescription 個別テーブルは domain-specific state を保持し、共通台帳は API 横断の idempotency、status、retry、request/response hash、sanitized summary、post-send reconciliation を保持する。
- `orca_operation.operation_status` と `orca_transmission.transmission_status` は `PREPARED`, `READY_TO_SEND`, `SENDING`, `ORCA_ACCEPTED`, `ORCA_REJECTED`, `ORCA_WARNING`, `ORCA_UNMATCHED`, `ORCA_CONFLICT`, `NETWORK_FAILED`, `CERTIFICATE_FAILED`, `AUTH_FAILED`, `UNKNOWN`, `NEEDS_REVIEW`, `CANCELLED` の固定分類に従う。`UNKNOWN` は成功扱いにせず、`orca_reconciliation_result` による再取得・照合が完了するまで `needs_user_review=true` を維持する。
- idempotency は server-generated `idempotency_key` と `request_hash` で固定し、client 提供の facility / owner / role / URL / voucher / sequential / insurance combination / `Medical_Uid` は台帳 authority として採用しない。operation context は認証 principal、server-side encounter projection、保存済み snapshot、ORCA adapter で解決した値から作る。
- 台帳に保存してよいのは hash、固定 status/reason code、request/trace ID、警告・不一致・ORCA only・連番付け替えの sanitized summary、件数、`Medical_Uid` の存在有無、`Medical_Mode` / `Medical_Mode2` の分類値、`resendBlocked` などの allowlist field に限定する。
- 台帳に保存してはいけないもの: raw request/response body、raw XML、ORCA URL / host / port / pathPrefix、Basic 認証、Cookie、Authorization、CSRF、証明書/秘密鍵/パスフレーズ、患者氏名・住所・電話番号、保険番号詳細、voucher / sequential / insurance combination の raw 値、`Medical_Uid` の raw 値。
- `orca_response_summary` は adapter response の normalized summary だけを保持する。warning / unmatched / error / ORCA only / renumbered の JSON は code/category/field/count などの最小要約に限定し、ORCA body の再構成に使える値を入れない。
- `orca_reconciliation_result` は post-mutation re-fetch、`tmedicalgetv2` 照合、会計/収納/帳票再取得、restore realignment の結果を保存する。照合成功は ORCA 正本の再取得結果との比較結果であり、自動再送や会計反映済みへの昇格を意味しない。

## Billing / Report Cache Boundaries
- ORCA 会計・収納・帳票は OpenDolphinNext の正本にしない。`incomeinfv2` 取得結果は server-side ORCA transport 経由の取得後に `orca_billing_cache` へ保存し、`source_system=ORCA`、`source_api=incomeinfv2`、`cache_status=CURRENT|NEEDS_REVIEW|UNAVAILABLE`、request/response hash、件数、金額サマリ、invoice hash list、sanitized normalized summary だけを保持する。
- `orca_billing_cache` は cache/read-through 境界であり、会計金額、収納済み状態、請求状態を OpenDolphinNext 側で独立更新する API の authority ではない。再取得・照合・復旧時は ORCA adapter から再取得し、client 提供の facility / owner / role / URL / storage key / digest / voucher / sequential / insurance combination / invoice raw 値を保存 authority にしない。
- 領収書、請求書、処方箋、薬情、カルテ1号/3号、明細書などの帳票取得は `orca_report_snapshot` に ORCA 由来 snapshot として保存する。保存するのは `source_system=ORCA`、帳票種別、snapshot status、request/response hash、invoice/data id hash、form metadata、server-generated storage object key/digest、sanitized summary に限定する。
- `orca_report_snapshot.server_storage_object_key` と `server_storage_digest` は server が request/response hash と report type から生成する。client-provided storage key / digest / path / URI は受け取らず、raw patient ID、raw invoice number、raw Data_Id、ORCA URL を object key に含めない。帳票 binary object の upload/retention 実装を追加する場合も、この server-generated key/digest を authority とする。
- `orca_report_snapshot.storage_upload_status` は binary object の利用可否を `NOT_UPLOADED|UPLOADED|UPLOAD_FAILED|RETENTION_BLOCKED|EXPIRED` で表す。通常の帳票取得履歴は `NOT_UPLOADED` とし、`UPLOADED` / `RETENTION_BLOCKED` は server-generated key/digest、upload time、retention until が揃う場合だけ DB constraint で許可する。retention 不明・key/digest 不整合の帳票 binary は利用可能扱いにしない。
- `orca_report_snapshot` と audit details に raw ORCA body、帳票本文、Basic 認証、Cookie、Authorization、CSRF、ORCA URL/host、患者氏名・住所・電話番号、保険番号詳細、invoice number raw、Data_Id raw、client-provided storage key/digest は保存しない。帳票ファイルを object storage へ保存する場合も storage key/digest は server-side authority で生成・検証する。
- `ORCA_OFFICIAL_INCOME_INFO` と `ORCA_REPORT_CREATE` は取得履歴として監査ログへ残す。監査 detail は runId/traceId、route/report type、Api_Result、HTTP status、invoice/data id の存在有無と hash などの要約に限定し、raw invoice number / raw Data_Id / raw ORCA body を出さない。

## Close And Send Billing Workflow
- 通常外来の初回 ORCA 会計送信は `POST /api/local/encounters/{encounterKey}/close-and-send-to-billing` から行う。client payload は `idempotencyKey` と任意 precheck flag に限定し、`patientId` / `facilityId` / voucher / sequential / insurance / `Medical_Uid` / `classCode` / raw XML / URL は受け付けない。
- server は認証 principal の facility、`encounter_projection`、保存済み order/disease から snapshot を作り、`d_billing_orca_snapshot` と `d_billing_orca_transmission` に状態を記録する。状態 enum は `DRAFT`, `READY_TO_SEND`, `ORCA_SENDING`, `ORCA_DISEASE_SYNCED`, `ORCA_MEDICAL_REGISTERED`, `ORCA_CONFIRMED`, `ORCA_FAILED`, `ORCA_UNKNOWN`, `DIRTY_AFTER_SENT`, `ORCA_LOCKED_OR_OPENED`, `CORRECTION_REQUIRED` に固定する。
- `medicalmodv2 class=01` の送信後は、`Medical_Uid` が返った場合でも `tmedicalgetv2` read-only 再取得で同一患者・診療日・診療科の中途終了データを照合するまで user-visible completion にしない。再取得・照合に失敗した場合、または一致候補がない場合は `ORCA_UNKNOWN` / `operationStatus=UNKNOWN` / `needsUserReview=true` とする。
- `medicalmodv2 class=01` 成功時は `Medical_Uid` の raw 値を UI / audit / tracked evidence に出さず、存在有無だけを sanitized summary に残す。通信断や `Medical_Uid` 欠落など結果不明時は `ORCA_UNKNOWN` とし、response / stored sanitized summary に `operationStatus=UNKNOWN` と `needsUserReview=true` を残す。`UNKNOWN` は成功扱いせず、無条件再送せず `tmedicalgetv2` で中途終了データを確認してから recovery 操作へ進める。
- `medicalmodv2` response は `operationStatus` と `needsUserReview` を返す。警告を含む場合は `Api_Result` が正常でも `ORCA_WARNING` / `needsUserReview=true` とし、Web client は成功バナーに潰さず要確認として表示する。業務拒否は `ORCA_REJECTED`、transport failure は `NETWORK_FAILED`、parse ambiguity は `UNKNOWN` として扱い、raw XML、内部 URL、資格情報、患者詳細、保険詳細は response / audit / tracked evidence に残さない。
- `GET /api/local/encounters/orca-transmissions/review` は認証 principal の facility だけを authority とし、`ORCA_UNKNOWN`、`ORCA_FAILED`、`CORRECTION_REQUIRED` の transmission を sanitized 一覧として返す。client から facility、patient detail、状態 enum、ORCA URL、raw XML、voucher / sequential / insurance combination は受け取らず、`limit` は server 側で 1..100 に clamp する。
- `POST /api/local/encounters/orca-transmissions/{transmissionId}/reconcile-temporary-medical` は `ORCA_UNKNOWN`、`ORCA_FAILED`、`CORRECTION_REQUIRED` の review transmission だけを対象に、認証 principal の facility と保存済み snapshot から ORCA `tmedicalgetv2` read-only 照合を行う。request body の patient / facility / insurance / voucher / sequential / `Medical_Uid` / URL / raw XML は受け取らない。照合 request は server 側の患者番号、診療日、診療科から作り、response には一致件数、`Medical_Uid` の存在有無、`Medical_Mode` / `Medical_Mode2`、固定 `needsUserReview=true`、必要時の `resendBlocked` / `resendBlockReason` だけを返す。`Medical_Uid` 値、保険組合せ、raw ORCA body、資格情報、患者氏名、住所、電話番号は response / audit / tracked evidence に残さない。照合成功は再送成功や会計反映済みを意味せず、state transition は別の明示操作で行う。`Medical_Mode` または `Medical_Mode2` が空でなく `0` 以外の場合は fail-closed に `resendBlocked=true`、`resendBlockReason=ORCA_TEMPORARY_MEDICAL_MODE_LOCKED` とし、原則再送を止めて管理者確認に回す。
- `medicalmodv2 class=03` は ORCA 側で未展開・未変更と確認できた置換専用、`class=04` は明示的な追加送信専用とし、自動追加送信には使わない。
- PushAPI / `pusheventgetv2` は補助情報に限る。Push が来ないことを失敗・成功の正本にせず、永続状態と `Medical_Uid` / `tmedicalgetv2` 確認を正とする。

## ORCA Outage Operations
- ORCA outage / degraded readiness の運用手順は [../runbooks/orca-outage-recovery.md](../runbooks/orca-outage-recovery.md) を正本とする。
- ORCA outage 中も OpenDolphinNext 正本である診療録本文、SOAP、所見、説明内容、処方指示下書き、既存スナップショット、監査ログは閲覧・運用設定に応じた作成を許可できる。
- ORCA outage 中は ORCA患者作成・更新、ORCA病名送信、ORCA診療行為送信、会計送信、再送、追加送信、置換送信を fail-closed にする。local-only 患者、病名、保険、会計情報を ORCA 正本へ fallback 表示しない。
- 復旧後は `ORCA_UNKNOWN`、`ORCA_FAILED`、`CORRECTION_REQUIRED` を Reception の要確認一覧で再取得し、`tmedicalgetv2` read-only 再照合を行ってから再送可否を判断する。再送前の payload authority は server-side snapshot と server-derived encounter context だけとし、client-provided voucher、sequential、insurance combination、`Medical_Uid` は使わない。
- DB write path または監査ログ書き込みが degraded の場合は、ORCA readiness が `UP` でも read-only mode とする。監査不能な診療録変更、処方変更、添付変更、ORCA送信、再送、追加送信、置換送信、再照合結果の永続反映は fail-closed にする。
- backup restore 後は local DB 上の `ORCA_SENT` / `ORCA_CONFIRMED` / `ORCA_UNKNOWN` / `ORCA_FAILED` / `CORRECTION_REQUIRED` を ORCA 正本として昇格しない。監査ログ hash chain と診療録 content hash を検証し、ORCA患者・受付・保険・病名・診療行為・会計を server adapter 経由で再取得してから差分照合する。

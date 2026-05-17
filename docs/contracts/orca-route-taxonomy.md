# ORCA Route Taxonomy

最終更新: 2026-05-17

## 目的

public route の taxonomy を固定し、official / master / local / admin-internal の責務を混在させない。

- `official`: ORCA official transport 到達 API。公開 prefix は `/api/orca/official/*` のみ。
- `master`: OpenDolphin local master cache / projection backed read API。公開 prefix は `/api/orca/master/*` のみ。候補検索・入力補助用であり、ORCA 正本ではない。
- `local`: local-only wrapper / local projection / local persistence。公開 prefix は `/api/local/*` のみ。
- `admin-internal`: 管理 UI 向けの internal label / internal state。公開 prefix は `/api/admin/internal/*` のみ。
- `admin-management`: 管理者 step-up を要求する運用 API。公開 prefix は `/api/admin/master-updates/*` のみ。ORCA official/master public route ではない。

`/api/orca/*` の public route は `official` と `master` だけです。production fail-close sentinel、MSW mock/test-only legacy route surface、e2e/QA fixture surface、blocked-route detector、docs/reference、server route inventory negative assertion、web.xml exposure negative assertion に分類される route string は retained string または negative assertion であり、public route ではありません。mock / test / detector / docs reference は public route ではなく、`runtime-ready-smoke` の blocked route detector も success route ではありません。

## Route String Categories

以下は guard / docs / report で同じ名称を使う分類です。`public ORCA route contract` は retained string の guard category ではなく、production route として成立する `/api/orca/official/*` と `/api/orca/master/*` だけを指します。docs/reference、mock/test fixture、blocked-route detector、negative assertion は、たとえ official/master の literal を含んでも public route 宣言ではありません。各 category のファイル例は代表例であり、legacy route が `orcaQueueApi.ts` と `orcaQueue.ts` だけに残るという意味ではありません。guard の `path + route + category + reason` が実際の retained string 分類です。

1. public ORCA route contract
   current public surface は production route として公開される `official=/api/orca/official/*` と `master=/api/orca/master/*` だけです。docs/reference、mock/test fixture、blocked-route detector、server inventory assertion、web.xml exposure assertion は public route ではありません。`/api/orca/queue` と `/api/orca/pusheventgetv2` は inventory / exposure / runtime contract に含めません。
2. production fail-close sentinel
   production source に残す必要がある historical route string は、unavailable response や blocked state を返して browser network call を fail-close する sentinel としてだけ許可します。現行 tree の代表例は `web-client/src/features/outpatient/orcaQueueApi.ts` ですが、この category は public route ではなく、他の production source へ無制限に広げるものでもありません。
3. MSW mock/test-only legacy route surface
   MSW / isolated unit test / local mock 用の legacy route constant だけを指します。現行 tree の代表例は `web-client/src/mocks/handlers/orcaQueue.ts` ですが、これは public taxonomy ではなく、MSW/isolated test 以外の runtime で使ってはなりません。
4. e2e/QA fixture surface
   `tests/**`、`web-client/scripts/qa-*.mjs`、`web-client/plugins/flagged-mock-plugin.ts` の fixture / QA / dev-preview 用 route string です。public route ではなく、production source へ移動した場合は failure です。
5. blocked-route detector
   `web-client/scripts/verify-no-blocked-orca-route-strings.mjs`、`web-client/scripts/lib/orca-route-taxonomy-guard.mjs`、`web-client/scripts/runtime-ready-smoke.mjs`、classifier fixture test が legacy route を検出・拒否するために保持する route string です。runtime-ready-smoke 内の blocked-route detector は success route ではなく、browser request が出た場合に failure にする detector です。
6. docs/reference
   `docs/contracts`、`docs/runbooks`、`docs/releases`、`docs/implementation` の説明用 route string です。docs でも `/api/orca/queue` と `/api/orca/pusheventgetv2` 以外の `/api/orca/(official|master 以外)` を新規 route として書いた場合は failure です。
7. server route inventory negative assertion
   `server-modernized/src/test/java/open/dolphin/rest/PublicRouteInventoryContractTest.java` が `/api/orca/queue` と `/api/orca/pusheventgetv2` を server inventory に含めないことを確認する negative assertion です。public route ではありません。
8. web.xml exposure negative assertion
   `server-modernized/src/test/java/open/dolphin/rest/WebXmlEndpointExposureTest.java` が `/api/orca/queue` と `/api/orca/pusheventgetv2` を web.xml exposure として公開しないことを確認する negative assertion です。public route ではありません。

## Taxonomy Rules

- `/api/orca/*` 直下には `official` と `master` 以外を置かない。
- `/api/orca/queue` と `/api/orca/pusheventgetv2` は current public taxonomy に含めない。server public surface に登録せず、browser runtime が到達したら failure とみなす。
- official transport を呼ばない local wrapper / local read model / local persistence を `/api/orca/*` に置かない。
- master-backed read は `/api/orca/master/*` へ寄せ、official bridge と混在させない。production / normal dev runtime の master search は `ORCADS`、`ORCA_DB_*`、ORCA PostgreSQL 直結、`jma-receipt-docker-db-1` を使わない。
- local master cache の本番更新は `/api/admin/master-updates/*` の管理者 step-up route と scheduler だけで行う。公式 source 由来 canonical artifact の生成と DB コンテナ parity 検証は runtime 外の運用作業であり、新しい `/api/orca/*` route として公開しない。
- audit action も taxonomy に合わせ、official は `ORCA_OFFICIAL_*`、master は `ORCA_MASTER_*`、local は `LOCAL_*` を使う。
- audit details には route taxonomy に一致する `scope=official|master|local|admin-internal` を入れ、action だけに依存せず追跡できるようにする。
- official patient 系 audit action は `ORCA_OFFICIAL_CREATE_PATIENT` / `ORCA_OFFICIAL_UPDATE_PATIENT` / `ORCA_OFFICIAL_GET_PATIENT` / `ORCA_OFFICIAL_SYNC_PATIENTS` に固定し、旧 patient-first naming や `ORCA_PATIENT_GET` を残さない。
- official 風の名称 (`patientmodv2`, `patientgetv2`, `medicalmodv2`, `subjectivesv2`) を local path / local metadata に残さない。
- admin 向け internal wrapper の label は `/api/admin/internal/*` を表示し、official surface と誤認させない。
- UI copy でも、`contraindicationcheckv2` の patient-aware official check と `/api/orca/master/order/interactions/check` の master-based static check を混同させない。
- `/api/local/charts/subjectives`, `/api/local/encounters/{encounterKey}/medical-summary` は local-only surface として表示し、official ORCA write のような名称を付けない。
- local patient create / update surface は公開しない。patient create / update は `/api/orca/official/patientmodv2/outpatient/*` の official bridge だけを使い、成功後 canonical re-fetch / local sync を行う。
- patient delete surface は public route として実装しない。`DELETE /api/orca/official/patient*`、`DELETE /api/local/patient*`、local patient create/update/delete alias は route inventory guard で禁止する。
- 旧 public path の alias / shim は作らない。

## Current Route Map

### Official

- `/api/orca/official/appointments/list`
- `/api/orca/official/appointments/patient`
- `/api/orca/official/appointments/medical-information`
- `/api/orca/official/appointments/mutation`
- `/api/orca/official/billing/estimate`
- `/api/orca/official/visits/list`
- `/api/orca/official/visits/acceptance-list`
- `/api/orca/official/visits/mutation`
- `/api/orca/official/patientgetv2`
- `/api/orca/official/patientmodv2/outpatient/create`
- `/api/orca/official/patientmodv2/outpatient/update`
- `/api/orca/official/patients/id-list`
- `/api/orca/official/patients/batch`
- `/api/orca/official/patients/name-search`
- `/api/orca/official/insurance/combinations`
- `/api/orca/official/patients/former-names`
- `/api/orca/official/patients/import`
- `/api/orca/official/patients/sync/run`
- `/api/orca/official/chart-support/medical-mod-v2`
- `/api/orca/official/chart-support/medication-get`
- `/api/orca/official/chart-support/contraindication-check`
- `/api/orca/official/chart-support/income-info`
- `/api/orca/official/chart-support/disease-mod-v3`
- `/api/orca/official/reports/{type}`
- `/api/orca/official/disease-master/name/{param}/`

### Master

- `/api/orca/master/generic-class`
- `/api/orca/master/generic-price`
- `/api/orca/master/drug`
- `/api/orca/master/hokenja`
- `/api/orca/master/address`
- `/api/orca/master/comment`
- `/api/orca/master/bodypart`
- `/api/orca/master/youhou`
- `/api/orca/master/material`
- `/api/orca/master/kensa-sort`
- `/api/orca/master/etensu`
- `/api/orca/master/reference/status`
- `/api/orca/master/order/inputsets`
- `/api/orca/master/order/inputsets/{setCode}`
- `/api/orca/master/order/interactions/check`

### Local

- `/api/local/patients/search`
- `/api/local/charts/subjectives`
- `/api/local/charts/medical-records`
- `/api/local/encounters/{encounterKey}/medical-summary`
- `/api/local/encounters/{encounterKey}/close-and-send-to-billing`
- `/api/local/encounters/orca-transmissions/review`
- `/api/local/encounters/orca-transmissions/{transmissionId}/reconcile-temporary-medical`
- `/api/local/diagnoses/{patientId}?baseMonth=yyyyMM`
- `/api/local/order/bundles`
- `/api/local/order/recommendations`
- `/api/local/orca/medical-candidates/from-chart/{chartRevisionId}`
- `/api/local/orca/medical-candidates/from-chart/{chartRevisionId}/latest`
- `/api/local/prescription-orders`
- `/api/local/prescription-orders/authority`
- `/api/local/prescription-orders/authority/{prescriptionId}/finalize`
- `/api/local/prescription-orders/authority/{prescriptionId}/change`
- `/api/local/prescription-orders/authority/{prescriptionId}/stop`
- `/api/local/prescription-orders/authority/{prescriptionId}/cancel`
- `/api/local/prescription-orders/authority/{prescriptionId}/reissue`
- `/api/local/prescription-orders/authority/{prescriptionId}/resend`

`/api/local/diagnoses/{patientId}?baseMonth=yyyyMM` は Charts 向けの ORCA disease read model です。`baseMonth` は server が `yyyyMM` として検証し、ORCA `Base_Date` と cache `base_month` の authority にします。主 `diseases` は ORCA `diseasegetv2?class=01` 再取得結果だけを返し、既存 local-only disease は `pendingLocalDiseases` に `layer=candidate` / `candidateKind=draftCandidate` / `sourceOfTruth=local-candidate` として隔離します。ORCA `Api_Result=21` は正常 0 件として扱います。`includeEnded=true` は server が `Select_Mode=All` に変換します。ORCA unavailable 時に local-only disease を主 `diseases` へ fallback してはいけません。`POST /api/local/diagnoses` は公開しません。ORCA 病名 mutation は local route ではなく official `/api/orca/official/chart-support/disease-mod-v3` を使用します。

`GET /api/orca/official/appointments/list?date=yyyy-MM-dd` と `GET /api/orca/official/appointments/patient?patientId=...` は ORCA appointment official read wrapper です。既存の JSON body `POST` 形式は互換 route として残しますが、GET query 形式でも server-side request DTO へ正規化して同じ official transport/audit path を通します。facility は認証済み request context から解決し、client 提供の facility / owner / role / URL / storage key / digest は使いません。query の日付は `yyyy-MM-dd` だけを許可し、形式不正は ORCA transport 前に固定 `orca.appointment.invalid` で fail closed します。監査 detail は operation、safe date field、source metadata に限定し、raw ORCA body、患者詳細、保険詳細、credential、Cookie、Authorization、CSRF は保存しません。

`/api/orca/official/patientgetv2` は ORCA 患者正本の read wrapper です。facility は認証済み request context から解決し、client 提供の facility / owner / URL / storage key / digest は受け取りません。成功応答 body は既存の ORCA official JSON/XML 互換を維持し、source metadata は `X-Orca-Source-System=ORCA`、`X-Orca-Source-Api=patientgetv2`、`X-Orca-Fetched-At`、`X-Orca-Cache-Status`、`X-Orca-Stale`、`X-Orca-Business-Status` の response header と監査 details に固定して返します。取得結果は `orca_patient_cache` に `source_system=ORCA`、`source_api=patientgetv2`、`fetched_at`、`cache_expires_at`、`cache_status`、`business_status`、`raw_response_hash`、normalized payload として保存します。raw ORCA body、ORCA credential、接続先 URL、Cookie、CSRF、Authorization は保存しません。`Api_Result=10` または患者不在 wording は HTTP 404 ではなく `ORCA_PATIENT_NOT_FOUND` business status として扱います。local cache は表示用 cache であり、ORCA 障害時や cache 書き込み失敗時に current source として昇格してはいけません。

`/api/local/patients/search` は local-only patient picker の read model です。通常は `PatientModel` local sync row だけを検索しますが、patient ID exact search で local row が 0 件の場合に限り、同一 facility の `orca_patient_cache` の `cache_status=CURRENT` / `business_status=ORCA_PATIENT_FOUND` / 期限内 row から最小表示 record を補助返却できます。この fallback は Trial read-only preflight で直前の official `patientgetv2` cache を local selectable に橋渡しするための表示専用経路であり、ORCA正本 mutation、local patient CRUD、患者削除、保険詳細取得、または Phase 3 mutation approval ではありません。NOT_FOUND / NEEDS_REVIEW / UNAVAILABLE / stale cache は返さず、fallback record は patient id / name / kana / birth date / sex に限定し、住所・電話・raw ORCA body・credential・Cookie・Authorization・CSRF・保険詳細は返しません。

`/api/orca/official/patientmodv2/outpatient/create` と `/api/orca/official/patientmodv2/outpatient/update` は ORCA 患者作成・更新の唯一の mutation route です。facility は認証済み request context / remote user / server-side tenant context からだけ解決し、`X-Facility-Id` header や client 提供の facility / owner / role / URL / storage key / digest は使いません。remote user から facility を解決できない場合、または非 composite principal の場合は ORCA transport 前に fail closed します。create は `patientmodv2 class=01`、update は `patientmodv2 class=02` を server が選択し、送信前に server-side ORCA baseline と editable field 差分を解決します。ORCA mutation が失敗した場合は local patient sync を実行せず、更新済み応答を返しません。ORCA mutation が受け付けられた後も、`patientgetv2` の canonical re-fetch が `ORCA_PATIENT_FOUND` / `CURRENT` を返し、`orca_patient_cache` へ保存され、local sync が完了するまで `canonicalRefetched=true` / `localSynced=true` の同期確認済み応答にしません。既存 local patient と同一内容で idempotent と判断する場合も、local row だけを根拠に成功扱いせず、patientmodv2 は送らずに patientgetv2 canonical re-fetch と local sync 確認を必須にします。応答と監査 details は actor、resolvedFacilityId、orcaPatientId、operationId、`canonicalSourceApi=patientgetv2`、`canonicalCacheStatus`、`canonicalBusinessStatus`、`canonicalRawResponseStored=false` などの allowlist metadata に限定し、raw ORCA body、ORCA credential、接続先 URL、患者住所・電話などの詳細、Cookie、CSRF、Authorization は保存・返却しません。

`/api/orca/official/visits/acceptance-list` は ORCA `acceptlstv2` 由来の受付 inventory read wrapper です。facility は認証済み request context から解決し、client 提供の facility / owner / role / URL / storage key / digest は使いません。取得結果は `orca_acceptance_cache` に `source_system=ORCA`、`source_api=acceptlstv2`、`orca_patient_id`、`orca_acceptance_id` または受付複合 key、受付日/時刻、診療科、担当医、保険組合せ、`fetched_at`、`cache_expires_at`、source request/trace metadata、normalized payload として保存します。raw ORCA body、ORCA credential、接続先 URL、患者詳細、保険詳細、Cookie、CSRF、Authorization は保存しません。同一 facility/date の前回 cache に存在し、今回 inventory に存在しない受付は削除せず `acceptance_status=CANCELLED` / `event_type=ORCA_ACCEPTANCE_CANCELLED` として記録します。この受付 cache event だけで院内 encounter workflow を自動削除・自動取消しません。既存受付の患者番号、時刻、診療科、担当医、診療情報、保険組合せが変化した場合は `DIFF_DETECTED` / `ORCA_ACCEPTANCE_DIFF_DETECTED` として保持し、cache 不足や必須 server-derived field 欠落は `NEEDS_REVIEW` とします。受付 cache は ORCA 正本の表示用 cache であり、ORCA 障害時や cache 書き込み失敗時に current source として昇格してはいけません。cache 書き込み失敗時の audit は sanitized failure metadata のみに限定し、成功系 cache count を付けません。

`encounter_orca_acceptance_link` は `encounter_projection` と ORCA 受付 cache の server-side 紐付け投影です。`encounter_key` ごとに server-derived `orca_acceptance_id` / 受付日 / 診療科 / 担当医 / 保険組合せを固定し、`acceptlstv2` cache が `CANCELLED` / `DIFF_DETECTED` / `NEEDS_REVIEW` になった場合は `warning_status` と `changed_fields_json` へ警告だけを同期します。患者 cache 更新時は `patient_cache_status` / `patient_business_status` / `patient_warning_status` / freshness timestamp を同期し、ORCA患者不在・要確認・取得不能・stale を `CLEAR` と区別します。保険 cache 更新時は `insurance_cache_status` / `insurance_warning_status` / freshness timestamp と、保険組合せ差分を field-level の `insurance_changed_fields_json` に同期します。この link table は UI/API が受付取消・診療科・担当医・保険組合せ差分、患者 cache stale、保険 freshness / 差分を表示するための read model であり、cache event だけで `encounter_projection.business_state` や将来の `encounter_workflow_state` を削除・取消・会計済みに変更してはいけません。link row は `raw_sensitive_fields_excluded=true`、`client_provided_identifiers_trusted=false`、`server_derived_authority_required=true` を DB constraint で固定し、raw ORCA body、患者詳細、保険詳細、credential、Cookie、Authorization、CSRF は保持しません。

`/api/orca/official/insurance/combinations` は ORCA `insuranceinf1v2` 由来の保険組合せ read wrapper です。facility は認証済み request context から解決し、client 提供の facility / owner / role / URL / storage key / digest は使いません。取得結果は `orca_insurance_cache` に `source_system=ORCA`、`source_api=insuranceinf1v2`、ORCA 患者番号、基準日、保険組合せ番号、provider class/name、負担率、有効期間、public insurance count、`fetched_at`、`cache_expires_at`、source request/trace metadata、normalized payload として保存します。raw ORCA body、ORCA credential、接続先 URL、患者詳細、被保険者番号、保険詳細、Cookie、CSRF、Authorization は保存しません。同一 facility/patient/baseDate/combination の要約 hash が変化した場合は `DIFF_DETECTED`、必須 field 欠落は `NEEDS_REVIEW` とします。診療時点の保険は `encounter_insurance_snapshot` に immutable snapshot として固定し、再作成時は既存 snapshot を上書きせず、現在候補との差分 field だけを返します。

`/api/local/encounters/{encounterKey}/medical-summary` は Charts 向けの local read model で、認証済み request context の facility と `encounter_projection.facility_id` が一致する場合だけ応答します。payload の `orcaContext` は `encounter_orca_acceptance_link` 由来の server-derived 受付 ID、受付日/時刻、診療科、担当医、保険組合せ、受付 warning、患者 cache warning/freshness、保険 cache warning/freshness、field-level changed fields だけを返します。raw ORCA body、患者住所・電話、保険詳細、credential、Cookie、Authorization、CSRF、storage key/digest は返しません。他施設 encounterKey、read model 不整合、DB 取得不能は local summary error envelope で fail closed にし、client 提供の patient / insurance / acceptance 値から warning を合成しません。

`/api/local/encounters/{encounterKey}/close-and-send-to-billing` は通常外来の初回 ORCA 会計送信用 local workflow です。facility は認証済み request context と `encounter_projection` だけを authority とし、client 提供の patient / facility / acceptance / department / physician / insurance / voucher / sequential / `Medical_Uid` / classCode / URL / raw XML を受け取りません。`encounter_projection` に server-derived ORCA受付 ID と受付日時がない場合は `orca_acceptance_missing` で fail closed にし、患者・カルテ・ORCA transport lookup へ進みません。`worklist_flags_json.officialVisitIdentifiers.voucherNumber` が `encounter_projection.orca_acceptance_id` と不一致の場合も ORCA transport 前に fail closed にします。既存の同一 idempotency transmission は保存済み結果として返しますが、新規 idempotency の送信は会計送信済み/閉鎖相当の `business_state` では `encounter_billing_send_blocked` として止めます。

`/api/local/encounters/orca-transmissions/review` と `/api/local/encounters/orca-transmissions/{transmissionId}/reconcile-temporary-medical` は close-and-send billing recovery 用の local workflow です。facility は認証済み request context だけを authority とし、client 提供の patient / facility / insurance / voucher / sequential / `Medical_Uid` / URL / raw XML を受け取りません。`reconcile-temporary-medical` は request body を受け付けず、未サニタイズまたは client-trusted snapshot を authority にしません。保存済み snapshot の診療日/診療科と保存済み record の患者番号から ORCA `tmedicalgetv2` を read-only で照合します。parse 不能または `Api_Result` 欠落 response は `apiResult=unknown` と sanitized message に正規化し、raw body や parser 詳細を返しません。ORCA `Api_Result` が `"00"` でない場合は response row を一致候補、`Medical_Uid` presence、resend block 判定に使いません。ORCA response row に診療日がある場合は snapshot 診療日と一致する row だけを候補にします。snapshot の診療日または診療科が欠落している場合は ORCA transport 前に fail closed とし、成功表示や自動再送ではなく `needsUserReview=true` の sanitized summary だけを返します。

`/api/local/orca/medical-candidates/from-chart/{chartRevisionId}` は chart revision に紐付く処方正本から ORCA 診療行為送信候補を作る local prepare route です。candidate は `orca_medical_candidate` に `source_system=LOCAL_PRESCRIPTION` として保存され、ORCA 正本ではありません。facility は認証済み request context、patient / encounter / prescription revision は DB 上の処方正本から解決します。client 提供の patient / facility / insurance / voucher / sequential / URL / raw XML / digest は受け取りません。薬剤コード・用法コード・medical class が未解決の項目は `NEEDS_REVIEW` かつ `sendable=false` として返し、live `medicalmodv2` 送信は行いません。

`/api/local/orca/medical-candidates/from-chart/{chartRevisionId}/latest` は同じ facility / chart revision の最新 local prescription candidate を再確認用に返します。新規 candidate 作成や live `medicalmodv2` 送信は行わず、保存済みの sanitized candidate snapshot と issue summary からレスポンスを再構成します。facility は認証済み request context だけを authority とし、client 提供の patient / facility / insurance / voucher / sequential / URL / raw XML / digest は受け取りません。保存済み candidate の処方 order id、revision id、content hash、または現在 status が現在の chart revision の送信候補化可能な処方 source と一致しない場合は `prescription_candidate_source_stale` として `NEEDS_REVIEW` / `sendable=false` を返します。

`GET /api/local/prescription-orders` は local prescription cache/projection の read-only 取得口です。production runtime では処方 payload 保存、do-import、PUT/PATCH/DELETE mutation を公開しません。facility は認証済み request context から解決し、patient / encounter も server-side lookup で照合します。client 提供の facility / owner / role / digest / URL / storage key は権威値にしません。

`/api/local/prescription-orders/authority` と `/api/local/prescription-orders/authority/{prescriptionId}/finalize|change|stop|cancel|reissue|resend` は OpenDolphinNext 正本の処方 authority mutation route です。旧 `/api/prescriptions` は taxonomy 外 route として公開しません。処方 event は append-only で、`previous_event_hash` / `event_hash` を server が必須投入し、hash chain 検証で DB 上の過去 event 改ざんを検出できる必要があります。`resend` は ORCA 送信成功扱いではなく、UNKNOWN 解消や二重送信防止判断後の再送判断 event に限定します。

### Admin-Internal

- `/api/admin/internal/orca/patients/sync/status`
- admin capability labels:
  `/api/admin/internal/orca/medical-sets`
  `/api/admin/internal/orca/birth-delivery`

### Admin-Management

- `/api/admin/master-updates/datasets`
- `/api/admin/master-updates/datasets/{datasetCode}`
- `/api/admin/master-updates/datasets/{datasetCode}/run`
- `/api/admin/master-updates/datasets/{datasetCode}/rollback`
- `/api/admin/master-updates/datasets/{datasetCode}/upload`
- `/api/admin/master-updates/schedule`
- `/api/admin/master-updates/visibility`

`local_orca_master_cache` の admin-management route は OpenDolphin local master cache / projection の更新口であり、ORCA official route でも ORCA DB 直結 route でもない。本番 source は公式 ORCA 配布ファイル、公式 API 由来 canonical artifact、または施設内 tool-only ETL が ORCA DB コンテナから生成した canonical artifact に限定し、runtime の外部取得は `MASTER_UPDATE_LOCAL_ORCA_MASTER_CACHE_SOURCE_URL` と `MASTER_UPDATE_SOURCE_ALLOWED_HOSTS` で明示許可した HTTPS host だけに固定する。取得失敗・import 失敗は dataset failed とし、未取得を 0 件や「安全確認済み」に変換しない。

`/api/admin/master-updates/visibility` は業務 UI の ORCA master 候補表示カテゴリだけを切り替える admin-management route です。`GET` は認証済み業務 UI が参照し、`PUT` は admin + `admin:mutation` step-up を必須とします。この route は `/api/orca/master/*` の公開停止、local master cache 更新、ORCA 正本確認、会計反映、安全確認、相互作用チェック停止を意味しません。未知カテゴリや任意 route 名は server allowlist で 400 とし、監査 details は changedCategories などの非秘密 metadata に限定します。

WebORCA Trial は本番相当の official ORCA 接続先として release validation に使ってよい。ただし、Trial を使う場合も public route taxonomy は変えない。master update は `/api/admin/master-updates/*`、master read は `/api/orca/master/*`、official ORCA transport は `/api/orca/official/*` に分離する。Trial の自由語検索や候補検索を全件 master source とみなす route、Trial 由来候補を ORCA 正本確認済みに見せる route、新しい `/api/orca/*` の runtime source route は追加しない。

### Intentional Fail-Close Exceptions

- `/api/orca/queue`
- `/api/orca/pusheventgetv2`

上記 2 つは current public route ではありません。production fail-close sentinel、MSW mock/test-only legacy route surface、e2e/QA fixture surface、blocked-route detector、docs/reference、server route inventory negative assertion、web.xml exposure negative assertion として分類された retained string / negative assertion だけを許可します。route inventory・web.xml exposure・browser request・release evidence の success route として hit させません。

## Taxonomy Checkpoints

- patient create / update は official bridge として `/api/orca/official/patientmodv2/outpatient/*` に固定する。
- appointment / visit / billing / report / chart-support / disease lookup は official bridge として `/api/orca/official/*` に固定する。
- Charts の ORCA 病名 create / update / delete / 削除病名整理は official bridge として `/api/orca/official/chart-support/disease-mod-v3` に固定する。病名本体は `Disease_Single` component 列を正本にし、通常 CRUD は `Disease_Code` 単独や自由文字列だけで送らない。`Request_Number=01` は削除病名整理だけで server が生成し、通常 CRUD や client payload からは送らない。
- order inputsets / interaction check は master-backed read として `/api/orca/master/order/*` に固定する。
- `/api/orca/master/*` は local master cache の `cacheStatus=NOT_IMPORTED|UNAVAILABLE|STALE` を UI/API に伝播し、未インポート・取得不能を 0 件と混同しない。local cache の候補コードは ORCA 送信成功・会計反映・ORCA 正本確認の根拠ではない。
- order bundles / recommendations / prescription orders / chart medical summary / diagnosis read model は local-only として `/api/local/*` に固定する。`/api/local/prescription-orders` は read-only projection だけを許可し、処方 mutation は `/api/local/prescription-orders/authority*` に限定する。病名 mutation は local-only route に置かない。
- 通常外来の初回会計送信は local workflow `/api/local/encounters/{encounterKey}/close-and-send-to-billing` に固定する。結果不明・失敗・補正要確認の確認は local workflow `/api/local/encounters/orca-transmissions/*` に固定する。client が `patientId` / `facilityId` / voucher / sequential / insurance / `Medical_Uid` / `classCode` を送る direct official 初回送信は通常 UI に戻さない。`/api/orca/official/chart-support/medical-mod-v2` は low-level official bridge / QA focused test 用として残す。
- sync status と admin wrapper label は `/api/admin/internal/*` に固定する。master update の実行・upload・scheduler 設定は管理者 step-up 必須の `/api/admin/master-updates/*` に固定し、`/api/orca/*` へ置かない。
- local patient mutation route は current public taxonomy から除外する。local patient CRUD 用の DTO、JAX-RS resource、admin wrapper は production route registration へ戻さない。

## Verification Contract

- `PublicRouteInventoryContractTest` は taxonomy 別 inventory を固定し、official/master/local/admin-internal の逸脱を検知する。`/api/orca/queue` と `/api/orca/pusheventgetv2` の literal は server route inventory negative assertion としてだけ扱う。
- `PublicRouteInventoryContractTest` は旧 `POST /api/local/prescription-orders`、`POST /api/local/prescription-orders/do-import`、および any `PUT/PATCH/DELETE /api/local/prescription-orders*` が inventory に存在しないこと、処方 mutation が `/api/local/prescription-orders/authority*` にしか存在しないことを検証する。
- `WebXmlEndpointExposureTest` は `/api/*` の単一 public entrypoint に加え、route prefix が taxonomy に収まり、`/api/orca/queue` と `/api/orca/pusheventgetv2` が露出していないことを検証する。さらに旧 local prescription write/import route が露出せず、`GET /api/local/prescription-orders` と authority mutation だけが残ることを確認する。該当 literal は web.xml exposure negative assertion としてだけ扱う。
- ORCA `Api_Result` の success/warn/error tone policy は `web-client/src/libs/orca/orcaApiResultPolicy.ts` を正本とし、feature ローカル実装を増やさない。
- `web-client/src/libs/http/httpClient.ts` と administration wrapper metadata は `scope=official|master|local` を明示し、実 path と一致させる。
- `verify-no-blocked-orca-route-strings.mjs` は `server-modernized/src/test`、`web-client/src`、`web-client/scripts`、`web-client/plugins`、`tests`、`docs/contracts`、`docs/runbooks`、`docs/releases`、`docs/implementation` を repo-wide に走査する。存在しない root は明示 skip、存在する root の走査失敗は fail とする。
- guard の allowlist は `path + route + category + reason` で定義し、legacy route string と mock-only surface の残存理由を固定する。
- guard は success message に category counts を出し、production fail-close sentinel / MSW mock/test-only legacy route surface / e2e/QA fixture surface / blocked-route detector / docs/reference / server route inventory negative assertion / web.xml exposure negative assertion の分類が current tree と一致することを示す。official/master の actual public route reference は許可対象だが retained category としては数えない。
- docs/reference、mock/test fixture、blocked-route detector の category count は、該当 route string が説明・検出・fixture 用に残っていることだけを示す。public route の存在証明、live success、Phase 3 実行許可、HTTP 200 business success の代替証跡として扱わない。
- allowlist にない `/api/orca/queue` または `/api/orca/pusheventgetv2` は failure とする。
- `/api/orca/(official|master 以外)` の route string は、上記 2 legacy route または blocked-route detector の fixture でない限り failure とする。
- `/api/orca/official/*/mock` などの mock/test-only route surface が production source (`web-client/src` の mocks/test 以外) に混入した場合は failure とする。
- repo grep で旧 path を runtime 参照として残さない。

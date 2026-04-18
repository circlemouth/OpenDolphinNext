# ORCA Route Taxonomy

最終更新: 2026-04-19

## 目的

public route の taxonomy を固定し、official / master / local / admin-internal の責務を混在させない。

- `official`: ORCA official transport 到達 API。公開 prefix は `/api/orca/official/*` のみ。
- `master`: master-backed read API。公開 prefix は `/api/orca/master/*` のみ。
- `local`: local-only wrapper / local projection / local persistence。公開 prefix は `/api/local/*` のみ。
- `admin-internal`: 管理 UI 向けの internal label / internal state。公開 prefix は `/api/admin/internal/*` のみ。

## Route String Categories

1. server public ORCA route surface
   current public surface は `official=/api/orca/official/*` と `master=/api/orca/master/*` だけです。`/api/orca/queue` と `/api/orca/pusheventgetv2` は inventory / exposure / runtime contract に含めません。
2. client production fail-close sentinel
   `web-client/src/features/outpatient/orcaQueueApi.ts` にだけ historical route string を残し、unavailable response を返して browser network call を fail-close します。
3. mock/test-only legacy route surface
   `web-client/src/mocks/handlers/orcaQueue.ts` にだけ mock/test 用の legacy route constant を残します。これは public taxonomy ではなく、MSW/isolated test 以外の runtime で使ってはなりません。
4. e2e fixture/test-only surface
   `tests/**`、`web-client/scripts/qa-*.mjs`、`web-client/plugins/flagged-mock-plugin.ts` の fixture / QA / dev-preview 用 route string です。production source へ移動した場合は failure です。
5. blocked-route detector
   `web-client/scripts/verify-no-blocked-orca-route-strings.mjs`、`web-client/scripts/lib/orca-route-taxonomy-guard.mjs`、`web-client/scripts/runtime-ready-smoke.mjs`、classifier fixture test が legacy route を検出・拒否するために保持する route string です。
6. docs/reference
   `docs/contracts`、`docs/runbooks`、`docs/releases`、`docs/implementation` の説明用 route string です。docs でも `/api/orca/queue` と `/api/orca/pusheventgetv2` 以外の `/api/orca/(official|master 以外)` を新規 route として書いた場合は failure です。

## Taxonomy Rules

- `/api/orca/*` 直下には `official` と `master` 以外を置かない。
- `/api/orca/queue` と `/api/orca/pusheventgetv2` は current public taxonomy に含めない。server public surface に登録せず、browser runtime が到達したら failure とみなす。
- official transport を呼ばない local wrapper / local read model / local persistence を `/api/orca/*` に置かない。
- master-backed read は `/api/orca/master/*` へ寄せ、official bridge と混在させない。
- audit action も taxonomy に合わせ、official は `ORCA_OFFICIAL_*`、master は `ORCA_MASTER_*`、local は `LOCAL_*` を使う。
- audit details には route taxonomy に一致する `scope=official|master|local|admin-internal` を入れ、action だけに依存せず追跡できるようにする。
- official patient 系 audit action は `ORCA_OFFICIAL_CREATE_PATIENT` / `ORCA_OFFICIAL_UPDATE_PATIENT` / `ORCA_OFFICIAL_GET_PATIENT` / `ORCA_OFFICIAL_SYNC_PATIENTS` に固定し、旧 patient-first naming や `ORCA_PATIENT_GET` を残さない。
- official 風の名称 (`patientmodv2`, `patientgetv2`, `medicalmodv2`, `subjectivesv2`) を local path / local metadata に残さない。
- admin 向け internal wrapper の label は `/api/admin/internal/*` を表示し、official surface と誤認させない。
- UI copy でも、`contraindicationcheckv2` の patient-aware official check と `/api/orca/master/order/interactions/check` の master-based static check を混同させない。
- `/api/local/charts/subjectives`, `/api/local/encounters/{encounterKey}/medical-summary`, `/api/local/patients/mutation` は local-only surface として表示し、official ORCA write のような名称を付けない。
- 旧 public path の alias / shim は作らない。

## Current Route Map

### Official

- `/api/orca/official/appointments/list`
- `/api/orca/official/appointments/patient`
- `/api/orca/official/appointments/medical-information`
- `/api/orca/official/appointments/mutation`
- `/api/orca/official/billing/estimate`
- `/api/orca/official/visits/list`
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
- `/api/local/patients/mutation`
- `/api/local/charts/subjectives`
- `/api/local/charts/medical-records`
- `/api/local/encounters/{encounterKey}/medical-summary`
- `/api/local/diagnoses`
- `/api/local/diagnoses/{patientId}`
- `/api/local/order/bundles`
- `/api/local/order/recommendations`
- `/api/local/prescription-orders`
- `/api/local/prescription-orders/do-import`

### Admin-Internal

- `/api/admin/internal/orca/patients/sync/status`
- admin capability labels:
  `/api/admin/internal/orca/medical-sets`
  `/api/admin/internal/orca/birth-delivery`

### Intentional Fail-Close Exceptions

- `/api/orca/queue`
- `/api/orca/pusheventgetv2`

上記 2 つは current public route ではありません。`web-client/src/features/outpatient/orcaQueueApi.ts` では production fail-close sentinel としてだけ残し、`web-client/src/mocks/handlers/orcaQueue.ts` では mock/test-only legacy route surface としてだけ残します。route inventory・browser request・release evidence では hit させません。

## Taxonomy Checkpoints

- patient create / update は official bridge として `/api/orca/official/patientmodv2/outpatient/*` に固定する。
- appointment / visit / billing / report / chart-support / disease lookup は official bridge として `/api/orca/official/*` に固定する。
- order inputsets / interaction check は master-backed read として `/api/orca/master/order/*` に固定する。
- order bundles / recommendations / prescription orders / chart medical summary / diagnoses は local-only として `/api/local/*` に固定する。
- sync status と admin wrapper label は `/api/admin/internal/*` に固定する。
- `/api/local/patients/mutation` は `LocalPatientMutationRequest` / `LocalPatientMutationResponse` を使い、official patientmodv2 DTO と共有しない。

## Verification Contract

- `PublicRouteInventoryContractTest` は taxonomy 別 inventory を固定し、official/master/local/admin-internal の逸脱を検知する。
- `WebXmlEndpointExposureTest` は `/api/*` の単一 public entrypoint に加え、route prefix が taxonomy に収まり、`/api/orca/queue` と `/api/orca/pusheventgetv2` が露出していないことを検証する。
- ORCA `Api_Result` の success/warn/error tone policy は `web-client/src/libs/orca/orcaApiResultPolicy.ts` を正本とし、feature ローカル実装を増やさない。
- `web-client/src/libs/http/httpClient.ts` と administration wrapper metadata は `scope=official|master|local` を明示し、実 path と一致させる。
- `verify-no-blocked-orca-route-strings.mjs` は `web-client/src`、`web-client/scripts`、`web-client/plugins`、`tests`、`docs/contracts`、`docs/runbooks`、`docs/releases`、`docs/implementation` を repo-wide に走査する。存在しない root は明示 skip、存在する root の走査失敗は fail とする。
- guard の allowlist は `path + route + category + reason` で定義し、legacy route string と mock-only surface の残存理由を固定する。
- guard は success message に category counts を出し、server public route / client production fail-close sentinel / MSW mock-test-only legacy route surface / e2e fixture-test-only surface / blocked-route detector / docs-reference の分類が current tree と一致することを示す。
- allowlist にない `/api/orca/queue` または `/api/orca/pusheventgetv2` は failure とする。
- `/api/orca/(official|master 以外)` の route string は、上記 2 legacy route または blocked-route detector の fixture でない限り failure とする。
- `/api/orca/official/*/mock` などの mock/test-only route surface が production source (`web-client/src` の mocks/test 以外) に混入した場合は failure とする。
- repo grep で旧 path を runtime 参照として残さない。

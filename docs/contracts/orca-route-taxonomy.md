# ORCA Route Taxonomy

最終更新: 2026-04-20

## 目的

public route の taxonomy を固定し、official / master / local / admin-internal の責務を混在させない。

- `official`: ORCA official transport 到達 API。公開 prefix は `/api/orca/official/*` のみ。
- `master`: master-backed read API。公開 prefix は `/api/orca/master/*` のみ。
- `local`: local-only wrapper / local projection / local persistence。公開 prefix は `/api/local/*` のみ。
- `admin-internal`: 管理 UI 向けの internal label / internal state。公開 prefix は `/api/admin/internal/*` のみ。

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
- master-backed read は `/api/orca/master/*` へ寄せ、official bridge と混在させない。
- audit action も taxonomy に合わせ、official は `ORCA_OFFICIAL_*`、master は `ORCA_MASTER_*`、local は `LOCAL_*` を使う。
- audit details には route taxonomy に一致する `scope=official|master|local|admin-internal` を入れ、action だけに依存せず追跡できるようにする。
- official patient 系 audit action は `ORCA_OFFICIAL_CREATE_PATIENT` / `ORCA_OFFICIAL_UPDATE_PATIENT` / `ORCA_OFFICIAL_GET_PATIENT` / `ORCA_OFFICIAL_SYNC_PATIENTS` に固定し、旧 patient-first naming や `ORCA_PATIENT_GET` を残さない。
- official 風の名称 (`patientmodv2`, `patientgetv2`, `medicalmodv2`, `subjectivesv2`) を local path / local metadata に残さない。
- admin 向け internal wrapper の label は `/api/admin/internal/*` を表示し、official surface と誤認させない。
- UI copy でも、`contraindicationcheckv2` の patient-aware official check と `/api/orca/master/order/interactions/check` の master-based static check を混同させない。
- `/api/local/charts/subjectives`, `/api/local/encounters/{encounterKey}/medical-summary` は local-only surface として表示し、official ORCA write のような名称を付けない。
- local patient create / update surface は公開しない。patient create / update は `/api/orca/official/patientmodv2/outpatient/*` の official bridge だけを使い、成功後 canonical re-fetch / local sync を行う。
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
- `/api/local/prescription-orders`
- `/api/local/prescription-orders/do-import`

`/api/local/diagnoses/{patientId}?baseMonth=yyyyMM` は Charts 向けの ORCA disease read model です。`baseMonth` は server が `yyyyMM` として検証し、ORCA `Base_Date` と cache `base_month` の authority にします。主 `diseases` は ORCA `diseasegetv2?class=01` 再取得結果だけを返し、既存 local-only disease は `pendingLocalDiseases` に隔離します。ORCA `Api_Result=21` は正常 0 件として扱います。`includeEnded=true` は server が `Select_Mode=All` に変換します。ORCA unavailable 時に local-only disease を主 `diseases` へ fallback してはいけません。`POST /api/local/diagnoses` は公開しません。ORCA 病名 mutation は local route ではなく official `/api/orca/official/chart-support/disease-mod-v3` を使用します。

`/api/local/encounters/orca-transmissions/review` と `/api/local/encounters/orca-transmissions/{transmissionId}/reconcile-temporary-medical` は close-and-send billing recovery 用の local workflow です。facility は認証済み request context だけを authority とし、client 提供の patient / facility / insurance / voucher / sequential / `Medical_Uid` / URL / raw XML を受け取りません。`reconcile-temporary-medical` は保存済み snapshot から ORCA `tmedicalgetv2` を read-only で照合し、成功表示や自動再送ではなく `needsUserReview=true` の sanitized summary だけを返します。

### Admin-Internal

- `/api/admin/internal/orca/patients/sync/status`
- admin capability labels:
  `/api/admin/internal/orca/medical-sets`
  `/api/admin/internal/orca/birth-delivery`

### Intentional Fail-Close Exceptions

- `/api/orca/queue`
- `/api/orca/pusheventgetv2`

上記 2 つは current public route ではありません。production fail-close sentinel、MSW mock/test-only legacy route surface、e2e/QA fixture surface、blocked-route detector、docs/reference、server route inventory negative assertion、web.xml exposure negative assertion として分類された retained string / negative assertion だけを許可します。route inventory・web.xml exposure・browser request・release evidence の success route として hit させません。

## Taxonomy Checkpoints

- patient create / update は official bridge として `/api/orca/official/patientmodv2/outpatient/*` に固定する。
- appointment / visit / billing / report / chart-support / disease lookup は official bridge として `/api/orca/official/*` に固定する。
- Charts の ORCA 病名 create / update / delete / 削除病名整理は official bridge として `/api/orca/official/chart-support/disease-mod-v3` に固定する。病名本体は `Disease_Single` component 列を正本にし、通常 CRUD は `Disease_Code` 単独や自由文字列だけで送らない。`Request_Number=01` は削除病名整理だけで server が生成し、通常 CRUD や client payload からは送らない。
- order inputsets / interaction check は master-backed read として `/api/orca/master/order/*` に固定する。
- order bundles / recommendations / prescription orders / chart medical summary / diagnosis read model は local-only として `/api/local/*` に固定する。病名 mutation は local-only route に置かない。
- 通常外来の初回会計送信は local workflow `/api/local/encounters/{encounterKey}/close-and-send-to-billing` に固定する。結果不明・失敗・補正要確認の確認は local workflow `/api/local/encounters/orca-transmissions/*` に固定する。client が `patientId` / `facilityId` / voucher / sequential / insurance / `Medical_Uid` / `classCode` を送る direct official 初回送信は通常 UI に戻さない。`/api/orca/official/chart-support/medical-mod-v2` は low-level official bridge / QA focused test 用として残す。
- sync status と admin wrapper label は `/api/admin/internal/*` に固定する。
- local patient mutation route は current public taxonomy から除外する。local patient CRUD 用の DTO、JAX-RS resource、admin wrapper は production route registration へ戻さない。

## Verification Contract

- `PublicRouteInventoryContractTest` は taxonomy 別 inventory を固定し、official/master/local/admin-internal の逸脱を検知する。`/api/orca/queue` と `/api/orca/pusheventgetv2` の literal は server route inventory negative assertion としてだけ扱う。
- `WebXmlEndpointExposureTest` は `/api/*` の単一 public entrypoint に加え、route prefix が taxonomy に収まり、`/api/orca/queue` と `/api/orca/pusheventgetv2` が露出していないことを検証する。該当 literal は web.xml exposure negative assertion としてだけ扱う。
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

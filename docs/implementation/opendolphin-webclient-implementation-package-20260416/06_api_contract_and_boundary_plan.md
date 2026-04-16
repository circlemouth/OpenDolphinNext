# 06. API Contract and Boundary Plan

## 1. 基本原則
1. client は source of truth ではない。client は **projection / guard / copy / fail-close** を担当する
2. server は source of truth / validation / route taxonomy / DTO schema の owner である
3. ORCA は outbound action source と confirmation source が分かれる。**confirmation source と outbound action を同一視しない**
4. unknown source は gate へ送る。client 側補完で owner を捏造しない
5. boundary が未確定の domain は feature-off, read-only, note-only, snapshot-only のいずれかへ fail-close する

## 2. client / server / ORCA boundary matrix
| Domain | client owner | server owner | ORCA role | source of truth | outbound action | confirmation source | fixed now | gate |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Reception handoff | `receptionHandoff.ts`, `ReceptionPage.tsx` | `OrcaVisitResource`, `OrcaAppointmentResource` | official visit/appointment row source | `scheduleKey` / `encounterKey` を含む active entry | Charts open handoff | なし | patientId-only reopen を禁止 | なし |
| Charts send | `ChartsActionBar.tsx`, `orcaSendabilityPolicy.ts` | `OrcaChartSupportResource` | medical-mod-v2 outbound | canonical encounter context 7項目 | ORCA送信 | なし | missing context で fail-close | なし |
| Billing confirmation | `orcaBillingStatus.ts`, `OrcaSummary.tsx`, `ReceptionPage.tsx` | `OrcaChartSupportSupport` 等 official income 参照側 | income-info confirmation source | official income / invoice confirmation | medical-mod-v2 send | incomeinfv2 / official paid invoice set | `send success != paid` | UG-01, UG-02, UG-03 |
| Disease authoring | `DiagnosisEditPanel.tsx`, `diseaseApi.ts` | `LocalDiagnosisResource` | optional mirror peer | insurance-local authoring route | insurance-local create/update/delete | なし | current writable surface = insurance-local only | UG-04, UG-07, WS04-G1, WS04-G2 |
| Disease mirror | `DiagnosisEditPanel.tsx` | `DiseaseProjectionService`, `OrcaDiseaseQuerySupport` | mirror row source | read-only ORCA mirror | なし | mirror fetch only | mirror 非 truth, no auto-merge | UG-05, UG-06 |
| Disease candidate | `orderChooserSources`, `chartOrderSetStorage.ts`, `OrderSetEditorPage.tsx` | `OrcaLiveDiseaseMasterReadService` | official candidate lookup | candidate source only | 明示 confirm で insurance-local へ handoff | なし | candidate-not-truth | UG-04, WS04-G1 |
| Document snapshot | `DocumentCreatePanel.tsx`, `ChartsDocumentPrintPage.tsx` | `saveLetterModule` / `odletter` backing route | none | patient-specific snapshot | save letter module | none | snapshot-only | UG-08 |
| Patient image asset | `ImageDockedPanel.tsx`, `MobileImagesUploadPage.tsx`, `patientImagesApi.ts` | `PatientImagesResource` | none | `/patients/{patientId}/images` | upload/list/download | none | asset と attachment reference を分離 | UG-09 |
| Attachment reference | `DocumentCreatePanel.tsx` | `KarteDocumentWriteResource`, `AttachmentStorageManager` | none | server contract が証明された場合のみ reference relation | `/karte/document` reference payload | none | unsupported なら feature-off | WS05-G1, WS05-G2 |
| Print preview | `ChartsDocumentPrintPage.tsx` | server artifact owner 不在 | none | route state only | preview open | none | reload/new tab で復元しない | UG-08 |
| Admin config | `web-client/src/features/administration/api.ts` | `AdminConfigSnapshot`, `AdminConfigStore`, `AdminConfigResource` | none | `/api/admin/config` charts delivery only | delivery config update | none | bulk expansion 禁止 | UG-14 |
| ORCA connection | `orcaConnectionApi.ts`, `WebOrcaConnectionCard.tsx` | `AdminOrcaConnectionResource` | facility connection config | `/api/admin/orca/connection` | save connection / default facility switch | connection test result | connection data only | なし |
| Capability / testedScope | `orcaCapabilitiesApi.ts` | `AdminOrcaCapabilitiesResource` | capability metadata / testedScope | `/api/admin/orca/capabilities` | none | capability fetch | `testedScope=api_only` などをここで出す | UG-14 |
| Runtime-owned flags | client reads via notes/diagnostics only | `ServerConfigurationResolver` | runtime deployment setting | `orca.mode`, `orca.acceptmod.suppress-acceptance-push` など | none | runtime state | client が補完しない | UG-14 |

## 3. source of truth by theme

### 3-1. disease
- insurance disease の writable truth:
  - fixed now = `LocalDiagnosisResource` 系の insurance-local authoring
- ORCA mirror:
  - fixed now = read-only mirror
- candidate:
  - fixed now = master lookup / order-set / Do / history 由来の candidate
- unknown:
  - clinical write owner
  - mirror sync direction
  - ORCA-only row resolution
  - exact `diagnosisCode` persistence semantics
  - stale / end-date canonical rule

### 3-2. billing
- transmission source:
  - `medical-mod-v2` send result / queue cache
- confirmation source:
  - income info / paid invoice confirmation
- correction source:
  - structured server field が無ければ scenario catalog + safe message へ fallback
- unknown:
  - `会計済み` authoritative owner
  - `再計待` clear owner
  - same-day same-test correction automation scope

### 3-3. document / image
- patient-specific document truth:
  - odletter snapshot
- patient image truth:
  - `/patients/{patientId}/images`
- attachment reference truth:
  - server contract が証明された時だけ relation として扱う
- print preview truth:
  - route state only
- unknown:
  - durable generated artifact
  - hard delete scope
  - reference-only payload real backend acceptance
  - saved attachment rehydrate/edit contract

### 3-4. setting dependency
- charts delivery config:
  - `/api/admin/config`
- facility connection:
  - `/api/admin/orca/connection`
- capability/testedScope/pushMode:
  - `/api/admin/orca/capabilities`
- runtime-owned flags:
  - runtime-config
- unknown:
  - facility setting inventory の未証明項目全般
  - optional module visibility owner
  - general-name / refill default owner
  - disease auto-send owner

## 4. confirmation source と outbound action の分離

### 4-1. billing
- outbound action:
  - `ORCA送信`
- confirmation source:
  - income info / paid invoice
- UI rule:
  - outbound success copy は `送信済`
  - confirmation success copy だけが `会計済み`
  - correction note は別 slot

### 4-2. disease
- outbound action:
  - insurance-local create/update/delete
- confirmation source:
  - なし
- mirror fetch:
  - confirmation source でも write source でもない
- UI rule:
  - mirror row を見ても local insurance disease を auto-confirm しない

### 4-3. document / image
- outbound action:
  - image upload
  - letter save
  - attachment reference save
- confirmation source:
  - なし
- UI rule:
  - asset upload success を document attachment success と混同しない

### 4-4. settings
- outbound action:
  - admin config update / connection save
- confirmation source:
  - capability/test result / runtime diagnostics
- UI rule:
  - access verified と ORCA connected を同じ status に潰さない

## 5. unknown は gate へ送る
次の項目は docs に証拠が無い限り **unknown** と書き、implementation owner が推測で埋めてはならない。

- `会計済み` / `再計待` authoritative owner
- clinical disease owner
- disease mirror exact route / stale threshold
- attachment reference backend contract
- hard delete scope
- facility setting inventory の未証明項目
- 390 を Charts / Reception production target にするか
- cp-set / consult-set reusable asset scope

## 6. no-cross-boundary rule
- client send cache に `paid` / `billingConfirmed` field を追加しない
- Reception generic memo を correction note slot にしない
- right rail chooser に sendability note / billing note / document template editor を置かない
- patient image asset delete を history delete と一体化しない
- admin scope note で runtime-owned setting を config-owned と書かない

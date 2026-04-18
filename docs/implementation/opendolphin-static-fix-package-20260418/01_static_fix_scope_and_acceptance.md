# 01. Static Fix Scope and Acceptance

## C1. facility 解決 fail-close 崩れ
### scope
- `server-modernized/src/main/java/open/dolphin/orca/config/OrcaConnectionConfigStore.java`
- `server-modernized/src/main/java/open/dolphin/orca/transport/OrcaTransportRegistry.java`
- `server-modernized/src/main/java/open/dolphin/rest/OperationsReadinessEvaluator.java`
- 関連 unit/contract tests

### acceptance
- explicit `defaultFacilityId` が未保存なら runtime facility へ fallback しない
- store 不在 / facility 設定ゼロ / `facility_configuration_missing` 時に runtime config へ fallback しない
- unresolved は `facility_configuration_missing` で fail-close
- readiness / transport creation / audit summary が同じ fail-close ルールを共有する
- negative test で fallback 経路が再発しないことを固定する

### out of scope
- admin UI wording 変更だけの修正
- facility 切替 UX の刷新

## C2. sanitize 崩れ
### scope
- `server-modernized/src/main/java/open/dolphin/orca/transport/OrcaTransportSettings.java`
- `server-modernized/src/main/java/open/dolphin/orca/transport/OrcaHttpClient.java`
- `server-modernized/src/main/java/open/dolphin/rest/OrcaGatewayExceptionMapper.java`
- `server-modernized/src/main/java/open/dolphin/rest/AbstractResource.java`
- `server-modernized/src/main/java/open/dolphin/rest/AdminOrcaConnectionTestSupport.java`
- 関連 tests

### acceptance
- invalid host spec / invalid base URL を log に raw 値で出さない
- malformed ORCA API URL を exception message / HTTP body / audit detail / admin connection test response に raw 値で出さない
- 代わりに contract に沿う sanitized reason code / sanitized message を返す
- negative tests で raw `host/baseUrl/url/pathPrefix/userinfo` 非露出を固定する

### out of scope
- 認証済み admin 設定画面の通常表示項目を全面再定義すること

## C3. Charts transmission evidence row-local 化
### scope
- `web-client/src/features/charts/orcaClaimSendCache.ts`
- `web-client/src/features/charts/ChartsActionBar.tsx`
- `web-client/src/features/charts/OrcaSummary.tsx`
- `web-client/src/features/charts/print/useOrcaReportPrint.ts`
- `web-client/src/features/charts/OrderBundleEditPanel.tsx`
- `web-client/src/features/charts/OrderDockPanel.tsx`
- `web-client/src/features/charts/DocumentTimeline.tsx`
- charts tests

### acceptance
- Charts surfaces が patientId latest cache を positive signal source に使わない
- 読み取りは row-local helper を使い、`encounterKey > scheduleKey > receptionId > appointmentId` 優先で解決する
- 書き込みは保存可能な strongest key を落とさない
- row-local key が足りないときは positive transmission / invoice / warning を出さない
- same-day multi-encounter / multi-reception negative tests を追加し、別 encounter の signal が current encounter に貼られないことを固定する

### out of scope
- Reception row overlay 契約の全面再設計
- paid owner の変更

## C4. OrcaSummary must-visible 化
### scope
- `web-client/src/features/charts/OrcaSummary.tsx`
- `web-client/src/features/charts/__tests__/OrcaSummary.semantics.test.tsx`
- 必要最小限の styles / supporting tests

### acceptance
- `Workflow / 院内ローカル診療サマリ`、`Transmission / medical-mod-v2`、`ORCA収納情報` が閉じた details を開かずに見える
- disclosure は補足情報に限定する
- `ChartsActionBar` が page CTA owner のまま残り、OrcaSummary が second primary を持たない
- DADS の `重要情報は隠さない` と `1画面1 primary` に反しない
- visibility tests が DOM 存在ではなく initial visible / details 外を検証する

### out of scope
- Charts 全体の broad redesign
- generic bottom navigation 導入

## C5. Patients canonical re-fetch success semantics
### scope
- `web-client/src/features/patients/api.ts`
- `web-client/src/features/patients/PatientsPage.tsx`
- `web-client/src/features/charts/PatientInfoEditDialog.tsx`
- `web-client/src/features/outpatient/orcaPatientImportApi.ts`
- 関連 tests

### acceptance
- official create/update/import の full success は canonical re-fetch success を含む
- write accepted だが canonical readback failure の場合は partial failure / recoverable failure として返し、full-success copy にしない
- Patients page は canonical/local sync 完了文言を誤表示しない
- chart patient dialog は canonical readback 失敗時に success close しない
- negative tests で readback failure 分岐を固定する

### out of scope
- local search / local mutation flow の再設計
- patient context ownership の別件改修

## C6. OrcaSummary visibility test drift
### scope
- `web-client/src/features/charts/__tests__/OrcaSummary.semantics.test.tsx`
- 必要な supporting tests

### acceptance
- must-visible sections について `details` 外 / initial visible を検査する
- hidden details 内でも通る test を残さない

## C7. QA script / release doc gate drift
### scope
- `docs/runbooks/release-validation.md`
- `docs/releases/orca-remediation-cutover.md`
- `web-client/scripts/qa-acceptmodv2-weborca.mjs`
- `web-client/scripts/qa-fullflow-weborca.mjs`

### acceptance
- `QA_MEDICAL_INFORMATION` 未指定 run で request body に `Medical_Information` が含まれたら script failure になる
- runbook/cutover の gate 文言と scripts の actual fail condition が一致する
- script は artifact 保存だけでなく pass/fail を自分で判定する

## guard rails
- reception official flow を壊さない
- administration / manageusers の PASS area を壊さない
- `send success != paid` を壊さない
- route taxonomy を広げない

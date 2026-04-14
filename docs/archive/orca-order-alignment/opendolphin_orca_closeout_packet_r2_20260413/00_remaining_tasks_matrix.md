# 残件 matrix R2

この matrix は、直近の closeout 報告を再評価した結果、**まだ閉じていない論点だけ** を並べたものです。
source / tests / grep / runtime evidence / docs で閉じる。

## A. Critical

### A1. live fullflow handoff 未完
**症状**
- accept 後に reception 一覧の対象行が安定して見つからない
- charts へ `patientId` だけで fallback 遷移しており、canonical handoff contract とずれる
- order save / ORCA send まで到達しない run が残る

**主なファイル**
- `web-client/src/routes/useAppNavigation.ts`
- `web-client/src/features/reception/pages/ReceptionPage.tsx`
- `web-client/scripts/qa-fullflow-weborca.mjs`
- handoff / encounter context 関連 tests

**close 条件**
- accept 成功後に `scheduleKey` / `encounterKey` を持つ handoff context で charts を開ける
- fullflow script が `?patientId=` fallback を使わない
- live run で order save と ORCA send まで到達し、`medicalmodv2` request XML を artifact に保存できる

### A2. reception canonical handling 未完
**症状**
- display string から department/physician code を再解析する helper が残る
- current contract と source が矛盾する

**主なファイル**
- `web-client/src/features/reception/pages/ReceptionPage.tsx`
- `web-client/src/features/reception/api.ts`
- `web-client/src/features/reception/patientSearchApi.ts`
- reception tests / mocks

**close 条件**
- `resolveDepartmentCode` / `normalizeDepartmentCode` / `resolvePhysicianCodeSelection` を除去する
- canonical value のみで selection / signature / handoff を構成する
- tests と mock が新 semantics へ追随する

## B. High

### B1. ChartsPage local-only wording / DADS 未完
**症状**
- `ChartsPage` が local summary を `ORCA 記録（要約）` と表示している
- local summary が `<details>` 内へ折りたたまれている

**主なファイル**
- `web-client/src/features/charts/pages/ChartsPage.tsx`
- `web-client/src/features/charts/MedicalOutpatientRecordPanel.tsx`
- `web-client/src/features/charts/OrcaSummary.tsx`
- charts UI tests

**close 条件**
- local summary は local-only wording に統一される
- official ORCA収納情報と混同しない
- DADS 原則に反して重要情報を隠さない
- wrapper を含む regression test がある

### B2. route/shared audit taxonomy 未完
**症状**
- audit action が `ORCA_OFFICIAL_* / ORCA_MASTER_* / LOCAL_*` に揃っていない
- stale constant が残る

**主なファイル**
- `server-modernized/src/main/java/open/dolphin/rest/PatientModV2OutpatientResource.java`
- `server-modernized/src/main/java/open/dolphin/rest/orca/AbstractOrcaWrapperResource.java`
- `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaPatientBatchResource.java`
- audit tests / route inventory tests

**close 条件**
- source と tests の audit action naming が taxonomy に一致する
- official/master/local scope を log/audit で追える

## C. Medium

### C1. shared ORCA Api_Result policy 未完
**症状**
- `isApiResultOk` 相当の判定が reception / charts / reports に重複している
- admin の `orcaApiResultPolicy` が shared 化されていない

**主なファイル**
- `web-client/src/features/reception/pages/ReceptionPage.tsx`
- `web-client/src/features/charts/ChartsActionBar.tsx`
- `web-client/src/features/charts/print/useOrcaReportPrint.ts`
- `web-client/src/features/administration/orcaApiResultPolicy.ts`

**close 条件**
- shared policy を libs 側へ置く
- reception / charts / report / admin が同一 policy を参照する
- warning-success の扱いが drift しない

### C2. runtime QA artifact packaging 未完
**症状**
- launcher log は残るが、判定に使った summary/json/network/request XML/screenshot が束ねられていない
- 後追い監査で third party が再読しづらい

**主なファイル**
- `web-client/scripts/qa-fullflow-weborca.mjs`
- `web-client/scripts/qa-acceptmodv2-weborca.mjs`
- `docs/runbooks/release-validation.md`
- `30_evidence_bundle_spec.md`

**close 条件**
- closeout bundle に summary/json/network/request XML/screenshots/page errors が残る
- report が参照する path を third party がたどれる

### C3. console / page error / 502 の扱い未整理
**症状**
- `appendChild null` 系の page error が残る可能性がある
- appointments / medical-information 502 が repo 側か環境依存か切り分け不足

**主なファイル**
- `web-client/scripts/qa-fullflow-weborca.mjs`
- `web-client/scripts/qa-acceptmodv2-weborca.mjs`
- reception UI 周辺
- runtime logs / artifact bundle

**close 条件**
- repo-side defect なら修正して pageErrors / console error を 0 に近づける
- external blocker なら hard evidence 付きで切り分ける

## D. reopen すべき PR

- PR0: audit taxonomy, shared ORCA result policy
- PR3: reception canonical handling, accept->charts handoff
- PR5: ChartsPage local-only wording / DADS
- PR6: runtime QA, evidence packaging, full validation

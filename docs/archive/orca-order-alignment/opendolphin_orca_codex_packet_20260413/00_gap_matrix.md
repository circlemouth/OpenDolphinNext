# 残件 gap matrix

この matrix は、前回の受入れレビューで **PASS にならなかった論点だけ** を close するための作業表である。  
「以前より良くなった」は closure 理由にしない。source / tests / docs / grep / runtime evidence で閉じる。

## A. 直近で閉じるべき残件

### A1. route/shared/audit taxonomy
**現状の問題**
- route path taxonomy 自体は概ね整理済み
- しかし audit action / metadata の naming が `../../../../docs/contracts/orca-route-taxonomy.md` の定義にまだ揃っていない

**閉じる条件**
- audit action 名が `ORCA_OFFICIAL_*` / `ORCA_MASTER_*` / `LOCAL_*` に揃う
- local-only flow に official 風 action 名が残らない
- route inventory / exposure tests が通る
- `/api/orca/*` に local-only route が残らないことを grep と tests で示せる

**特に見るファイル**
- `server-modernized/src/main/java/open/dolphin/rest/PatientModV2OutpatientResource.java`
- `server-modernized/src/main/java/open/dolphin/rest/OrcaPatientApiResource.java`
- `server-modernized/src/main/java/open/dolphin/rest/orca/AbstractOrcaWrapperResource.java`
- `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaPatientBatchResource.java`
- `server-modernized/src/test/java/open/dolphin/rest/PublicRouteInventoryContractTest.java`
- `server-modernized/src/test/java/open/dolphin/rest/WebXmlEndpointExposureTest.java`
- `web-client/src/libs/http/httpClient.ts`

### A2. patients official flows は source 上は良いが evidence が不足
**現状の問題**
- PatientsPage / PatientInfoEditDialog / create-update-import 分離は source 上ほぼ良い
- しかし targeted tests 実行証跡が不足

**閉じる条件**
- PatientsPage / PatientInfoEditDialog の official route 呼び出しを test で固定
- local search wording と official create/update/import 分離を UI test で固定
- resource / coordinator 側の class=01, class=02, canonical re-fetch を test で示せる

### A3. reception official compliance の未完
**現状の問題**
- `acceptmodv2` 21/60 解釈、`patientlst3v2` request shape、`Department_Code`, `Medical_Information` optional は source で概ね良い
- ただし `ReceptionPage.tsx` に client-side の department/physician code 正規化・再解析が残る
- current contract は client 補完/再解析を禁止している

**閉じる条件**
- display string から code を再解析しない
- canonical selected value または official returned value だけを使う
- `resolveDepartmentCode` / `normalizeDepartmentCode` / `resolvePhysicianCodeSelection` のような補完を除去または harmless read-only に落とす
- unit/UI tests と mock を current semantics へ固定する

### A4. chart local summary wording / DADS 違反
**現状の問題**
- `ChartsPage.tsx` が local summary を `<details>` の summary `ORCA 記録（要約）` で包んでいる
- これは local-only を official 風に見せ、かつ重要情報を折りたたんでいる
- `MedicalOutpatientRecordPanel.tsx` と `OrcaSummary.tsx` の責務分離にも反する

**閉じる条件**
- local summary は local wording で表示する
- official ORCA収納情報 と local summary を visually / wording で明確に分離する
- DADS 原則に照らし、重要情報を不必要に折りたたまない
- regression UI test を追加する

### A5. administration は source 上おおむね良いが evidence 不足
**現状の問題**
- manageusersv2 create/update, push settings, capability cards は source 上良い
- しかし real repo 上の tests / grep / command evidence が不足

**閉じる条件**
- admin targeted tests を実行し、必要があれば追加修正する
- sync/auth/wrapper wording と actual behavior の一致を evidence 化する
- docs/operations との整合を示す

### A6. full validation / git provenance / test evidence
**現状の問題**
- 前回レビュー環境では `.git` 不在、`mvn` 不在、`vitest` / `playwright` 不在で NOT VERIFIED が残った
- これは current HEAD の実 git checkout で埋める必要がある

**閉じる条件**
- real git repo で `git status`, `git rev-parse HEAD`, `git branch --show-current`, `git remote show origin`, `git merge-base ...`, `git diff --stat` を取得
- `../../../../docs/runbooks/release-validation.md` に沿って server / web / runtime / QA scripts を完走
- 実行不能なものを残さず、必要ならコードまたは test/config を修正して再実行する
- live ORCA の pass を主張するなら、本当に live evidence を出す。出せないなら live 未検証と明記する

## B. サブエージェント分担

- SA-20 route/shared
- SA-21 patients
- SA-22 reception
- SA-23 charts
- SA-24 administration
- SA-25 validation/docs

## C. 受入れ close 条件

最終時点で次を満たすこと。

- Mandatory Gate G0〜G7 = PASS
- `ChartsPage` に `ORCA 記録（要約）` が残っていない
- `ReceptionPage` に display string 再解析ロジックが残っていない
- audit action naming が taxonomy に一致する
- patients / admin / charts / reception の targeted tests が pass
- route inventory / exposure / XML contract / QA scripts が current merged branch で実行済み

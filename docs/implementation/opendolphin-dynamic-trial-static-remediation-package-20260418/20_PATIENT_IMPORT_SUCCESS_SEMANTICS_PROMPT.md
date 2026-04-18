# SA-02 — patient import success semantics prompt

```text
あなたは OpenDolphinNext の patients-import-success-semantics subagent です。

目的:
C5 を current repo truth ベースで閉じる。
特に official import の full-success semantics を修正し、
write accepted / business partial / canonical readback failure / full success を正しく分離する。

参照してよいもの:
- current repo source / tests / docs / notes / contracts
- docs/implementation/opendolphin-dynamic-trial-static-remediation-package-20260418/
- docs/implementation/opendolphin-static-fix-package-20260418/
- docs/implementation/opendolphin-webclient-implementation-package-20260416/
- 外部サイト、一般論は禁止

fixed premises:
- local search separation を崩さない
- official/local route boundary を崩さない
- patient context / privacy contract を崩さない
- dialog partial-warning behavior は success close に戻さない
- backward compatibility 不要
- build artifacts 無視

主要タスク:
1. current server contract と service を見て、import の business success 判定を repo truth から確定する
   - `OrcaApiResponse`
   - `PatientImportResponse`
   - `OrcaPatientImportService`
   - 必要なら current tests / mocks も参照
2. `parseOrcaApiResponse` と `orcaPatientImportApi.ts` を見直し、
   HTTP 200 と business success を混同しないようにする
   - full success は business success + canonical readback success の両方が必要
   - business partial / `apiResult=PARTIAL` / errors あり を success toast に流さない
   - count fields は repo truth が business semantics として使っている範囲だけ使う
3. `PatientsPage.tsx` の full-success copy / warning copy / audit summary を import branch でも current truth に揃える
4. create/update の canonical readback failure negative が十分でない箇所も埋める
   - create 200 + readback failure
   - import 200 + PARTIAL / errors
5. `PatientInfoEditDialog` は success close を緩めない

acceptance:
- import 200 + business partial は full success にならない
- import 200 + canonical readback failure は full success にならない
- full-success copy は business success + canonical readback success のときだけ出る
- create/update の partial branch も tests で pin される
- local search / route boundary / patient context は不変

required tests:
- cd web-client && npm run typecheck
- cd web-client && npx vitest run src/features/patients/__tests__/api.test.ts src/features/patients/__tests__/PatientsPage.test.tsx src/features/charts/__tests__/PatientInfoEditDialog.test.tsx src/features/outpatient/__tests__/orcaPatientImportApi.test.ts

report format:
- summary
- business_success_rule_from_repo_truth
- changed_files
- full_success_before_after
- negative_tests_added
- tests_run
- residual_risks
```

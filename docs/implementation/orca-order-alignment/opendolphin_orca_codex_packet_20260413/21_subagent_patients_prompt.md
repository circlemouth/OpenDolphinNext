# SA-21 patients official flows 用プロンプト

あなたは OpenDolphinNext ORCA是正の **patients official flows 専任サブエージェント** です。  
この prompt は **gpt-5.4 high** 用です。

## 任務

前回レビューで G1 / PR2 / W3 が source 上はかなり良い一方、**tests と evidence 不足で close できなかった** 状態を解消してください。  
必要なら小修正はしてよいですが、主目的は **official create/update/import と local search 境界を tests / docs / grep で固定すること** です。

## 参照範囲

- `../../../../AGENTS.md`
- `../../../../docs/contracts/orca-route-taxonomy.md`
- `../../../../docs/runbooks/release-validation.md`
- `../../../../web-client/notes/ui-current-contract.md`
- `OpenDolphin_ORCA_remediation_checklist.md`
- `00_gap_matrix.md`

## 主な観点

### 1. PatientsPage の official flow を test で固定する
- 新患登録 → official create
- 既存患者更新 → official update
- ORCA既存患者取込 → import
- local search は local と明示

### 2. chart patient edit も official update route を使うことを固定する
- `PatientInfoEditDialog.tsx`
- route 呼び出し
- 成功後の canonical re-fetch + local sync

### 3. route / DTO / UI 意味の分離を崩さない
- create / update / import が混ざらない
- official route と local route が混ざらない
- UI wording が “保存しただけで ORCA 反映した” ように見えない

## まず見るファイル

- `web-client/src/features/patients/PatientsPage.tsx`
- `web-client/src/features/patients/api.ts`
- `web-client/src/features/patients/__tests__/PatientsPage.test.tsx`
- `web-client/src/features/charts/PatientInfoEditDialog.tsx`
- `web-client/src/features/outpatient/orcaPatientImportApi.ts`
- `server-modernized/src/main/java/open/dolphin/rest/PatientModV2OutpatientResource.java`
- `server-modernized/src/main/java/open/dolphin/rest/PatientModV2OutpatientSupport.java`
- `server-modernized/src/main/java/open/dolphin/rest/PatientModV2OutpatientOrcaCoordinator.java`
- `server-modernized/src/test/java/open/dolphin/rest/PatientModV2OutpatientResourceIdempotencyTest.java`
- patients 関連の server tests 一式

## 受入れ条件

- PatientsPage / PatientInfoEditDialog が official route を使うことが test で固定される
- create / update / import が別導線・別意味で保たれる
- local search が local と明示される
- success 後 canonical re-fetch + local sync が evidence として残る
- related grep と targeted tests が pass する

## 必須コマンド

- `rg -n "ORCAへ反映|ローカル患者検索|ORCA既存患者|patientmodv2|patientlst2v2" web-client/src/features/patients web-client/src/features/charts`
- `rg -n "/api/orca/patient/mutation|/api/orca/official/patientmodv2|/api/orca/official/patientlst2v2|/api/local/" web-client server-modernized`
- patients / chart patient edit 関連 test 実行コマンド
- resource/coordinator 関連 test 実行コマンド

## 期待する成果

- 必要な code/test/doc 修正
- targeted tests pass
- 患者系の受入れ論点を close する worker report

## 報告フォーマット

```text
【ワーカー報告】
担当: SA-21 patients

1. summary
2. changed files
3. official flow / local flow の確定内容
4. 実行コマンド
5. tests pass/fail
6. grep 結果
7. docs 更新
8. unresolved items
9. merge conflict note
```

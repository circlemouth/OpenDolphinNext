# SA-23 charts / naming / DADS 用プロンプト

あなたは OpenDolphinNext ORCA是正の **charts / naming / DADS 専任サブエージェント** です。  
この prompt は **gpt-5.4 high** 用です。

## 任務

前回レビューで G3 / G5 / G7 / PR1 / PR5 / W5 / W6 を FAIL にした主因の一つは、  
`ChartsPage.tsx` が local summary を **`ORCA 記録（要約）`** という official 風 wording で、しかも `<details>` に折りたたんでいたことです。  
この drift を潰し、chart support / naming / DADS 観点の残件を close してください。

## 参照範囲

- `../../../../AGENTS.md`
- `../../../../web-client/notes/ui-current-contract.md`
- `../../../../web-client/notes/orca-order-remediation-20260403.md`
- `../../../../web-client/notes/orca-order-contract-cleanup-20260404.md`
- `../../../../web-client/notes/orca-charge-canonicalization-20260404.md`
- `../../../../docs/runbooks/release-validation.md`
- `OpenDolphin_ORCA_remediation_checklist.md`
- `../../../web-client/ux/dads_app_ui_design_rules_20260411.md`
- `00_gap_matrix.md`

## 絶対ルール

- local-only を official 風名称で見せない
- 重要情報を折りたたみで隠さない
- official ORCA収納情報 と local summary を混同させない
- static master check と official patient-aware check を混同させない

## 主なタスク

### 1. `ChartsPage.tsx` の local summary drift を修正する
- `ORCA 記録（要約）` を除去する
- local wording に揃える
- 重要情報なら最初から見える形にする
- `MedicalOutpatientRecordPanel.tsx` と `OrcaSummary.tsx` の責務分離を壊さない

### 2. regression test を追加する
少なくとも次を固定する。
- `ChartsPage` に `ORCA 記録（要約）` が出ない
- local summary は local wording
- official ORCA収納情報 card と混同しない

### 3. chart support naming を最終確認する
- contraindication check が official route を叩いていること
- `medicationgetv2` 01/02 の contract が崩れていないこと
- static interaction check が master-based であることが UI 上で分かること
- subjectives / local summary / patient mutation に official 風 wording が戻っていないこと

## まず見るファイル

- `web-client/src/features/charts/pages/ChartsPage.tsx`
- `web-client/src/features/charts/OrcaSummary.tsx`
- `web-client/src/features/charts/MedicalOutpatientRecordPanel.tsx`
- `web-client/src/features/charts/MedicalOutpatientRecordPanel.test.tsx`
- `web-client/src/features/charts/__tests__/OrcaSummary.semantics.test.tsx`
- `web-client/src/features/charts/OrderBundleEditPanel.tsx`
- `web-client/src/features/charts/PrescriptionOrderEditorPanel.tsx`
- `web-client/src/features/charts/orcaMedicationGetApi.ts`
- `web-client/src/features/charts/orcaMedicationGetApi.test.ts`
- `web-client/src/features/charts/orcaOrderInteractionApi.ts`
- `web-client/src/features/charts/soap/subjectiveChartApi.ts`
- `web-client/src/features/charts/SoapNotePanel.tsx`
- `web-client/src/features/charts/soap/SubjectivesPanel.tsx`
- `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaChartSupportResource.java`

## 受入れ条件

- `ChartsPage` に official 風 local summary wording が残っていない
- local summary を不必要に折りたたんでいない
- chart support / medicationget / interaction naming が current contract と一致する
- targeted tests が pass する
- wording grep が clean になる

## 必須コマンド

- `rg -n "ORCA 記録（要約）|症状詳記（ORCA）|ORCAへ反映" web-client server-modernized docs`
- `rg -n "contraindicationcheckv2|runContraindicationCheck" web-client server-modernized`
- `rg -n "Request_Number.*01|Request_Number.*02|medicationgetv2" web-client server-modernized`
- `rg -n "PATIENTMODV2_|ORCA_ORDER|ORCA_PRESCRIPTION|ORCA_SUBJECTIVE|ORCA_MEDICAL" web-client/src/features/charts server-modernized`
- charts 関連 vitest 実行コマンド

## 報告フォーマット

```text
【ワーカー報告】
担当: SA-23 charts

1. summary
2. changed files
3. wording / DADS 修正内容
4. 実行コマンド
5. tests pass/fail
6. grep 結果
7. docs 更新
8. unresolved items
9. merge conflict note
```

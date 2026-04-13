# SA-20 route/shared/audit taxonomy 用プロンプト

あなたは OpenDolphinNext ORCA是正の **route/shared/audit taxonomy 専任サブエージェント** です。  
この prompt は **gpt-5.4 high** 用です。

## 任務

前回レビューで残った G0 / PR0 系の残件を閉じてください。  
焦点は **public path taxonomy ではなく、audit action / metadata / inventory / exposure / shared naming の最終収束** です。

## 参照範囲

- `../../../../AGENTS.md`
- `../../../../docs/contracts/orca-route-taxonomy.md`
- `../../../../docs/contracts/orca-master-api.md`
- `../../../../docs/runbooks/release-validation.md`
- `OpenDolphin_ORCA_remediation_checklist.md`
- `00_gap_matrix.md`

## 真実のソース

- source code
- route inventory tests
- exposure tests
- grep
- 実行ログ

作業完了報告や既存コメントは信用しないこと。

## 主要タスク

### 1. audit action naming を taxonomy に合わせる
`../../../../docs/contracts/orca-route-taxonomy.md` の想定に合わせ、action naming を以下 3 系統へ収束させる。

- `ORCA_OFFICIAL_*`
- `ORCA_MASTER_*`
- `LOCAL_*`

**禁止**
- local-only flow に official 風 action 名を残す
- official route で local action 名を使う
- master-backed route で official transport action 名を使う

### 2. shared metadata / http metadata を actual behavior に一致させる
- `web-client/src/libs/http/httpClient.ts`
- server 側 resource metadata / audit / route naming

を読み、official/master/local の説明がズレていたら直す。

### 3. inventory / exposure tests を最新実装に固定する
対象:
- `server-modernized/src/test/java/open/dolphin/rest/PublicRouteInventoryContractTest.java`
- `server-modernized/src/test/java/open/dolphin/rest/WebXmlEndpointExposureTest.java`

実装と docs に合わせて調整し、route taxonomy の後退を防ぐ。

### 4. old path / old naming grep を clean にする
最低限、次を潰す。

- local-only `/api/orca/*`
- old audit 名
- old official 風 metadata

## まず見るファイル

- `server-modernized/src/main/java/open/dolphin/rest/OpenDolphinRestApplication.java`
- `server-modernized/src/main/java/open/dolphin/rest/PatientModV2OutpatientResource.java`
- `server-modernized/src/main/java/open/dolphin/rest/OrcaPatientApiResource.java`
- `server-modernized/src/main/java/open/dolphin/rest/orca/AbstractOrcaWrapperResource.java`
- `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaPatientBatchResource.java`
- `server-modernized/src/main/java/open/dolphin/rest/orca/LocalPatientMutationResource.java`
- `server-modernized/src/main/java/open/dolphin/rest/orca/LocalPatientSearchResource.java`
- `server-modernized/src/main/java/open/dolphin/rest/orca/LocalChartSubjectiveResource.java`
- `server-modernized/src/main/java/open/dolphin/rest/orca/LocalChartMedicalResource.java`
- `server-modernized/src/main/java/open/dolphin/rest/orca/LocalOrderBundleResource.java`
- `server-modernized/src/main/java/open/dolphin/rest/orca/LocalPrescriptionOrderResource.java`
- `server-modernized/src/test/java/open/dolphin/rest/PublicRouteInventoryContractTest.java`
- `server-modernized/src/test/java/open/dolphin/rest/WebXmlEndpointExposureTest.java`
- `web-client/src/libs/http/httpClient.ts`

## 受入れ条件

- G0 を PASS に寄せる差分になっている
- `/api/orca/*` に local-only route が残っていない
- audit action 名が taxonomy に一致する
- inventory / exposure tests が pass する
- grep で old path / old action / old metadata が残っていない

## 必須コマンド

- `git status --short`
- `rg -n "/api/orca/official/|/api/orca/master/|/api/local/" web-client server-modernized docs`
- `rg -n "/api/orca/patient/mutation|chart/subjectives|/api/orca/order/bundles|/api/orca/prescription-orders" web-client server-modernized docs`
- `rg -n "PATIENTMODV2_OUTPATIENT|ORCA_ORDER|ORCA_PRESCRIPTION|ORCA_SUBJECTIVE|ORCA_MEDICAL|OFFICIAL_PATIENT_|ORCA_PATIENT_GET|ACTION_PATIENT_SYNC" web-client server-modernized`
- route inventory / exposure test 実行コマンド
- 必要なら additional grep

## 変更してよい範囲

- `web-client/`
- `server-modernized/`
- `api-contract/`
- `docs/` のうち担当差分に必要な最小範囲

## 変更しないもの

- `client/`
- `server/`

## 報告フォーマット

```text
【ワーカー報告】
担当: SA-20 route/shared

1. summary
2. changed files
3. audit naming 変更一覧
4. 実行コマンド
5. tests pass/fail
6. grep 結果
7. docs 更新
8. unresolved items
9. merge conflict note
```

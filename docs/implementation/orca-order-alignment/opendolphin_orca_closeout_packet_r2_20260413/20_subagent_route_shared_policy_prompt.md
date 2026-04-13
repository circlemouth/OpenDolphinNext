# SA-20 route/shared/policy 用プロンプト R2

あなたは OpenDolphinNext ORCA是正の **route/shared/policy 専任サブエージェント** です。
この prompt は **gpt-5.4 high** 用です。

## 任務

今回あなたが閉じる対象は 2 つです。

1. **audit taxonomy の未収束**
2. **shared ORCA Api_Result policy の未収束**

patients/admin/charts/reception の feature 実装全体を広く触るのではなく、shared contract と stale naming を正すことに集中してください。

## 参照範囲

- `AGENTS.md`
- `docs/contracts/orca-route-taxonomy.md`
- `docs/runbooks/release-validation.md`
- `web-client/notes/ui-current-contract.md`
- `OpenDolphin_ORCA_remediation_checklist.md`
- `00_remaining_tasks_matrix.md`

## 絶対ルール

- 後方互換性のために旧 audit 名を残さない
- official/master/local の境界を曖昧にしない
- shared policy は features の local file に重複実装しない
- test を通すためだけの rename rollback をしない
- 外部仕様サイトへ行かない

## 主タスク

### 1. audit taxonomy を checklist 準拠へ揃える
次を確認し、stale action 名を taxonomy へ揃える。

- `ORCA_OFFICIAL_*`
- `ORCA_MASTER_*`
- `LOCAL_*`

#### 最初に見るファイル
- `server-modernized/src/main/java/open/dolphin/rest/PatientModV2OutpatientResource.java`
- `server-modernized/src/main/java/open/dolphin/rest/orca/AbstractOrcaWrapperResource.java`
- `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaPatientBatchResource.java`
- `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaPatientSyncResource.java`
- `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaPatientSyncStatusResource.java`
- `server-modernized/src/test/java/open/dolphin/security/audit/SessionAuditDispatcherTest.java`
- route inventory / exposure tests

#### やること
- stale constant を taxonomy 準拠名へ置き換える
- संबंधित tests / snapshots / assertions を更新する
- `scope` / `action` の意味が official/master/local で追えることを test で固定する

### 2. shared ORCA Api_Result policy を libs に集約する
#### 現状の問題
- `isApiResultOk` 相当が reception / charts / report に重複している
- admin 側 policy が shared libs に昇格していない

#### 最初に見るファイル
- `web-client/src/features/reception/pages/ReceptionPage.tsx`
- `web-client/src/features/charts/ChartsActionBar.tsx`
- `web-client/src/features/charts/print/useOrcaReportPrint.ts`
- `web-client/src/features/administration/orcaApiResultPolicy.ts`
- `web-client/src/features/reception/acceptmodv2Result.ts`

#### やること
- shared policy module を libs 配下へ配置する
- success / warning / error 判定 API を 1 箇所へ寄せる
- reception / charts / report / admin をその policy へ差し替える
- 21/60 や duplicate など endpoint 固有判定がある場合は shared core + endpoint-specific helper に分ける
- result tone / banner tone の drift を避ける

### 3. tests / docs を追随させる
- route/shared/audit/policy の tests を追加または更新する
- docs に naming や policy の置き場所がズレていれば最小更新する

## まず見る grep
- `rg -n "PATIENTMODV2_OUTPATIENT|OFFICIAL_PATIENT_CREATE|OFFICIAL_PATIENT_UPDATE|ORCA_PATIENT_SYNC|ACTION_PATIENT_SYNC|ORCA_APPOINTMENT_OUTPATIENT" web-client server-modernized`
- `rg -n "isApiResultOk\(|isOrcaSuccessResult\(|resolveOrcaResultTone\(" web-client`

## 受入れ条件

- audit action naming が taxonomy に一致する
- stale audit constant が source/test に残らない
- shared ORCA result policy が libs に集約される
- reception / charts / report / admin が同一 policy を参照する
- targeted tests が pass する

## 必須コマンド

- 上記 grep
- route/shared server tests
- shared policy に関する web tests
- `npm run verify:web-guard` に影響があれば再実行

## 報告フォーマット

```text
【ワーカー報告】
担当: SA-20 route/shared/policy

1. summary
2. changed files
3. audit taxonomy 確定内容
4. shared ORCA result policy 確定内容
5. 実行コマンド
6. tests pass/fail
7. grep 結果
8. docs 更新
9. unresolved items
10. merge conflict note
```

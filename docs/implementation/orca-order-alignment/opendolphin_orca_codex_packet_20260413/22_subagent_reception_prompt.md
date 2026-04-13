# SA-22 reception official compliance 用プロンプト

あなたは OpenDolphinNext ORCA是正の **reception official compliance 専任サブエージェント** です。  
この prompt は **gpt-5.4 high** 用です。

## 任務

前回レビューで G2 / PR3 / W2 を FAIL にした主因は、  
**ReceptionPage に client-side の department/physician code 再解析・正規化が残っていたこと** です。  
これを current contract に合わせて除去し、official reception semantics を tests と grep で固定してください。

## 参照範囲

- `../../../../AGENTS.md`
- `../../../../docs/runbooks/release-validation.md`
- `../../../../web-client/notes/ui-current-contract.md`
- `OpenDolphin_ORCA_remediation_checklist.md`
- `00_gap_matrix.md`

## 絶対ルール

- display string から診療科コード / 医師コードを再解析しない
- client が勝手に canonical code を補完しない
- 医師コード hack や suppress workaround を client に戻さない
- official payload と UI semantics をズラさない

## 主なタスク

### 1. ReceptionPage の code 再解析を除去する
探すべきシンボル例:
- `resolveDepartmentCode`
- `normalizeDepartmentCode`
- `resolvePhysicianCodeSelection`

これらが送信用 path に残っているなら除去または harmless 化する。  
送信に使うのは、明示的な selection 値か official returned value のみ。

### 2. `acceptmodv2` 21/60 と `Api_Result_Message` 優先を固定する
- runtime
- unit test
- mock
- toast / message

を一致させる。

### 3. official patient search / visit list semantics を維持する
- `patientlst3v2?class=01`
- `<patientlst3req type="record">`
- `WholeName`
- `Birth_StartDate`, `Birth_EndDate`, `Sex`, `InOut`
- `Department_Code`
- `Medical_Information` optional

### 4. reception の役割を既存患者受付に限定する wording を維持する
- 中途半端に新患作成を匂わせない
- 必要なら PatientsPage へ誘導する

## まず見るファイル

- `web-client/src/features/reception/pages/ReceptionPage.tsx`
- `web-client/src/features/reception/api.ts`
- `web-client/src/features/reception/patientSearchApi.ts`
- `web-client/src/features/reception/acceptmodv2Result.ts`
- `web-client/src/features/reception/__tests__/acceptmodv2.test.ts`
- `web-client/src/mocks/handlers/orcaReception.ts`
- `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaVisitResource.java`
- `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaPatientBatchResource.java`
- `server-modernized/src/main/java/open/dolphin/orca/service/OrcaLiveGatewaySupport.java`
- `server-modernized/src/main/java/open/dolphin/orca/service/OrcaLiveGatewayMutationSupport.java`
- `server-modernized/src/test/java/open/dolphin/orca/service/OrcaLiveGatewaySupportTest.java`

## 受入れ条件

- `ReceptionPage` に display string 再解析が残っていない
- `acceptmodv2` 21/60 / message mapping が test で固定される
- `Department_Code` と `Medical_Information` semantics が崩れていない
- workaround / hack grep が clean
- targeted tests が pass する

## 必須コマンド

- `rg -n "resolveDepartmentCode|normalizeDepartmentCode|resolvePhysicianCodeSelection" web-client/src/features/reception`
- `rg -n "normalizePhysicianCode|shouldSuppressAcceptancePush" web-client server-modernized`
- `rg -n "patientlst3req|type=\\\"record\\\"|WholeName|Birth_StartDate|Birth_EndDate|InOut|Sex" server-modernized`
- `rg -n "Department_Code" web-client server-modernized`
- `rg -n "Medical_Information" web-client server-modernized`
- reception 関連 vitest / server test 実行コマンド
- 必要なら additional grep

## 報告フォーマット

```text
【ワーカー報告】
担当: SA-22 reception

1. summary
2. changed files
3. 再解析除去の内容
4. 実行コマンド
5. tests pass/fail
6. grep 結果
7. docs 更新
8. unresolved items
9. merge conflict note
```

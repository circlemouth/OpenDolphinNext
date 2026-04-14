# SA-24 administration / capabilities / wording 用プロンプト

あなたは OpenDolphinNext ORCA是正の **administration 専任サブエージェント** です。  
この prompt は **gpt-5.4 high** 用です。

## 任務

前回レビューでは admin source 自体は大きく崩れていませんでした。  
しかし G4 / PR4 / W1 は **real repo 上の tests / grep / evidence 不足** のため close できませんでした。  
必要なら小修正を行いながら、administration 領域を **実行証跡つきで PASS に持っていく** ことが目的です。

## 参照範囲

- `../../../../AGENTS.md`
- `../../../../docs/operations/ORCA_CERTIFICATION_ONLY.md`
- `../../../../docs/runbooks/release-validation.md`
- `OpenDolphin_ORCA_remediation_checklist.md`
- `../../../web-client/ux/dads_app_ui_design_rules_20260411.md`
- `00_gap_matrix.md`

## 主なタスク

### 1. manageusersv2 create/update を test で固定する
- create で `User_Number` を送らない
- update で immutable fields を送らない
- readOnly/create-only 表現が UI と server で一致する

### 2. auth / sync / capability wording を最終確認する
- `今すぐ同期` のような旧 wording が残っていないか
- `認証済み` のような混同表現が残っていないか
- local admin 権限確認と ORCA 接続成功が分離されているか
- internal wrapper card が actual behavior / capability に一致しているか

### 3. push settings / master updates / docs evidence を揃える
- `pushUrl` / `pushTenantId` UI-server gap がないか
- docs/operations と current UI/server が一致しているか
- tests が pass するか

## まず見るファイル

- `web-client/src/features/administration/AdministrationPage.tsx`
- `web-client/src/features/administration/orcaConnectionApi.ts`
- `web-client/src/features/administration/orcaUserAdminApi.ts`
- `web-client/src/features/administration/orcaInternalWrapperApi.ts`
- `web-client/src/features/administration/OrcaUserManagementPanel.tsx`
- `web-client/src/features/administration/MasterUpdatesPanel.tsx`
- `web-client/src/features/administration/delivery/WebOrcaConnectionCard.tsx`
- `web-client/src/features/administration/delivery/OrcaInternalWrapperCard.tsx`
- `web-client/src/features/administration/__tests__/AdministrationPage.connection.test.tsx`
- `web-client/src/features/administration/__tests__/AdministrationPage.internalWrapper.test.tsx`
- `server-modernized/src/main/java/open/dolphin/rest/AdminOrcaUserSupport.java`
- `server-modernized/src/main/java/open/dolphin/rest/AdminOrcaUserResource.java`
- `server-modernized/src/main/java/open/dolphin/rest/AdminOrcaConnectionResource.java`
- `server-modernized/src/main/java/open/dolphin/rest/AdminOrcaCapabilitiesResource.java`
- `server-modernized/src/test/java/open/dolphin/rest/AdminOrcaUserResourceTest.java`
- `../../../../docs/operations/ORCA_CERTIFICATION_ONLY.md`

## 受入れ条件

- admin targeted tests が pass
- grep で旧 wording が残っていない
- manageusersv2 create/update official semantics が evidence 化される
- docs/operations と current implementation が矛盾しない

## 必須コマンド

- `rg -n "今すぐ同期|認証済み|一括疎通（グループ）" web-client server-modernized docs`
- `rg -n "User_Number" server-modernized/src/main/java/open/dolphin/rest/AdminOrcaUserSupport.java`
- `rg -n "New_Group_Number|New_User_Number|New_Administrator_Privilege|Administrator_Privilege" server-modernized`
- admin 関連 vitest / server test 実行コマンド

## 報告フォーマット

```text
【ワーカー報告】
担当: SA-24 administration

1. summary
2. changed files
3. admin semantics 確定内容
4. 実行コマンド
5. tests pass/fail
6. grep 結果
7. docs 更新
8. unresolved items
9. merge conflict note
```

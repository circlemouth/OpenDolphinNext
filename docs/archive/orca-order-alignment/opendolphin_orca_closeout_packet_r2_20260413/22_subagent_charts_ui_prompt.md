# SA-22 charts / UI / DADS 用プロンプト R2

あなたは OpenDolphinNext ORCA是正の **charts / UI / DADS 専任サブエージェント** です。
この prompt は **gpt-5.4 high** 用です。

## 任務

今回あなたが閉じる対象は 2 つです。

1. `ChartsPage` の local-only wording drift
2. charts 側の handoff / guard 表示と DADS 整合

## 参照範囲

- `AGENTS.md`
- `web-client/notes/ui-current-contract.md`
- `../../../web-client/ux/dads_app_ui_design_rules_20260411.md`
- `OpenDolphin_ORCA_remediation_checklist.md`
- `00_remaining_tasks_matrix.md`

## 絶対ルール

- local summary を official ORCA 記録のように見せない
- 重要情報を単に小さく見せる目的で折りたたまない
- wording rollback で test を通さない
- reception 側 contract と食い違う charts-only workaround を入れない

## 主タスク

### 1. `ORCA 記録（要約）` を除去する
#### 最初に見るファイル
- `web-client/src/features/charts/pages/ChartsPage.tsx`
- `web-client/src/features/charts/MedicalOutpatientRecordPanel.tsx`
- `web-client/src/features/charts/OrcaSummary.tsx`
- charts UI tests

#### やること
- local summary wrapper の wording を local-only に揃える
- official ORCA収納情報 card と混同しないようにする
- `<details>` が DADS に反するなら除去または構造変更する
- wrapper まで含む regression test を追加する

### 2. charts の handoff / guard 表示を current contract に合わせる
#### 最初に見るファイル
- `web-client/src/features/charts/pages/ChartsPage.tsx`
- `web-client/src/features/charts/ChartsActionBar.tsx`
- `web-client/src/routes/useAppNavigation.ts`
- `web-client/src/features/workspaceTabs/WorkspaceTabBar.tsx`
- encounter context helpers / tests

#### やること
- handoff 不足時の guard 文言と actual block 条件を一致させる
- reception から渡る canonical key と charts 側 consume 条件を揃える
- test を wrapper / action bar / navigation で追加・更新する

### 3. DADS regression を固定する
- important information hidden の再発を防ぐ test を入れる
- wording 一貫性を test で固定する

## まず見る grep
- `rg -n "ORCA 記録（要約）|院内ローカル診療サマリ|ORCA収納情報" web-client/src/features/charts docs`
- `rg -n "details|summary|missing_schedule_key|missing_encounter_key|指定された scheduleKey / encounterKey が見つかりません" web-client/src/features/charts web-client/src/routes`

## 受入れ条件

- `ChartsPage` に `ORCA 記録（要約）` が残らない
- local summary の wording / visibility が DADS と current contract に一致する
- handoff guard が reception/nav contract と一致する
- charts targeted tests が pass する

## 必須コマンド

- 上記 grep
- charts / UI vitest
- handoff 관련 regression tests

## 報告フォーマット

```text
【ワーカー報告】
担当: SA-22 charts/ui

1. summary
2. changed files
3. local summary wording / DADS 確定内容
4. charts handoff / guard 確定内容
5. 実行コマンド
6. tests pass/fail
7. grep 結果
8. docs 更新
9. unresolved items
10. merge conflict note
```

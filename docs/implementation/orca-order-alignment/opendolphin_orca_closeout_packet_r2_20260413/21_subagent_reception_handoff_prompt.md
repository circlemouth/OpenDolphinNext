# SA-21 reception / handoff 用プロンプト R2

あなたは OpenDolphinNext ORCA是正の **reception / handoff 専任サブエージェント** です。
この prompt は **gpt-5.4 high** 用です。

## 任務

今回あなたが閉じる対象は 2 つです。

1. `ReceptionPage` の display-string 再解析除去
2. accept -> charts の canonical handoff 成立

## 参照範囲

- `AGENTS.md`
- `docs/contracts/orca-route-taxonomy.md`
- `docs/runbooks/release-validation.md`
- `web-client/notes/ui-current-contract.md`
- `OpenDolphin_ORCA_remediation_checklist.md`
- `00_remaining_tasks_matrix.md`

## 絶対ルール

- display string から department/physician code を逆算しない
- `patientId` だけで charts handoff を成立させない
- workaround/hack を script 側へ押し込まない
- canonical value 不足時は safe-side で block し、必要情報を明示する
- 外部仕様サイトへ行かない

## 主タスク

### 1. display-string 再解析 helper を除去する
#### 最初に見るファイル
- `web-client/src/features/reception/pages/ReceptionPage.tsx`
- `web-client/src/features/reception/api.ts`
- `web-client/src/features/reception/patientSearchApi.ts`
- reception tests / mocks

#### 問題の候補
- `resolveDepartmentCode`
- `normalizeDepartmentCode`
- `resolvePhysicianCodeSelection`
- display text から selection signature を作る処理

#### やること
- canonical `departmentCode` / `physicianCode` を state / entry model に持たせる
- selection / autofill / signature / accept request で display string を使わない
- display label はあくまで表示用途に限定する
- helper が不要なら削除する

### 2. accept -> charts handoff contract を確定する
#### 最初に見るファイル
- `web-client/src/features/reception/pages/ReceptionPage.tsx`
- `web-client/src/routes/useAppNavigation.ts`
- `web-client/src/features/charts/encounterContext.ts` または近縁 helper
- `web-client/scripts/qa-fullflow-weborca.mjs`
- reception 관련 tests

#### やること
- accept 後に charts を開く source of truth を 1 つに決める
  - mutation response
  - refreshed reception row
  - stored encounter context
  のいずれか、または deterministic な優先順
- `scheduleKey` / `encounterKey` を handoff に必須とする contract を UI / nav / tests で一致させる
- accept 成功後に一覧へ対象行が載るまでの refresh / state update を deterministic にする
- どうしても一覧へ反映待ちが必要なら、その待機と fallback を canonical key ベースで行う
- `patientId` だけで chart を開く fallback を残さない

### 3. tests / mock を追随させる
- reception targeted tests を追加・更新する
- mock / fixtures が新 contract と一致するようにする
- open-charts blocked / allowed 両系統を test で固定する

## まず見る grep
- `rg -n "resolveDepartmentCode|normalizeDepartmentCode|resolvePhysicianCodeSelection" web-client/src/features/reception`
- `rg -n "scheduleKey|encounterKey|openCharts\(|missing_schedule_key|missing_encounter_key" web-client/src/features/reception web-client/src/routes`

## 受入れ条件

- display-string 再解析 helper が source に残らない
- accept success 後に canonical handoff context が確立する
- reception UI / nav / tests が同じ contract を使う
- `qa-fullflow` が必要な handoff 情報を取れる状態になる

## 必須コマンド

- 上記 grep
- reception targeted vitest
- handoff / navigation regression tests
- 必要なら related server tests

## 報告フォーマット

```text
【ワーカー報告】
担当: SA-21 reception/handoff

1. summary
2. changed files
3. canonical handling 確定内容
4. accept->charts handoff 確定内容
5. 実行コマンド
6. tests pass/fail
7. grep 結果
8. docs 更新
9. unresolved items
10. merge conflict note
```

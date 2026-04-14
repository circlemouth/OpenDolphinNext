# merge / rerun strategy R2

## 1. 基本方針

- main agent は **統合責任者**
- feature の主作業はサブエージェントへ委譲する
- main agent は merge 順制御、競合解消、integrated patch、再実行判断、最終報告を担当する
- review bundle ではなく **real git checkout** で作業する
- 後方互換 route / shim / wording rollback はしない

## 2. 推奨サブエージェント順

### Step 0
- `.git` を確認する
- `git status --short`
- `git rev-parse HEAD`
- `git branch --show-current`
- `git remote show origin`
- `git merge-base HEAD origin/main || git merge-base HEAD origin/master`
- `git diff --stat`

### Step 1
- SA-20 route/shared/policy を先に実施・先にマージ
- 理由: audit taxonomy と shared result policy は shared conflict 面積が大きい

### Step 2
- SA-21 reception/handoff と SA-22 charts/ui を並列起動する
- merge 推奨順は `SA-21 -> SA-22`
- 理由: handoff contract を reception 側で先に確定し、その contract を前提に charts/ui を最終調整する

### Step 3
- SA-20 + SA-21 + SA-22 をマージした統合ブランチで build/test/grep を一度回す
- integrated patch が必要なら main agent が実施してよい

### Step 4
- SA-23 runtime/qa を **current merged branch** 起点で起動する
- live fullflow / evidence bundle / page error / 502 切り分けを担当させる

### Step 5
- SA-23 まで merged 後に SA-24 validation/docs を **current merged branch** 起点で起動する
- runbook に沿って final validation を完走させる

## 3. 競合解消ルール

### 3.1 shared files
競合しやすいファイル:
- `web-client/src/libs/http/httpClient.ts`
- `web-client/src/libs/observability/*`
- `web-client/src/libs/orca/*`
- `web-client/notes/ui-current-contract.md`
- `docs/runbooks/release-validation.md`
- `docs/releases/orca-remediation-cutover.md`
- `web-client/package.json`
- `package-lock.json`
- `pom.xml`
- `pom.server-modernized.xml`

### 3.2 reception vs charts
- `useAppNavigation.ts`, `ReceptionPage.tsx`, `ChartsPage.tsx`, encounter context helpers は reception/charts 双方が触りうる
- main agent は handoff contract を 1 つに固定し、`patientId` fallback を残さない

### 3.3 runtime script vs app code
- script 側の workaround だけで閉じない
- app 側 defect があるなら app を直す
- script 変更は current contract に追随する範囲に留める

## 4. rerun ルール

- SA-23 が integration defect を見つけた場合、main agent は自修正または該当サブエージェント prompt を current merged branch 前提で再実行する
- unresolved を抱えたまま SA-24 へ進まない

## 5. 最終 close 条件

- G0〜G7 が PASS
- live fullflow が ORCA send まで到達する、または external blocker が hard evidence 付きで切り分け済み
- `ORCA 記録（要約）` が UI/runtime/doc に残らない
- display-string 再解析 helper が source に残らない
- audit taxonomy と shared result policy が tests 付きで固定される
- evidence bundle が third party 再読可能な形で残る

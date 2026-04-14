# メインエージェント向け merge playbook

## 1. 基本方針

- メインエージェントは **統合責任者**
- 自分で小さな統合修正はしてよい
- ただし feature ごとの主作業はサブエージェントに委譲する
- merge 順は **共有面積の大きいものを先** にする
- 競合が起きたら「どちらが真か」ではなく、current authoritative docs に合わせて統合 branch 上で解決する
- rebase / merge / cherry-pick の方式は自由だが、最終的に command log と理由を残す

## 2. 推奨ブランチ

- 統合ブランチ: `orca-remediation/closeout-<RUN_ID>`
- route/shared: `agent/route-shared-<RUN_ID>`
- patients: `agent/patients-<RUN_ID>`
- reception: `agent/reception-<RUN_ID>`
- charts: `agent/charts-<RUN_ID>`
- admin: `agent/admin-<RUN_ID>`
- validation: `agent/validation-<RUN_ID>`

## 3. 推奨順序

### Step 0
- real git repo か確認する
- `git status --short`
- `git rev-parse HEAD`
- `git branch --show-current`
- `git remote show origin`
- `git merge-base HEAD origin/main || git merge-base HEAD origin/master`

`.git` がない状態では始めない。  
review bundle や artifact コピーではなく、**実 git checkout** を使う。

### Step 1
- SA-20 route/shared を先行
- これが shared constants, audit naming, inventory/exposure を握る

### Step 2
- SA-21 patients
- SA-22 reception
- SA-23 charts
- SA-24 administration
を並列起動する

### Step 3
- merge 順は下記を推奨
  1. SA-20
  2. SA-22
  3. SA-21
  4. SA-23
  5. SA-24

**理由**
- SA-20 が taxonomy と metadata の土台
- SA-22 は current FAIL を直接閉じる reception ホットパス
- SA-21 は patients official flow evidence を閉じる
- SA-23 は ChartsPage wording/DADS と chart support を閉じる
- SA-24 は shared conflict が少ない

### Step 4
- 上記 merge 後、統合ブランチで full build / test / grep を一度回す
- 必要なら main agent 自身で conflict patch と integration patch を作る
- その後 SA-25 validation/docs を current merged branch 起点で実行する

### Step 5
- SA-25 の差分を merge
- 全コマンドを再実行
- `30_final_report_template.md` に沿って報告

## 4. 競合解消ルール

### 4.1 shared files
以下は競合しやすい。

- `web-client/src/libs/http/httpClient.ts`
- `../../../../docs/contracts/orca-route-taxonomy.md`
- `../../../../web-client/notes/ui-current-contract.md`
- `../../../../docs/runbooks/release-validation.md`
- `web-client/package.json`
- `package-lock.json`
- `pom.xml`
- `pom.server-modernized.xml`

**ルール**
- docs 変更と code 変更が食い違うときは、authoritative docs を確認して code を正とするのではなく、**actual implementation + current contract + DADS** の三点一致へ持っていく
- test を通すためだけの wording rollback はしない
- backward compatibility のための旧 route 温存は禁止

### 4.2 charts vs patients
- `PatientInfoEditDialog.tsx` は patients agent と charts agent が触る可能性がある
- 原則は patients agent の flow / route を優先し、charts agent は naming / DADS / summary に集中させる
- charts agent 側で patient edit に触る必要が出た場合、main agent が統合ブランチで最終調停する

### 4.3 docs
- docs は feature agent が自分の差分に必要な最小更新を入れてよい
- ただし release/cutover/reporting の統一は SA-25 が最後に sweep する

## 5. main agent の最終責務

- subagent ブランチの差分レビュー
- merge 順の管理
- conflict 解消
- integrated fix
- full validation 実行
- 失敗時の再割当または自修正
- 最終報告

## 6. 各サブエージェントから必ず受け取るもの

- changed files list
- 実行コマンド一覧
- pass/fail/not run の test 一覧
- grep 結果
- docs 更新一覧
- 未解決事項
- main branch 取り込み時に注意する conflict note

## 7. close 判定

全体を close してよいのは、main agent が integrated branch 上で次を満たしたときだけ。

- `git diff --stat <merge-base>..HEAD` を提示できる
- required grep が clean
- server/web tests が pass
- runtime-ready / QA scripts の pass または未実施理由が受入れ可能
- G0〜G7 が PASS
- DADS 的な wording drift が残っていない

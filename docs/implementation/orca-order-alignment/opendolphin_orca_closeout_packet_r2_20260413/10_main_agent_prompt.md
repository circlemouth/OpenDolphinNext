# メインエージェント用プロンプト R2

あなたは OpenDolphinNext ORCA是正の **メインエージェント** です。
あなた自身の主責務は、**サブエージェント起動、マージ順制御、競合解消、統合修正、再実行判断、全体検証、最終報告** です。

全サブエージェントは **gpt-5.4 high** で起動してください。

## 目的

直近 closeout 報告のあとに残っている論点を current HEAD から解消し、最終的に以下を満たしてください。

- G0〜G7 をすべて PASS
- 再オープン対象の PR0 / PR3 / PR5 / PR6 を close する
- live fullflow を handoff -> order save -> ORCA send まで通す
- third party が再読可能な evidence bundle を作る
- real git repo 上で command log / grep log / test log / docs diff / merge record を提出できる

## 絶対ルール

- review bundle ではなく **実 git checkout** で作業する
- `.git` がない場所で始めない
- `client/` と `server/` は変更しない
- `web-client/`, `server-modernized/`, `api-contract/`, `docs/` を主対象にする
- 後方互換性を考えず、旧 route / 旧 naming / shim / patientId-only fallback を残さない
- 外部仕様サイトへ行かない。project docs とこの packet だけを参照する
- source / tests / grep / runtime evidence を真実とする
- live ORCA 実接続の証跡がない限り live pass と書かない
- G7 は UI / DADS gate である。live fullflow を G7 へ読み替えない

## 最初に読むもの

1. `AGENTS.md`
2. `docs/README.md`
3. `docs/contracts/orca-route-taxonomy.md`
4. `docs/contracts/orca-master-api.md`
5. `docs/operations/ORCA_CERTIFICATION_ONLY.md`
6. `docs/releases/orca-remediation-cutover.md`
7. `docs/runbooks/release-validation.md`
8. `web-client/notes/ui-current-contract.md`
9. `web-client/notes/orca-order-remediation-20260403.md`
10. `web-client/notes/orca-order-contract-cleanup-20260404.md`
11. `web-client/notes/orca-charge-canonicalization-20260404.md`
12. `OpenDolphin_ORCA_remediation_checklist.md`
13. `../../../web-client/ux/dads_app_ui_design_rules_20260411.md`
14. `00_remaining_tasks_matrix.md`
15. `01_merge_strategy.md`
16. `30_evidence_bundle_spec.md`
17. `31_final_report_template.md`

## あなたが最初にやること

1. RUN_ID を採番する
2. real git repo か確認する
3. 以下を実行し保存する
   - `git status --short`
   - `git rev-parse HEAD`
   - `git branch --show-current`
   - `git remote show origin`
   - `git merge-base HEAD origin/main || git merge-base HEAD origin/master`
   - `git diff --stat`
4. build tool / test runner / Playwright / node / maven を確認する
5. 統合ブランチを作る
6. 下記サブエージェントを起動する

## 起動するサブエージェント

- SA-20 route/shared/policy
  prompt: `20_subagent_route_shared_policy_prompt.md`
- SA-21 reception/handoff
  prompt: `21_subagent_reception_handoff_prompt.md`
- SA-22 charts/ui
  prompt: `22_subagent_charts_ui_prompt.md`
- SA-23 runtime/qa
  prompt: `23_subagent_runtime_qa_prompt.md`
- SA-24 validation/docs
  prompt: `24_subagent_validation_docs_prompt.md`

全サブエージェントは **gpt-5.4 high** で起動すること。

## 並列と順序

- SA-20 を先に着手・先にマージ
- SA-21 と SA-22 は SA-20 起動後に並列可
- merge 推奨順は `SA-20 -> SA-21 -> SA-22`
- その後、統合ブランチ上で build/test/grep を一度回す
- その結果を踏まえて SA-23 を **current merged branch** 起点で起動する
- SA-23 の unresolved を潰してから SA-24 を **current merged branch** 起点で起動する

## あなたが各 merge ごとにやること

1. サブエージェント差分を読む
2. changed files が担当範囲から逸脱していないか確認
3. checklist / ui-current-contract / DADS と矛盾しないか確認
4. conflicts を解消する
5. integrated patch が必要なら自分で入れる
6. その merge の直後に targeted build/test/grep を回す
7. log を保存する

## 今回あなたが close すべき残件

### 1. route/shared
- audit action naming を `ORCA_OFFICIAL_* / ORCA_MASTER_* / LOCAL_*` に統一する
- stale audit constant を source/test から消す
- shared ORCA Api_Result policy を libs に寄せる
- reception / charts / reports / admin の重複判定を置き換える

### 2. reception
- `resolveDepartmentCode` / `normalizeDepartmentCode` / `resolvePhysicianCodeSelection` を除去する
- display string から code を逆算しない
- accept -> charts handoff が `scheduleKey` / `encounterKey` で成立するようにする
- accept response / refreshed row / stored encounter context のどれを source of truth にするかを 1 つに固定する

### 3. charts / UI / DADS
- `ChartsPage` から `ORCA 記録（要約）` を除去する
- local summary を official 風 wording にしない
- 重要情報を不必要に `<details>` へ隠さない
- handoff guard 表示と actual behavior を一致させる

### 4. runtime / QA / evidence
- `qa-fullflow-weborca.mjs` の `?patientId=` fallback を除去する
- live run で order save / finish / ORCA send まで通す
- `medicalmodv2` request XML を artifact に保存する
- summary/json/network/request XML/screenshots/page errors を bundle 化する
- `appendChild null` / screenshot-after-close / 502 の repo-side defect を潰すか hard evidence で外因切り分けする

## 必須コマンド

### git / diff
- `git status --short`
- `git rev-parse HEAD`
- `git branch --show-current`
- `git remote show origin`
- `git merge-base HEAD origin/main || git merge-base HEAD origin/master`
- `git diff --stat`
- `git diff --stat <merge-base>..HEAD`

### grep / rg
- `rg -n "ORCA 記録（要約）|症状詳記（ORCA）|ORCAへ反映|今すぐ同期|認証済み|一括疎通（グループ）" web-client server-modernized docs`
- `rg -n "resolveDepartmentCode|normalizeDepartmentCode|resolvePhysicianCodeSelection" web-client/src/features/reception`
- `rg -n "PATIENTMODV2_OUTPATIENT|OFFICIAL_PATIENT_CREATE|OFFICIAL_PATIENT_UPDATE|ORCA_PATIENT_SYNC|ACTION_PATIENT_SYNC|ORCA_APPOINTMENT_OUTPATIENT" web-client server-modernized`
- `rg -n "isApiResultOk\(|isOrcaSuccessResult\(|resolveOrcaResultTone\(" web-client`
- `rg -n "patientId=\$\{|\?patientId=|openCharts\(" web-client/scripts web-client/src`
- `rg -n "appendChild\(|page\.screenshot|medicalmodv2" web-client/scripts`

## 最低限回す tests / scripts

- route inventory / exposure tests
- audit / route/shared tests
- reception targeted tests
- charts targeted tests
- any shared result policy tests you add
- `npm run verify:web-guard`
- `npm run ci`
- `mvn -Pstatic-analysis verify` または runbook で要求される server verify
- `node web-client/scripts/runtime-ready-smoke.mjs`
- `node web-client/scripts/qa-acceptmodv2-weborca.mjs`
- `node web-client/scripts/qa-fullflow-weborca.mjs`

## 受入れ条件

- audit taxonomy が tests 付きで固定される
- shared result policy が重複なく使われる
- reception display-string 再解析が source から消える
- `qa-fullflow` に `patientId` fallback が残らない
- charts local summary wording / visibility が DADS と current contract に一致する
- evidence bundle が `30_evidence_bundle_spec.md` に一致する
- final report が `31_final_report_template.md` に沿う

## 最終報告で必ず書くこと

- merge 順
- 各 subagent の changed files / tests / unresolved / merge note
- integrated patch の有無
- G0〜G7 判定
- PR0〜PR6 判定
- W1〜W6 判定
- 主要18論点
- live fullflow の実行結果と evidence path
- 残件が残るなら file/line 付きで area 別に書く

# メインエージェント用プロンプト

あなたは OpenDolphinNext ORCA是正の **メインエージェント** です。  
あなた自身が feature 実装の主担当ではありません。あなたの主責務は、**サブエージェント起動、依存関係の制御、マージ順の統括、競合解消、統合修正、全体検証、最終報告** です。

全サブエージェントは **gpt-5.4 high** で起動してください。

## 目的

前回の最終受入れレビューで残った論点を current HEAD から解消し、最終的に以下を満たしてください。

- G0〜G7 をすべて PASS
- PR0〜PR6 に FAIL / NOT VERIFIED を残さない
- W1〜W6 に Still Open / Not Verified を残さない
- real git repo 上で command log / grep log / test log / docs diff / merge record を提出できる

## 絶対ルール

- review bundle ではなく **実 git checkout** で作業する
- `.git` がない場所で作業開始しない
- `client/` と `server/` は変更しない
- `web-client/` `server-modernized/` `api-contract/` `docs/` を主対象にする
- 後方互換性を考えず、旧 route / 旧 naming / shim を残さない
- 外部仕様サイトを見に行かない。project docs とこの prompt 群だけを参照する
- source / tests / grep / docs / runtime evidence を真実とする
- 中途半端な報告をしない
- 実行不能な test が残るなら、その理由を潰す方向で対処する。単に「NOT VERIFIED のまま」で終わらない
- live ORCA 実接続の証跡がない限り live pass と書かない

## 最初に読むもの

1. `../../../../AGENTS.md`
2. `../../../../docs/README.md`
3. `../../../../docs/contracts/orca-route-taxonomy.md`
4. `../../../../docs/contracts/orca-master-api.md`
5. `../../../../docs/operations/ORCA_CERTIFICATION_ONLY.md`
6. `../../../../docs/releases/orca-remediation-cutover.md`
7. `../../../../docs/runbooks/release-validation.md`
8. `../../../../web-client/notes/ui-current-contract.md`
9. `../../../../web-client/notes/orca-order-remediation-20260403.md`
10. `../../../../web-client/notes/orca-order-contract-cleanup-20260404.md`
11. `../../../../web-client/notes/orca-charge-canonicalization-20260404.md`
12. `OpenDolphin_ORCA_remediation_checklist.md`
13. `../../../web-client/ux/dads_app_ui_design_rules_20260411.md`
14. `00_gap_matrix.md`
15. `01_merge_playbook.md`

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
4. package manager / build tool / test runner を確認する
5. 統合ブランチを作る
6. 下記サブエージェントを起動する

## 起動するサブエージェント

- SA-20 route/shared  
  prompt: `20_subagent_route_shared_prompt.md`
- SA-21 patients  
  prompt: `21_subagent_patients_prompt.md`
- SA-22 reception  
  prompt: `22_subagent_reception_prompt.md`
- SA-23 charts  
  prompt: `23_subagent_charts_prompt.md`
- SA-24 administration  
  prompt: `24_subagent_admin_prompt.md`

全サブエージェントは **gpt-5.4 high** で起動すること。

## 並列と順序

- SA-20 を先に着手・先にマージ
- SA-21, SA-22, SA-23, SA-24 は SA-20 起動後に並列可
- merge 推奨順は `SA-20 -> SA-22 -> SA-21 -> SA-23 -> SA-24`
- その後、統合ブランチ上で build/test/grep を一度回す
- その結果を踏まえて SA-25 validation/docs を **current merged branch** 起点で起動する  
  prompt: `25_subagent_validation_prompt.md`

## 各サブエージェントから受け取る報告フォーマット

必ず次を受け取ってから merge 判断すること。

- `【ワーカー報告】` 見出し
- summary
- changed files
- 実行コマンド
- tests pass/fail/not run
- grep 結果
- docs 更新
- unresolved items
- merge conflict note

## あなたが merge ごとにやること

1. サブエージェント差分を読む
2. 変更ファイルが担当範囲から逸脱していないか確認
3. authoritative docs と食い違っていないか確認
4. merge または cherry-pick する
5. 競合があれば integrated branch 上で自分で直す
6. その都度 targeted tests と grep を実行する
7. 破壊が出たら、必要なら自分で直す。必要なら同じサブエージェント prompt を使って再依頼する

## main agent が自分で必ず潰すべき integration risk

### 1. route/shared naming drift
- audit action 名が taxonomy から逸れていないか
- `httpClient.ts` metadata と route 実体がズレていないか

### 2. reception canonical code handling
- display string 再解析が復活していないか
- selection 値または official returned value をそのまま使っているか

### 3. chart local summary wording
- `ChartsPage.tsx` に `ORCA 記録（要約）` や類似の official 風 wording が残っていないか
- local summary を不必要に `<details>` に隠していないか

### 4. tests/docs drift
- feature agent が個別更新した docs と final docs が矛盾していないか
- `release-validation.md` に従うコマンドを integrated branch で全部回したか

## 最終検証で必ず実行すること

### git / diff
- `git status --short`
- `git rev-parse HEAD`
- `git branch --show-current`
- `git remote show origin`
- `git merge-base HEAD origin/main || git merge-base HEAD origin/master`
- `git diff --stat <merge-base>..HEAD`

### grep
- `rg -n "/api/orca/official/|/api/orca/master/|/api/local/" web-client server-modernized docs`
- `rg -n "/api/orca/patient/mutation|chart/subjectives|/api/orca/order/bundles|/api/orca/prescription-orders" web-client server-modernized docs`
- `rg -n "medicalmodv23" web-client server-modernized docs`
- `rg -n "todayString\\(|\\?\\?\\s*today|Perform_Date" web-client server-modernized`
- `rg -n "normalizePhysicianCode|shouldSuppressAcceptancePush" web-client server-modernized`
- `rg -n "症状詳記（ORCA）|ORCAへ反映|今すぐ同期|認証済み|一括疎通（グループ）|ORCA 記録（要約）" web-client server-modernized docs`
- `rg -n "patientlst3req|type=\\\"record\\\"|WholeName|Birth_StartDate|Birth_EndDate|InOut|Sex" server-modernized`
- `rg -n "Department_Code" web-client server-modernized`
- `rg -n "Medical_Information" web-client server-modernized`
- `rg -n "Insurance_Combination_Number" web-client server-modernized api-contract`
- `rg -n "Unpaid_Money_Total|Unpaid_Money_Information|Ic_Money|Ac_Money|Ai_Money|Oe_Money" web-client server-modernized`
- `rg -n "User_Number" server-modernized/src/main/java/open/dolphin/rest/AdminOrcaUserSupport.java`
- `rg -n "New_Group_Number|New_User_Number|New_Administrator_Privilege|Administrator_Privilege" server-modernized`
- `rg -n "contraindicationcheckv2|runContraindicationCheck" web-client server-modernized`
- `rg -n "Request_Number.*01|Request_Number.*02|medicationgetv2" web-client server-modernized`
- `rg -n "PATIENTMODV2_OUTPATIENT|ORCA_ORDER|ORCA_PRESCRIPTION|ORCA_SUBJECTIVE|ORCA_MEDICAL|OFFICIAL_PATIENT_|ORCA_PATIENT_GET|ACTION_PATIENT_SYNC" web-client server-modernized`

### tests / build / runtime
- server side targeted tests
- `npm run verify:web-guard`
- `npm run ci`
- targeted vitest suites
- `node web-client/scripts/runtime-ready-smoke.mjs`
- `node web-client/scripts/qa-acceptmodv2-weborca.mjs`
- `node web-client/scripts/qa-fullflow-weborca.mjs`

環境不足で失敗したら、原因を切り分けて必要な修正または依存導入を行い、再実行すること。

## 仕上げ

最後は `30_final_report_template.md` に沿って報告すること。  
報告では「何が閉じたか」だけでなく、「どの gate / PR / W が PASS になったか」を明示すること。

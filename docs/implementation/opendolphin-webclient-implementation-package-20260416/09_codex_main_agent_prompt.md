# 09. Codex Main Agent Prompt

以下をそのまま Codex main agent へ渡す。

---

あなたは OpenDolphin WebClient 改修計画の **main agent** です。  
役割は **統括専任** です。自分で broad rewrite を始めず、subagent の起動、worktree 分割、merge 順、conflict 解消、報告回収、最終検証を担当してください。

## 0. 実行モード
- planning package を正本にして implementation に着手する
- **後方互換性は考慮不要**
- **build artifacts / generated files / logs / screenshots は無視**
- **source / tests / docs / notes / route / DTO / QA script を正本**
- **external site / 一般論 / 自分の記憶で補完しない**
- この package と repo 内資料だけを参照する

## 1. 最初に読む順番
1. `README.md`
2. `00_master_summary.md`
3. `01_final_fixed_decisions.md`
4. `02_phase_and_workstream_plan.md`
5. `03_repo_touchpoint_plan.md`
6. `04_file_by_file_implementation_plan.md`
7. `05_screen_state_copy_spec.md`
8. `06_api_contract_and_boundary_plan.md`
9. `07_test_and_release_gate_plan.md`
10. `08_open_gates_and_risk_register.md`
11. `11_merge_order_and_pr_split.md`
12. `12_implementation_task_register.csv`
13. `13_open_gates.csv`
14. `14_test_matrix.csv`
15. `10_codex_subagent_prompts.md`

## 2. 固定条件
次は **絶対に崩さない**。
- 3 ペイン責務固定
- patient context 非永続
- `finish` と `send` の分離
- right rail chooser-only
- `送信済` と `会計済み` の非統合
- `send success != paid`
- generic bottom navigation の新規導入禁止
- 重要情報を disclosure に隠さない
- 1 画面 1 primary
- unknown は gate として残し、fail-close fallback を添える
- `source / tests / docs / notes > recovery plan` の優先順位
- repo truth に証拠がないことは **unknown** と書く
- TODO 追加、暫定 shim、format-only change は禁止

## 3. main agent の責務
あなたがやるのは次だけです。
1. package を読み、PR split / merge order / gate を確定する
2. subagent を **GPT 5.4 high** で起動する
3. subagent ごとに file scope と docset を渡す
4. worktree を分ける
5. conflict hotspot を事前に管理する
6. subagent report を回収し、repo truth / fixed premise / fail-close の順で裁定する
7. 必要なら手元で minimal merge fix と test fix を行う
8. canonical commands / targeted suites / QA script 実行計画をまとめる
9. final report と release packet 下書きを作る

## 4. broad rewrite 禁止
- 1 つの agent が reception / disease / document / billing を横断して rewrite しない
- responsive/a11y を理由に domain contract を勝手に変えない
- unknown gate を close するための guessed route / DTO / copy を実装しない
- `/api/admin/config` へ未証明 setting field を増やさない
- `patientId` first-match handoff / overlay を戻さない
- `document` / `orca` tool を right rail に戻さない
- `send success` を `paid` と同義に見せない

## 5. worktree / branch 例
作業用 worktree を次の単位で作る。
- `wt/pr-01-reception`
- `wt/pr-02-charts-main`
- `wt/pr-03-right-rail`
- `wt/pr-04-disease`
- `wt/pr-05-document-image`
- `wt/pr-06a-billing-core`
- `wt/pr-06b-billing-reception`
- `wt/pr-07-admin-setting`
- `wt/pr-08-residual-stabilization`
- `wt/pr-09-release-gate`

branch 名は自由だが、**PR split は package に合わせる**。

## 6. subagent 起動ルール
- subagent は全員 **gpt 5.4 high**
- subagent には package の該当 section と repo file scope だけを渡す
- subagent には「やってよいこと」と「non-goal」を明記する
- subagent が gate を閉じられない場合は、推測実装ではなく **fallback 実装 + gate 維持** で返させる
- subagent report には最低限次を含める  
  - 触った file  
  - fixed now に従ったか  
  - open gate に触れたか  
  - 実施 test  
  - 残る conflict / risk

## 7. merge 判定順
conflict が出たら次の順で裁定する。
1. current repo truth
2. `01_final_fixed_decisions.md`
3. `06_api_contract_and_boundary_plan.md`
4. `05_screen_state_copy_spec.md`
5. `08_open_gates_and_risk_register.md` の fallback
6. それでも決まらない場合は gate reopen

## 8. main agent の進め方
### Step 1
package を読んで task register を自分用 checklist に落とす。  
依存関係を見て、同時着手できる subagent を決める。

### Step 2
PR-01〜PR-07 までの owner subagent を並列起動する。  
ただし依存が強いものは順番を守る。
- PR-01 Reception
- PR-02 Charts main
- PR-03 Right rail
- PR-04 Disease
- PR-05 Document / image
- PR-06a Billing core
- PR-06b Billing reception
- PR-07 Admin / setting

### Step 3
subagent の成果を読み、merge order に従って統合する。  
conflict hotspot は次を優先監視する。
- `web-client/notes/ui-current-contract.md`
- `web-client/notes/patient-context-contract.md`
- `web-client/notes/feedback-spec.md`
- `web-client/notes/release-gate.md`
- `docs/runbooks/release-validation.md`
- `web-client/src/features/reception/pages/ReceptionPage.tsx`
- `web-client/src/features/charts/ChartsActionBar.tsx`
- `web-client/src/features/charts/OrcaSummary.tsx`
- `web-client/src/features/charts/pages/ChartsPage.tsx`
- `web-client/src/features/charts/DocumentCreatePanel.tsx`

### Step 4
残件だけを PR-08 residual stabilization で処理する。  
ここでは new contract を作らない。must-visible / focus / test drift / copy drift のみ。

### Step 5
PR-09 で test matrix / QA scripts / workflow / release packet を統合する。

## 9. verify
最低限次を回す前提で統括する。
```bash
cd web-client && npm run ci
mvn -f pom.server-modernized.xml -pl server-modernized -am -Pstatic-analysis verify
cd web-client && node scripts/runtime-ready-smoke.mjs
```

加えて、owner PR ごとの targeted suite と QA script を package の `14_test_matrix.csv` に従って回す。

## 10. 最終報告に必ず含めるもの
- merge 済み PR 順
- open gate の残件
- stop-ship 条件に触れていないこと
- canonical commands 結果
- targeted suite 結果
- manual QA / ORCA live QA の要否
- release packet に引き渡す evidence 一覧

## 11. 失敗時の方針
- gate 未解決で source を決められない → guessed implementation を入れず fail-close fallback
- 仕様衝突 → repo truth と fixed premise へ戻る
- test drift → 先に docs/current contract を見直し、それでも誤りなら test を修正
- broad rewrite が必要に見えても、まず PR split を守った最小差分で解く

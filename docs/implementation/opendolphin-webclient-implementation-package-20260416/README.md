# OpenDolphin WebClient 改修計画 実装 package

## 目的
この package は **planning-only** の最終統合物です。
Codex 実装担当は、この package と repo 内の source / tests / docs / notes / route / DTO / QA scripts だけを参照して着手してください。
この package 自体は **コード変更、コミット、PR 作成を含みません**。
ただし、後続の Codex 実装が追加判断なしで開始できる粒度まで decision / gate / touchpoint / tests / prompts を固定しています。

## 正本の優先順位
1. current repo truth: `source / tests / docs / notes / route / DTO / QA script`
2. recovery plan: 追加設計候補
3. reviewer 01〜09: integration payload
4. この package の fixed decision

repo truth と reviewer / recovery plan が衝突した場合は repo truth を優先します。
repo に証拠がないものは **unknown** とし、gate + fail-close fallback を残しています。

## 固定前提
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

## 読む順番
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
11. `09_codex_main_agent_prompt.md`
12. `10_codex_subagent_prompts.md`
13. `11_merge_order_and_pr_split.md`
14. `12_implementation_task_register.csv`
15. `13_open_gates.csv`
16. `14_test_matrix.csv`
17. `15_reviewer_integration_matrix.md`
18. `manifest.json`

## package の使い方
- `01_final_fixed_decisions.md` を **実装判断の正本** として扱う
- `13_open_gates.csv` に残っている項目は **埋めない**。gate を閉じる証拠が出るまで fail-close fallback を維持する
- `04_file_by_file_implementation_plan.md` の path ごとの acceptance と `14_test_matrix.csv` の test をセットで実装する
- `09_codex_main_agent_prompt.md` と `10_codex_subagent_prompts.md` をそのまま Codex に渡す
- build artifacts / logs / screenshots / generated output は repo truth 判定に使わない

## package 外でやらないこと
- 外部サイト参照
- repo に証拠がない route/state/schema/copy の推測補完
- TODO 追加
- 暫定 shim 追加
- format-only 変更
- 後方互換維持のための unsafe workaround

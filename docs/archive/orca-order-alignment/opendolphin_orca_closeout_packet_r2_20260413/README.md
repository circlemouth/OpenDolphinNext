# OpenDolphinNext ORCA是正 残件クローズ用 Codex Packet R2

このパケットは、2026-04-13 の closeout 報告を踏まえ、**まだ閉じていない残件だけ** を解消するための作業セットです。

## 目的

残件を次の順で閉じます。

1. route/shared の audit taxonomy と shared ORCA result policy を収束させる
2. reception の display-string 再解析を除去し、accept -> charts の canonical handoff を成立させる
3. charts の local-only wording / DADS drift を解消する
4. qa-fullflow / runtime evidence を current contract に合わせる
5. docs / validation / evidence bundle を受入れ可能な形へ揃える

## authoritative inputs

最初に必ず読むこと。

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
14. `00_remaining_tasks_matrix.md`
15. `01_merge_strategy.md`
16. `30_evidence_bundle_spec.md`

## このパケットの構成

- `00_remaining_tasks_matrix.md`
  - 今回の closeout 報告のあとに残っている残件の matrix
- `01_merge_strategy.md`
  - main agent のマージ順、再実行順、競合解消方針
- `10_main_agent_prompt.md`
  - main agent 用プロンプト
- `20_subagent_route_shared_policy_prompt.md`
  - audit taxonomy / shared ORCA result policy 専任
- `21_subagent_reception_handoff_prompt.md`
  - reception canonical handling / accept->charts handoff 専任
- `22_subagent_charts_ui_prompt.md`
  - ChartsPage wording / DADS / chart-side handoff 表示 専任
- `23_subagent_runtime_qa_prompt.md`
  - qa-fullflow / runtime QA / evidence bundle 専任
- `24_subagent_validation_docs_prompt.md`
  - final validation / docs / final report 専任
- `30_evidence_bundle_spec.md`
  - 提出すべき証跡の最低構成
- `31_final_report_template.md`
  - 最終報告テンプレート

## サブエージェント構成

全サブエージェントは **gpt-5.4 high** で起動する。

- SA-20 route/shared/policy
- SA-21 reception/handoff
- SA-22 charts/ui
- SA-23 runtime/qa
- SA-24 validation/docs

## 推奨進行

1. main agent は `10_main_agent_prompt.md` を使用して開始する
2. SA-20 を先に実施・先にマージする
3. SA-21 と SA-22 を並列起動する
4. SA-20 -> SA-21 -> SA-22 の順でマージし、統合修正を行う
5. merged branch 上で SA-23 を起動する
6. SA-23 が live QA / evidence を固めた後、SA-24 を起動する
7. `31_final_report_template.md` に沿って最終報告する

## close 条件

以下がすべて揃ったときだけ close とする。

- audit action naming が official/master/local taxonomy に一致する
- `ReceptionPage` に display-string から code を再解析する helper が残らない
- accept -> charts handoff が `scheduleKey` / `encounterKey` 前提で成立する
- `qa-fullflow-weborca.mjs` に `?patientId=` だけで charts を開く fallback が残らない
- `ChartsPage` に `ORCA 記録（要約）` が残らない
- local summary が official 風 wording でも `<details>` でも隠されない
- shared ORCA result policy が reception / charts / reports / admin で共通化される
- fullflow evidence bundle に summary / json / network / request XML / screenshots / page errors が同梱される
- `../../../../docs/runbooks/release-validation.md` の required validation を current merged branch で完走する

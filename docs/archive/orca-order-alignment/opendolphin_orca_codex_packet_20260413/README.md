# OpenDolphinNext ORCA是正 クローズアウト用 Codex Packet

> Archive note: this packet is historical. `PASS` / close 条件 / final report language below is not current evidence. Current status is tracked by `../../../implementation/opendolphin-postfix-static-remediation-20260418/08_static_exit_report.md` and current contracts/runbooks.

このパケットは、前回の最終受入れレビューで **FAIL / 再オープン推奨** になった残件を、Codex のメインエージェント + サブエージェントで収束させるための作業セットです。

## このパケットの前提

- 作業対象は `web-client/` `server-modernized/` `api-contract/` `docs/` を中心とする
- `client/` と `server/` は Legacy 参照専用。変更禁止
- 後方互換性は考慮しない
- 旧 route / 旧 payload / 旧 official 風 naming / 旧 UI 文言 / shim を残さない
- **project 内の資料と、このパケットだけを参照する**
- 外部仕様サイトは見に行かない
- 作業完了報告・コミットメッセージは信用せず、source / tests / docs / grep / runtime evidence を真実とする
- 全サブエージェントは **gpt-5.4 high**
- メインエージェントは、サブエージェント起動、マージ順序、競合解消、統合修正、最終報告を担当する

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

## このパケットの構成

- `00_gap_matrix.md`  
  残件の論点整理と close 条件
- `01_merge_playbook.md`  
  メインエージェントの進め方、サブエージェント起動順、マージ順、競合ルール
- `10_main_agent_prompt.md`  
  メインエージェント用プロンプト
- `20_subagent_route_shared_prompt.md`  
  route/shared/audit/naming 担当
- `21_subagent_patients_prompt.md`  
  patients / chart patient edit / local search wording 担当
- `22_subagent_reception_prompt.md`  
  reception official compliance 担当
- `23_subagent_charts_prompt.md`  
  chart send / chart support / naming / DADS 担当
- `24_subagent_admin_prompt.md`  
  administration / capabilities / wording / admin tests 担当
- `25_subagent_validation_prompt.md`  
  full validation / docs finalization / release evidence 担当
- `30_final_report_template.md`  
  最終報告テンプレート

## 推奨進行

1. メインエージェントは `10_main_agent_prompt.md` を使って開始する
2. まず real git checkout で provenance を確保する
3. `20` を先に完了・マージする
4. `21` `22` `23` `24` を並列で進める
5. 4本を順次マージし、統合修正を行う
6. 最後に `25` を current merged branch 上で実行する
7. `30_final_report_template.md` に沿って最終報告する

## 終了条件

- G0〜G7 をすべて PASS
- PR0〜PR6 で FAIL / NOT VERIFIED を残さない
- W1〜W6 で Still Open / Not Verified を残さない
- real git repo 上の command log, test log, grep log, docs diff, merge record を提出できる

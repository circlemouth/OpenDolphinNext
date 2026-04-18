# OpenDolphinNext post-fix static remediation prompt document set

作成日: 2026-04-18  
用途: post-fix static review integrator の rejected / partial findings を、実装変更が必要な Codex 作業と、コード変更不要の ChatGPT 検討作業へ分離する。

## 配置想定

このディレクトリ一式を実リポジトリの次の場所へ置く想定です。

```text
docs/implementation/opendolphin-postfix-static-remediation-20260418/
```

## 入力根拠

この文書セットは、以下の review/investigation 出力を根拠にする。

- 調査エージェント A: C7 / RT-01 / docs cleanup / evidence
- 調査エージェント B: SA-02 / C5 patient import
- 調査エージェント C: SA-03 / C3 / C6 / DADS
- 調査エージェント D: SA-04 / C1 / C2 / R-OBS-01 / T-NEG-01
- 調査エージェント E: pass area regression guard
- DADS 文書: `docs/web-client/ux/dads_app_ui_design_rules_20260411.md`
- current repo source/tests/docs/notes/scripts
- implementation package / prior review package

外部サイト、一般論、live WebORCA / dynamic ORCA 成功 claim は根拠にしない。

## 同梱ファイル

| file | purpose |
|---|---|
| `01_task_split.md` | 残課題を Codex 実装タスク / ChatGPT 検討タスクに分離 |
| `02_codex_manager_prompt.md` | 実リポジトリで作業する Codex メインエージェント用プロンプト |
| `03_codex_subagent_prompts.md` | gpt-5.4 high サブエージェント用プロンプト集 |
| `04_codex_merge_order_and_acceptance.md` | マージ順、テスト、exit 条件 |
| `05_chatgpt_noncoding_prompts.md` | コーディング不要タスクを ChatGPT に検討させるコピペ用プロンプト |
| `06_final_report_template.md` | Codex 作業後の worker report / static exit report テンプレート |
| `07_invariants_matrix.md` | 必ず守る invariant と対応 claim |

## 最上位の禁止事項

- 外部サイト参照禁止。
- live ORCA / WebORCA trial の成功・失敗を捏造しない。
- dynamic 実行は、この文書セットの static remediation では実施しない。
- worker report は claim であり truth ではない。
- test run は、実行 log / artifact を保存した場合だけ accepted と書く。
- build 成果物が zip 内にあっても無視し、source / test / docs / notes / scripts のみ確認する。
- 後方互換性は考慮しない。

## 現在の static verdict 前提

- overall: `REJECT WORKER REPORT`
- dynamic handoff: `NOT READY FOR DYNAMIC TRIAL CHECK`
- READY を阻止している主因:
  - C7 Critical: `medicalInformation` field-presence gate が閉じていない
  - C5 High: import full-success semantics が `skippedCount` / count consistency を gate していない
  - C3 High: charts Timeline / print に row-local false positive 経路が残る
  - C2 High: userinfo/raw target material の admin surface が残る
  - RT-01 High: route taxonomy guard/docs drift

# OpenDolphinNext post-fix static remediation prompt document set

作成日: 2026-04-18  
用途: post-fix static review integrator の rejected / partial findings を、実装変更が必要な Codex 作業と、コード変更不要の ChatGPT 検討作業へ分離する。

## 配置先

このディレクトリ一式は、実リポジトリでは次の場所に配置済みです。

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
| `docs/implementation/opendolphin-postfix-static-remediation-20260418/01_task_split.md` | 残課題を Codex 実装タスク / ChatGPT 検討タスクに分離 |
| `docs/implementation/opendolphin-postfix-static-remediation-20260418/02_codex_manager_prompt.md` | 実リポジトリで作業する Codex メインエージェント用プロンプト |
| `docs/implementation/opendolphin-postfix-static-remediation-20260418/03_codex_subagent_prompts.md` | gpt-5.4 high サブエージェント用プロンプト集 |
| `docs/implementation/opendolphin-postfix-static-remediation-20260418/04_codex_merge_order_and_acceptance.md` | マージ順、テスト、exit 条件 |
| `docs/implementation/opendolphin-postfix-static-remediation-20260418/05_chatgpt_noncoding_prompts.md` | コーディング不要タスクを ChatGPT に検討させるコピペ用プロンプト |
| `docs/implementation/opendolphin-postfix-static-remediation-20260418/06_final_report_template.md` | Codex 作業後の worker report / static exit report テンプレート |
| `docs/implementation/opendolphin-postfix-static-remediation-20260418/07_invariants_matrix.md` | 必ず守る invariant と対応 claim |

## 最上位の禁止事項

- 外部サイト参照禁止。
- live ORCA / WebORCA trial の成功・失敗を捏造しない。
- dynamic 実行は、この文書セットの static remediation では実施しない。
- worker report は claim であり truth ではない。
- test run は、実行 log / artifact を保存した場合だけ accepted と書く。
- build 成果物が zip 内にあっても無視し、source / test / docs / notes / scripts のみ確認する。
- 後方互換性は考慮しない。

## 現在の static verdict

- initial premise at package creation:
  - overall: `REJECT WORKER REPORT`
  - dynamic handoff: `NOT READY FOR DYNAMIC TRIAL CHECK`
- current manager rerun result:
  - overall: `ACCEPT WORKER REPORT`
  - dynamic handoff: `READY`
  - closed: `C1/C2/C3/C5/C6/C7/R-OBS-01/T-NEG-01/RT-01`
  - residual unknowns:
    - `runtime-ready-smoke` は `127.0.0.1:9080` 未起動で environment blocker
    - live ORCA / WebORCA は未実行で、成功 claim はしていない
    - archived/historical docs には stale PASS wording が一部残る
- final static exit report:
  - `docs/implementation/opendolphin-postfix-static-remediation-20260418/08_static_exit_report.md`

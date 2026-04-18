# OpenDolphin static fix package for ORCA dynamic trial precheck

## 目的
この package は、2026-04-18 の静的総括で残った blocker を、**dynamic ORCA trial check に進む前に静的に修正する**ための実装用ドキュメントセットです。
対象は integration-only review の結果として確定した blocker に限定し、**新規の別件テーマや広い再設計は含めません**。

この package は **planning / execution prompt package** です。
Codex 実装担当は、この package と current repo truth を使って実装を進めてください。
この package 自体はコード変更を含みません。

## repo 配置先
この zip は、リポジトリ直下に展開したときに次へ入る構成です。

`docs/implementation/opendolphin-static-fix-package-20260418/`

## 使う truth order
1. current repo truth: source / tests / docs / notes / QA scripts / contracts
2. 2026-04-18 static review integration verdict
3. 2026-04-16 implementation package
4. この package の execution decisions

repo truth とこの package が衝突した場合は、repo truth を優先してください。
ただし、review で **Critical / High / Medium blocker** として確定している論点を、repo 内の曖昧な doc-only positive で覆してはいけません。

## fix 対象 cluster
- C1: facility 解決の fail-close 崩れ
- C2: invalid host/baseUrl / malformed URL の sanitize 崩れ
- C3: Charts の transmission evidence が patientId latest cache 依存
- C4: OrcaSummary の must-visible 情報が closed details 配下
- C5: Patients official create/update/import の canonical re-fetch success 判定崩れ
- C6: OrcaSummary visibility test drift
- C7: QA script / release doc gate drift

## 今回やらないこと
- dynamic ORCA trial check の実行
- live 成否の主張
- blocker と無関係な UI refresh
- backward compatibility を守るための workaround
- new route / new DTO / new state owner の導入
- admin / reception / manageusers の PASS 領域を広く触ること

## 追加調査の扱い
**blocker 修正の着手前に必須の追加調査はありません。**
ただし、未解決の ambiguity を並走で閉じたい場合に備えて、ChatGPT 向け optional preflight prompt を `06_optional_chatgpt_preflight_prompts.md` に入れています。

## 読む順番
1. `README.md`
2. `00_master_summary.md`
3. `01_static_fix_scope_and_acceptance.md`
4. `02_phase_and_workstream_plan.md`
5. `03_repo_touchpoint_plan.md`
6. `04_task_register.csv`
7. `05_test_matrix.csv`
8. `06_optional_chatgpt_preflight_prompts.md`
9. `07_codex_main_agent_prompt.md`
10. `08_codex_subagent_prompts.md`
11. `09_merge_order_and_conflict_plan.md`
12. `10_handoff_to_dynamic_check.md`
13. `manifest.json`

## 実行方式
- main agent が全体の工程・起動・マージ・衝突解消・報告を統括する
- subagent は **全員 gpt 5.4 high** で起動する
- 実装は blocker first で進める
- docs/tests/code を同一 workstream で閉じる
- dynamic ORCA trial は、この package の完了後に別フェーズで行う

## live ORCA trial 情報の扱い
この package では **live 実行しない** ことが前提です。
ただし、後続フェーズで Codex に ORCA 接続テストを指示する場合は、次の trial site を使うことを main prompt に明記しています。

- URL: `https://weborca-trial.orca.med.or.jp/`
- user: `trial`
- password: `weborcatrial`

## package 外で禁止すること
- build artifact を truth 扱いすること
- “とりあえず通す” ための guessed implementation
- source/test negative を doc-only positive で覆すこと
- 重要情報を disclosure に押し込むこと
- send success と paid を再結合すること

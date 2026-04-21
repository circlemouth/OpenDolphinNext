# Unified ORCA post-retry + Clinical Wave 1 Codex docset

このドキュメントセットは、OpenDolphinNext の ORCA Trial Phase 3 post-retry hardening と Clinical Input Wave 1 を、1本の巨大プロンプトではなく、**統一された段階計画**として進めるための作業指示セットです。

## 使い方

Codex には最初に `10_CODEX_BOOTSTRAP_PROMPT.md` だけを貼り付けてください。Codex main agent はこの docset を repository に配置し、`02_WORK_ORDERS.md` の Work Order 順に進めます。

## 基本方針

- Phase 3 retry は既に 00001 に対して 1回実行済み。二重実行は禁止。
- Phase 4 / fullflow / 追加 mutation は、この docset の全 Work Order で実行禁止。
- Clinical Wave 1 は local/server/component/static coverage の hardening であり、live ORCA success claim ではない。
- 作業は Work Order ごとに停止点を置き、巨大な並列実行を避ける。
- subagent は使うが、同時 active subagent は原則 2、最大 3。
- 各 subagent は個別 worktree / branch で作業する。

## 推奨 current work order

まずは **WO-1: ORCA Phase 3 post-retry evidence/C7 hardening** だけを実施してください。Clinical Wave 1 は WO-1/WO-2 の review 後に進めます。

## 主要ファイル

- `00_CURRENT_CONTEXT.md` — 現在の事実関係
- `01_EXECUTION_STRATEGY.md` — 破綻させない進め方
- `02_WORK_ORDERS.md` — 統合計画全体
- `03_ORCA_POSTRETRY_GATE.md` — Phase 3 post-retry hardening
- `04_STATIC_DADS_GATE.md` — static failure / DADS
- `05_CLINICAL_WAVE1_GATE.md` — clinical Wave 1 integration
- `06_PHASE4_HANDOFF_GATE.md` — Phase 4 handoff preparation only
- `07_EVIDENCE_SANITIZE_POLICY.md` — evidence / sanitize policy
- `08_PACKAGE_POLICY.md` — final package policy
- `09_SUBAGENT_PROMPTS.md` — subagent prompts by Work Order
- `10_CODEX_BOOTSTRAP_PROMPT.md` — Codex へ最初に渡す短い prompt
- `11_CHATGPT_REVIEW_PROMPT.md` — Work Order 完了後レビュー用 prompt
- `12_REPORT_TEMPLATES.md` — reports / matrices templates
- `13_ACCEPTANCE_MATRIX.md` — overall acceptance matrix

## Reference material included

- `references/clinical-input-wave1-20260421/` — uploaded Clinical Input Wave 1 docset copy
- `references/dads_app_ui_design_rules_20260411.md` — DADS summary used for UI decisions
- `references/phase3-retry-20260421T060636Z/` — Phase 3 retry sanitized summary snippets
- `references/readonly-rerun-20260420T044655Z/` — prior read-only rerun summary snippets

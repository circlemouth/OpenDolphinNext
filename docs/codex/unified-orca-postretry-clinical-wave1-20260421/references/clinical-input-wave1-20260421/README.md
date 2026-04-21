# OpenDolphinNext clinical input Wave 1 docset

作成日: 2026-04-21
配置想定: `docs/codex/clinical-input-wave1-20260421/`

## 目的

このドキュメントセットは、CWP-01 のワーカー報告を受けて、次に行うべき clinical input coverage hardening を Codex へ渡すための指示一式です。

対象は Web client clinical input の local persistence / readback / validation / static ORCA boundary です。受付登録 Phase 3/4、fullflow、live ORCA mutation は別トラックであり、この Wave 1 では扱いません。

## 現在の判断

CWP-01: order-containing `/karte/document` save/readback/revision preservation は、ワーカー報告上 PASS です。添付された artifact の SHA-256 は、この docset 作成時点で報告値と一致することを確認しています。

```text
artifact: clinical-input-cwp01-karte-order-persistence-20260421.zip
sha256: bb7d646646b474cb345e108f25dfa0e3fad2db5a13d55b7285d94d85096c26f2
zip contents: 11 source/test/docs files only, no build artifacts observed
```

ただし、リポジトリ側では CWP-01 integration gate を必ず再実行してください。branch / commit / targeted tests / doc link check / worktree clean は、Codex 実端末で確認されたものだけを最終 claim に使えます。

## Wave 1 で並列実行する work package

| id | 担当 | 目的 | 並列可否 |
|---|---|---|---|
| CWP-05 | Sub-agent A | disease date/readback validation | CWP-01 gate 後に並列可 |
| CWP-02 | Sub-agent B | SOAP canonical server reload | CWP-01 gate 後に並列可 |
| CWP-03 | Sub-agent C | prescription full local persistence | CWP-01 gate 後に並列可。CWP-04 と fixture 調整注意 |
| CWP-04 | Sub-agent D | generic order bundle matrix + static ORCA boundary | CWP-01 gate 後に並列可 |
| CWP-06 | Sub-agent E | document attachment two-phase failure | CWP-01 gate 後に並列可。Document UI conflict 注意 |

推奨 merge 順は `CWP-05 -> CWP-02 -> CWP-04 -> CWP-03 -> CWP-06` です。

## 含まれるファイル

```text
00_SCOPE_AND_EVIDENCE_POLICY.md
01_CWP01_INTEGRATION_GATE.md
02_WAVE1_PARALLEL_WORKPLAN.md
03_MAIN_CODEX_PROMPT.md
04_MERGE_AND_CONFLICT_POLICY.md
05_ACCEPTANCE_MATRIX.md
06_DADS_AND_ORCA_BOUNDARY.md
07_FINAL_REPORT_TEMPLATE.md
08_ROADMAP_AFTER_WAVE1.md
09_CWP01_WORKER_REPORT.md
subagents/CWP05_DISEASE_DATE_READBACK_PROMPT.md
subagents/CWP02_SOAP_SERVER_RELOAD_PROMPT.md
subagents/CWP03_PRESCRIPTION_LOCAL_FLOW_PROMPT.md
subagents/CWP04_GENERIC_ORDER_MATRIX_PROMPT.md
subagents/CWP06_DOCUMENT_TWO_PHASE_FAILURE_PROMPT.md
prompts/FULL_COPYPASTE_PROMPTSET.md
templates/INTEGRATION_GATE_REPORT_TEMPLATE.md
templates/SUBAGENT_REPORT_TEMPLATE.md
```

## 絶対に混同しないこと

- CWP-01 は local chart/document persistence の証跡であり、ORCA medicalmodv2 live mutation の成功証明ではありません。
- MSW / unit / local server test の成功を live ORCA 成功として書かないでください。
- dynamic browser / Playwright / runtime success は、実行して sanitized command log がある場合だけ claim してください。
- ORCA 公式仕様判断が必要な classCode、bodyPart、comment、material、diseasev3、subjectivesv2 は “要 ORCA 公式仕様確認” として残してください。

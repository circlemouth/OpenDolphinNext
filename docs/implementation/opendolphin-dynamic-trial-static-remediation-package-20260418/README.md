# OpenDolphin dynamic-trial static remediation package

## 目的
この package は、2026-04-18 の最終 static verdict で **NO-GO FOR DYNAMIC TRIAL CHECK** になった残タスクを、
Codex 実装用に workstream 化したドキュメントセットです。

対象は、reviewer 統合で残った次の論点に限定します。

- C7: `medicalInformation` omission gate の request-shape mismatch
- C5: official patient import の business-success conflation
- C3: charts row-local static closure evidence gap
- C6: OrcaSummary must-visible visibility lock gap
- R-OBS-01: `clientAuthConfigured` observability regression
- T-NEG-01: sanitize negative test lock gap
- RT-01: route taxonomy guard / docs / source alignment gap
- carry-forward docs drift: 未検証 PASS 文言の残存

## この package が前提にする判定
- C1 / C2 / C4 は current source/test ベースでは閉じている
- reception official flow は大きく崩れていない
- administration / manageusers は大きく崩れていない
- `send success != paid` は維持されている
- ただし上の残タスクがあるので dynamic ORCA trial check にはまだ進めない

## 今回やらないこと
- live ORCA / WebORCA 実行
- dynamic trial 成否の主張
- blocker と無関係な UI refresh や broad redesign
- backward compatibility のための workaround
- new public route / new DTO / new state owner の導入
- build artifacts / logs / screenshots / test-results を truth 扱いすること

## truth order
1. current repo source / tests / docs / notes / scripts / contracts
2. final static verdict で確定した blocker / pass-area guard
3. `docs/implementation/opendolphin-static-fix-package-20260418/`
4. `docs/implementation/opendolphin-webclient-implementation-package-20260416/`
5. この package の execution decisions

repo truth と package が衝突した場合は repo truth を優先してください。
ただし、source/test-backed negative finding を doc-only positive で覆してはいけません。

## repo 配置先
この zip は repo root へ展開し、次へ置く前提です。

`docs/implementation/opendolphin-dynamic-trial-static-remediation-package-20260418/`

## 読む順番
1. `README.md`
2. `00_MANAGER_DOCSET.yaml`
3. `00_MANAGER_PROMPT.md`
4. `01_WORKPLAN.md`
5. `10_RELEASE_GATE_TRUTH_RESTORATION_PROMPT.md`
6. `20_PATIENT_IMPORT_SUCCESS_SEMANTICS_PROMPT.md`
7. `30_CHARTS_STATIC_CLOSURE_PROMPT.md`
8. `40_TRANSPORT_OBSERVABILITY_SANITIZE_PROMPT.md`
9. `50_STATIC_EXIT_AND_DYNAMIC_HANDOFF.md`
10. `60_TASK_REGISTER.csv`
11. `61_TEST_MATRIX.csv`
12. `manifest.json`

## 実行方式
- main agent が全体工程、subagent 起動、rebase、merge、conflict 解消、最終 report を統括する
- subagent は **全員 gpt 5.4 high**
- merge は blocker-first だが、pass area 保持と低衝突順も守る
- docs/tests/code は同じ workstream で閉じる
- static exit を満たすまで dynamic handoff しない

## subagent 一覧
- SA-01: release-gate-truth-restoration
- SA-02: patients-import-success-semantics
- SA-03: charts-static-closure
- SA-04: transport-observability-and-sanitize-net

## dynamic handoff について
live 実行はこの package の scope 外です。
static exit 後に Codex へ ORCA dynamic check を指示する場合の trial site 情報は `50_STATIC_EXIT_AND_DYNAMIC_HANDOFF.md` にだけ書いています。
この package 実行中は使いません。

# OpenDolphinNext remaining-static-tasks orchestrator prompt

```text
あなたは OpenDolphinNext の main Codex agent です。

目的:
2026-04-18 final static verdict で残った static tasks だけを閉じ、
dynamic ORCA trial check に進めるための静的前提を repo truth ベースで揃える。

今回の scope:
- C7 medicalInformation omission gate / release-doc drift
- C5 patient import full-success semantics
- C3 charts row-local static closure evidence
- C6 OrcaSummary must-visible visibility lock
- R-OBS-01 clientAuthConfigured observability regression
- T-NEG-01 sanitize negative test lock gap
- RT-01 route taxonomy guard / docs / source alignment
- older follow-up docs に残った未検証 PASS 文言の cleanup

今回の out of scope:
- live ORCA / WebORCA 実行
- dynamic trial success/failure の主張
- blocker と無関係な redesign
- backward compatibility 向け workaround
- new public route / DTO / state owner
- build artifacts / screenshots / logs / test-results のレビュー

truth order:
1. current repo source / tests / docs / notes / scripts / contracts
2. docs/implementation/opendolphin-dynamic-trial-static-remediation-package-20260418/
3. docs/implementation/opendolphin-static-fix-package-20260418/
4. docs/implementation/opendolphin-webclient-implementation-package-20260416/

使用制約:
- 外部サイト、一般論、記憶補完は禁止
- build artifact は無視する
- guessed implementation を入れない
- doc-only positive で source/test negative を覆さない
- backward compatibility は考慮しない
- DADS は docs/web-client/ux/dads_app_ui_design_rules_20260411.md を基準にする

壊してはいけない pass area:
- reception official flow
- administration / manageusers / connection wording
- C1/C2 core fail-close / sanitize
- C4 current OrcaSummary direction
- send success != paid
- route taxonomy public surface

subagent 運用:
- subagent は全員 gpt 5.4 high
- prompt は package 内の *_PROMPT.md をそのまま使う
- main agent の仕事は、起動、bridge、rebase、merge、conflict 解消、guard rerun、final report

subagent 一覧:
1. SA-01 release-gate-truth-restoration
   - prompt: 10_RELEASE_GATE_TRUTH_RESTORATION_PROMPT.md
2. SA-02 patients-import-success-semantics
   - prompt: 20_PATIENT_IMPORT_SUCCESS_SEMANTICS_PROMPT.md
3. SA-03 charts-static-closure
   - prompt: 30_CHARTS_STATIC_CLOSURE_PROMPT.md
4. SA-04 transport-observability-and-sanitize-net
   - prompt: 40_TRANSPORT_OBSERVABILITY_SANITIZE_PROMPT.md

launch order:
- SA-01 / SA-02 / SA-03 / SA-04 は並行起動してよい
- ただし merge order は blocker-first と低衝突順を優先する

merge order:
1. SA-01
2. SA-02
3. SA-03
4. SA-04
5. main agent final docs/guard reconciliation

ownership:
- SA-01 owner:
  - web-client/scripts/qa-lib/medical-information-gate.mjs
  - web-client/scripts/__tests__/medicalInformationGate.test.ts
  - web-client/scripts/qa-acceptmodv2-weborca.mjs
  - web-client/scripts/qa-fullflow-weborca.mjs
  - web-client/scripts/verify-no-blocked-orca-route-strings.mjs
  - web-client/scripts/runtime-ready-smoke.mjs
  - docs/runbooks/release-validation.md
  - docs/releases/orca-remediation-cutover.md
  - docs/contracts/orca-route-taxonomy.md
  - docs/implementation/opendolphin-webclient-remaining-followup-package-20260417/*
- SA-02 owner:
  - web-client/src/features/shared/orcaApiResponse.ts
  - web-client/src/features/outpatient/orcaPatientImportApi.ts
  - web-client/src/features/patients/api.ts
  - web-client/src/features/patients/PatientsPage.tsx
  - web-client/src/features/charts/PatientInfoEditDialog.tsx
  - related patient tests
- SA-03 owner:
  - web-client/src/features/charts/orcaClaimSendCache.ts
  - web-client/src/features/charts/OrcaSummary.tsx
  - web-client/src/features/charts/__tests__/OrcaSummary.semantics.test.tsx
  - web-client/src/features/charts/print/useOrcaReportPrint.ts
  - web-client/src/features/charts/print/__tests__/useOrcaReportPrint.test.tsx
  - web-client/src/features/charts/OrderBundleEditPanel.tsx
  - web-client/src/features/charts/OrderDockPanel.tsx
  - web-client/src/features/charts/DocumentTimeline.tsx
  - related charts tests
- SA-04 owner:
  - server-modernized/src/main/java/open/dolphin/orca/transport/OrcaTransportSettings.java
  - server-modernized/src/main/java/open/dolphin/orca/transport/RestOrcaTransport.java
  - server-modernized/src/main/java/open/dolphin/orca/transport/OrcaTransportRegistry.java
  - server-modernized/src/main/java/open/dolphin/orca/config/OrcaConnectionConfigStore.java
  - server-modernized/src/main/java/open/dolphin/rest/OperationsReadinessEvaluator.java
  - related server tests

実行手順:
1. README, 00_MANAGER_DOCSET.yaml, 01_WORKPLAN.md, 60_TASK_REGISTER.csv, 61_TEST_MATRIX.csv を読む
2. current repo で touched file の actual state を再確認する
3. 4 subagent を起動する
4. SA-01 branch を first merge する
5. SA-02 branch を second merge する
6. SA-03 branch を third merge する
7. SA-04 branch を fourth merge する
8. main agent が docs / task matrix / final handoff を整理する
9. focused tests を workstream ごとに rerun する
10. final gate と report を作る

merge 時の確認:
- scope creep がないか
- pass area regression がないか
- hidden-info, send/paid, route taxonomy, reception omission の fixed premise を壊していないか
- docs/tests/code が同期しているか
- “not verified” を勝手に success 扱いしていないか

minimum final test gate:
- cd web-client && npm run verify:web-guard
- cd web-client && npm run typecheck
- 61_TEST_MATRIX.csv の focused test
- cd web-client && npm run ci
- mvn -f pom.server-modernized.xml -pl server-modernized -am -Pstatic-analysis verify

final report format:
- summary
- merged_workstreams
- changed_files
- tests_run
- pass_area_guard_status
- residual_unknowns
- static_exit_status
- dynamic_handoff_readiness

最終判定ルール:
- static exit criteria を満たすまで READY FOR DYNAMIC TRIAL CHECK と書かない
- live ORCA に触っていない限り live claim は書かない
- unknown / not verified は success 扱いしない
```

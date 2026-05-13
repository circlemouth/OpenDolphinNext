# Implementation

`docs/implementation/` は current implementation workstream の入口だけを置く領域です。ここには index を残し、current contract、live runbook、dated packet、evidence dump を混在させません。

## Current Workstreams
- [OpenDolphinNext remaining tasks completion 2026-05-13](opendolphin-next-remaining-tasks-20260513T113016Z/README.md)
- [OpenDolphinNext remaining tasks Round 1 worker prompts 2026-05-13](opendolphin-next-remaining-tasks-20260513T113016Z/WORKER_PROMPTS_ROUND1.md)
- [OpenDolphinNext remaining tasks Round 2 worker prompts 2026-05-13](opendolphin-next-remaining-tasks-20260513T113016Z/WORKER_PROMPTS_ROUND2.md)
- [ORCA Trial Phase 3 retry evidence 2026-04-21](orca-trial-phase3-retry-20260421T060636Z/MAIN_AGENT_REPORT.md)
- [ORCA Trial Phase 3 command/sanitize fix 2026-04-20](orca-trial-phase3-command-sanitize-fix-20260420T220528Z/README.md)
- [ORCA Trial read-only contract fix Subagent A report 2026-04-20](orca-trial-readonly-contract-fix-20260420T000000Z/subagent-A-orca-wrapper-contract-report.md)
- [ORCA Trial read-only contract fix Subagent B report 2026-04-20](orca-trial-readonly-contract-fix-20260420T000000Z/subagent-B-readiness-classifier-report.md)
- [ORCA Trial read-only contract fix Subagent C report 2026-04-20](orca-trial-readonly-contract-fix-20260420T000000Z/subagent-C-local-selector-candidates-report.md)
- [ORCA Trial read-only contract fix Subagent D report 2026-04-20](orca-trial-readonly-contract-fix-20260420T000000Z/subagent-D-package-rerun-report.md)
- [ORCA Trial read-only diagnostics evidence rerun package 2026-04-20](orca-trial-readonly-diagnostics-20260420T000000Z/README.md)
- [ORCA Trial official patientgetv2 500 diagnostics 2026-04-20](orca-trial-readonly-diagnostics-20260420T000000Z/subagent-A-official-patientget-500-report.md)
- [ORCA Trial read-only preflight docs report 2026-04-20](orca-trial-readonly-preflight-harness-20260420T000000Z/subagent-C-docs-report.md)
- [ORCA Trial read-only preflight harness hardening 2026-04-19](orca-trial-readonly-preflight-harness-20260419T220346Z/README.md)
- [OpenDolphin dynamic-trial static remediation package 2026-04-18](opendolphin-dynamic-trial-static-remediation-package-20260418/README.md)
- [OpenDolphin postfix static remediation docset 2026-04-18](opendolphin-postfix-static-remediation-20260418/README.md)
- [OpenDolphin static fix package 2026-04-18](opendolphin-static-fix-package-20260418/README.md)
- [Clinical functional release readiness roadmap 2026-04-22](clinical-functional-release-readiness-roadmap-20260422/README.md)
- [UIQA browser verification preparation 2026-05-01](uiqa-browser-verification-20260501T144033Z/README.md)
- [Clinical full-screen QA automation 2026-05-02](clinical-fullscreen-qa-automation-20260502T073422Z/README.md)
- [OpenDolphinNext ORCA EHR completion 2026-05-10](opendolphin-next-orca-ehr-completion-20260510T092335Z/README.md)
- [ORCA order-family v2 candidate research 2026-04-25](clinical-functional-release-readiness-roadmap-20260422/order-family-v2-candidate-research-20260425T215740Z.md)
- [ORCA order alignment](orca-order-alignment/README.md)
- [OpenDolphin WebClient follow-up release gate package 2026-04-17](opendolphin-webclient-followup-release-gate-package-20260417/README.md)
- [OpenDolphin WebClient remaining follow-up package 2026-04-17](opendolphin-webclient-remaining-followup-package-20260417/README.md)
- [OpenDolphin WebClient 残ブロッカー解消 package 2026-04-17](opendolphin-webclient-implementation-package-20260417/README.md)
- [OpenDolphin WebClient implementation package 2026-04-16](opendolphin-webclient-implementation-package-20260416/README.md)

## Rules
- 契約の正本は `docs/contracts/` と `web-client/notes/` に置く
- 実行手順の正本は `docs/runbooks/` と `docs/releases/` に置く
- 背景資料は `docs/reference/` に置く
- dated packet / prompt / handoff / closeout / recovery / review template は `docs/archive/` に置く
- RUN_ID 固定の証跡は `artifacts/` に置き、`docs/` を evidence dump にしない

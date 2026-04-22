# Subagent B Functional Matrix Report

RUN_ID: `20260422T135114Z`

## Scope

This report is advisory markdown only. It summarizes documented feature-by-feature verification evidence for clinical-functional release readiness and separates local/static/server/component evidence from browser/fullflow/live ORCA evidence.

No production app code, CWP functional code, credentialed command, live ORCA command, ORCA connection test, browser fullflow, or credential inspection was performed for this report.

## Evidence Rules Used

- `accepted_local` means documented local/static/server/component tests passed in the cited report.
- `accepted_trial_acceptmodv2_only` means documented sanitized WebORCA Trial Phase 3 `acceptmodv2` evidence exists for the limited target only.
- `not_run` means the cited reports explicitly state the flow was not executed.
- `not_verified` means this worktree contains no sufficient documented evidence for the claim.
- `repo_external_unknown` means repo docs identify the item as requiring external sign-off and this worktree does not contain completion evidence.
- `not_found_in_worktree` means the expected work order or artifact is absent from this worktree.

## Executive Matrix

| Feature / flow | Local/static/server/component evidence | Browser/fullflow/live ORCA evidence | Conservative readiness label | Evidence basis |
|---|---|---|---|---|
| Electronic chart / karte document and local order persistence | `accepted_local`. CWP-01 accepted as WO-3 integration base; targeted Maven gate passed 24 tests for canonical document/order fixture, karte document persistence, revision snapshots, response JSON, snapshot contract, and document integrity. | `not_run`. No runtime, Playwright, e2e, Phase 3/4, fullflow, or live ORCA mutation for CWP-01. | `local_ready_live_not_verified` | `docs/implementation/unified-clinical-wave1-batch1-wo3-20260421/CWP01_INTEGRATION_GATE_REPORT.md`; `docs/codex/clinical-input-cwp01-karte-order-persistence-20260421/README.md` |
| SOAP S/O/A/P/free text save and reload | `accepted_local`. SOAP save, server response readback, component remount/chart reload restoration, partial failure dirty semantics, and invalid `performDate` fail-closed behavior accepted; targeted server/client tests passed. | `not_run`. Live `subjectivesv2`, Phase 4, fullflow, Playwright/e2e/runtime browser not run. | `local_ready_subjectivesv2_not_verified` | `docs/implementation/unified-clinical-wave1-batch1-wo3-20260421/CWP02_SOAP_SERVER_RELOAD_REPORT.md` |
| Disease / diagnosis add/edit/delete/outcome readback | `accepted_local`. Local disease persistence, `yyyy-MM-dd` validation, date order validation, unknown outcome validation, readback/edit badge retention, and ORCA mirror boundary accepted; targeted server/client tests passed. | `not_run`. Live `diseasev3`, Phase 4, fullflow, Playwright/e2e/runtime browser not run. | `local_ready_diseasev3_not_verified` | `docs/implementation/unified-clinical-wave1-batch1-wo3-20260421/CWP05_DISEASE_DATE_READBACK_REPORT.md` |
| Prescription local flow | `accepted_local`. Local prescription save/readback coverage for RP, drugs, usage, days/times, comments, settings, remarks, and doctor comments; web tests assert local endpoint boundary; targeted server/client tests passed. | `not_run`. No live ORCA mutation or live `medicalmodv2` success claim. | `local_ready_medicalmodv2_not_verified` | `docs/implementation/unified-clinical-wave1-batch2-wo4-20260421/subagent-reports/CWP03_PRESCRIPTION_LOCAL_FLOW_REPORT.md`; `docs/implementation/unified-clinical-wave1-batch2-wo4-20260421/FINAL_REPORT.md` |
| Generic order matrix | `accepted_local`. Local order matrix coverage for injection/test/physiology/bacteria/radiology/treatment/surgery/otherOrder, fail-closed radiology bodyPart blocking, local bundle route boundary, and server validation accepted. | `not_run`. Static `medicalmodv2` preparation/boundary tests are not live ORCA evidence; no fullflow. | `local_ready_static_send_boundary_only` | `docs/implementation/unified-clinical-wave1-batch2-wo4-20260421/subagent-reports/CWP04_GENERIC_ORDER_MATRIX_REPORT.md`; `docs/implementation/unified-clinical-wave1-batch2-wo4-20260421/MAIN_AGENT_REPORT.md` |
| Document save / failure handling | `accepted_local`. Attachment-backed document two-phase failure behavior accepted: `/karte/document` success followed by `/odletter/letter` failure keeps edits/attachments recoverable and retry reuses the successful document id for the same fingerprint. | `not_run`. No live ORCA mutation; no browser fullflow evidence. | `local_ready_server_compensation_not_decided` | `docs/implementation/unified-clinical-wave1-batch2-wo4-20260421/subagent-reports/CWP06_DOCUMENT_TWO_PHASE_FAILURE_REPORT.md`; `docs/implementation/unified-clinical-wave1-batch2-wo4-20260421/MAIN_AGENT_REPORT.md` |
| ORCA `acceptmodv2` | Local/read-only preflight: `accepted` for selected candidate `00001`; acceptedCandidateCount `1/11`; targetMutationRequestCount `0` in read-only evidence. Phase 3 retry: one approved wrapper mutation for `00001` only, sanitized evidence, `businessAcceptedWithWarnings`, C7 dynamic payload gate accepted. | `accepted_trial_acceptmodv2_only` for the limited Phase 3 target. Fullflow and Phase 4 remain `not_run`; candidates `00002`-`00011` mutation `not_run`; production ORCA not verified. | `trial_phase3_limited_accepted_no_fullflow` | `docs/implementation/orca-trial-readonly-contract-fix-20260420T141516Z/final-summary.sanitized.md`; `docs/implementation/orca-trial-phase3-retry-20260421T060636Z/final-summary.sanitized.md`; `docs/implementation/orca-trial-phase3-retry-20260421T060636Z/phase3-business-evidence.sanitized.md` |
| ORCA `medicalmodv2` | `accepted_local` only for local/static boundary coverage in CWP-01/CWP-03/CWP-04; local persistence and static payload preparation boundaries were tested. | `not_verified`. WO-3/WO-4 explicitly do not claim live `medicalmodv2`; Phase 4/fullflow not run. | `local_static_only_live_medicalmodv2_not_verified` | `docs/implementation/unified-clinical-wave1-batch1-wo3-20260421/FINAL_REPORT.md`; `docs/implementation/unified-clinical-wave1-batch2-wo4-20260421/FINAL_REPORT.md` |
| ORCA `diseasev3` | `accepted_local` for disease local persistence/readback only. | `not_run`. Live `diseasev3` success not claimed. | `local_only_live_diseasev3_not_verified` | `docs/implementation/unified-clinical-wave1-batch1-wo3-20260421/CWP05_DISEASE_DATE_READBACK_REPORT.md`; `docs/codex/unified-orca-postretry-clinical-wave1-20260421/05_CLINICAL_WAVE1_GATE.md` |
| ORCA `subjectivesv2` | `accepted_local` for SOAP local save/readback; report states SOAP local save does not call ORCA `subjectivesv2`. | `not_run`. Live `subjectivesv2` success not claimed. | `local_only_live_subjectivesv2_not_verified` | `docs/implementation/unified-clinical-wave1-batch1-wo3-20260421/CWP02_SOAP_SERVER_RELOAD_REPORT.md`; `docs/codex/unified-orca-postretry-clinical-wave1-20260421/05_CLINICAL_WAVE1_GATE.md` |
| Browser e2e / Playwright runtime | Existing repo contains e2e specs, but WO-3/WO-4 final evidence is local/server/component/static only. | `not_run` for WO-3/WO-4 clinical Wave 1. No current browser fullflow execution evidence in the cited clinical readiness work orders. | `not_verified_current_worktree` | `docs/implementation/unified-clinical-wave1-batch1-wo3-20260421/FINAL_REPORT.md`; `docs/implementation/unified-clinical-wave1-batch2-wo4-20260421/FINAL_REPORT.md` |
| Fullflow | No local evidence can substitute for fullflow. | `not_run` in Phase 3 retry, WO-3, WO-4, WO-5, WO-6, and WO-7 evidence. | `not_run` | `docs/implementation/orca-trial-phase3-retry-20260421T060636Z/final-summary.sanitized.md`; `docs/implementation/unified-phase4-handoff-wo5-20260421/FINAL_REPORT.md`; `docs/implementation/unified-phase4-execution-prompt-wo6-20260422/FINAL_REPORT.md`; `docs/implementation/unified-phase4-preexecution-readiness-wo7-20260422/FINAL_REPORT.md` |
| WebORCA Trial | Read-only candidate/preflight evidence exists, and one sanitized Phase 3 `acceptmodv2` retry is accepted with warnings for `00001` only. | Partial and narrow: no Phase 4, no fullflow, no `medicalmodv2`/`diseasev3`/`subjectivesv2` live mutation success. | `partial_trial_evidence_acceptmodv2_only` | `docs/implementation/orca-trial-readonly-contract-fix-20260420T141516Z/final-summary.sanitized.md`; `docs/implementation/orca-trial-phase3-retry-20260421T060636Z/MAIN_AGENT_REPORT.md` |
| Production ORCA | Repo docs define production config/secrets as repo-external sign-off. | `not_verified`. No production ORCA execution or sign-off completion evidence was found in this worktree. | `repo_external_unknown_release_blocking` | `docs/managerdocs/02_release_readiness_and_repo_external_signoff.md`; `docs/managerdocs/README.md` |
| Phase 4 execution / WO-8 | WO-5/WO-6/WO-7 contain handoff, prompt, and pre-execution readiness docs only. | `not_found_in_worktree` for WO-8. Phase 4 execution remains blocked/not run in existing docs. | `not_found_in_worktree` | `docs/implementation/unified-phase4-handoff-wo5-20260421/FINAL_REPORT.md`; `docs/implementation/unified-phase4-execution-prompt-wo6-20260422/FINAL_REPORT.md`; `docs/implementation/unified-phase4-preexecution-readiness-wo7-20260422/FINAL_REPORT.md`; worktree search found no `WO-8`/`wo8` implementation directory. |

## Local Evidence Summary

| Work order / CWP | Documented result | Verification type |
|---|---|---|
| WO-3 / CWP-01 | `ACCEPTED FOR WAVE 1 BASE`; 24 targeted Maven tests passed. | server/local persistence |
| WO-3 / CWP-02 | `accepted`; targeted server/client tests and typecheck passed. | server/component/local SOAP |
| WO-3 / CWP-05 | `accepted`; targeted server/client/readback tests and typecheck passed. | server/component/local disease |
| WO-4 / CWP-04 | `accepted`; targeted frontend/server tests and web guard passed in subagent, final main-worktree regression passed. | static/local/server generic orders |
| WO-4 / CWP-03 | `accepted`; targeted frontend/server tests and typecheck passed, final main-worktree regression passed. | local prescription |
| WO-4 / CWP-06 | `accepted`; targeted frontend tests, typecheck, lint, build passed in subagent, final main-worktree regression passed. | component/static document failure handling |
| WO-4 final regression | `PASS`; final web typecheck/build/lint/test:ci and CWP targeted server/client gates exit 0. | integrated local/static/server/component regression |

## Live / Browser Evidence Summary

| Evidence area | Documented status | Conservative interpretation |
|---|---|---|
| WebORCA Trial read-only candidate/preflight | Later sanitized read-only contract fix records `acceptedCandidateCount: 1/11` and exact preflight accepted for `00001`. | Supports Phase 3 candidate readiness only, not live mutation success by itself. |
| WebORCA Trial Phase 3 `acceptmodv2` | One approved retry for `00001`, `businessAcceptedWithWarnings`, C7 dynamic payload gate accepted. | Supports only limited `acceptmodv2` acceptance evidence for the sanitized target. |
| Browser fullflow | Explicitly `not_run`. | No release-readiness claim for full chart/order-to-ORCA fullflow. |
| Phase 4 execution | Existing WO-5/WO-6/WO-7 docs explicitly do not execute Phase 4; no WO-8 found. | `not_found_in_worktree` for Phase 4 execution evidence. |
| Production ORCA | External production secrets/config and operational sign-off are listed as required, but no completion evidence is present. | `repo_external_unknown`; release blocking until external sign-off exists. |

## Misuse Cases Considered

| Misuse case | Guardrail / conservative conclusion |
|---|---|
| Treating local CWP tests as live ORCA success. | Rejected. WO-3/WO-4 explicitly limit claims to targeted local/server/component/static coverage. |
| Treating `acceptmodv2` Phase 3 success as `medicalmodv2`/fullflow success. | Rejected. Phase 3 evidence is limited to `acceptmodv2`; fullflow and Phase 4 remain not run. |
| Treating WebORCA Trial evidence as production ORCA readiness. | Rejected. Production config/secrets and operational sign-off are repo-external and not verified in this worktree. |
| Treating absent accepted candidates or not-run states as business results. | Rejected. Existing docs state `not_run`, `not_verified`, HTTP 200, wrapper exit 0, and owner-waived evidence are not business success. |
| Treating WO-5/WO-6/WO-7 as authorization to execute Phase 4. | Rejected. Existing docs repeatedly state Phase 4 is not approved/not run; this worktree has no WO-8 execution package. |

## Release Readiness Implications

- Clinical local persistence/readback coverage is documented as improved and accepted for WO-3/WO-4.
- Browser e2e, fullflow, live `medicalmodv2`, live `diseasev3`, live `subjectivesv2`, Phase 4 execution, and production ORCA remain unverified in this worktree.
- WebORCA Trial evidence is partial and limited to read-only preflight plus one approved `acceptmodv2` Phase 3 retry for `00001`.
- Production release readiness remains blocked on repo-external GitHub required checks and production config/secrets sign-off per manager docs.
- Phase 4 execution status for this worktree must be reported as `not_found_in_worktree` because no WO-8 package or execution report is present.


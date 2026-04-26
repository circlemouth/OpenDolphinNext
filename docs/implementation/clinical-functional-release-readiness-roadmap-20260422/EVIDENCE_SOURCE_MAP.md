# Evidence Source Map

RUN_ID: `20260422T134401Z`

## Inventory Summary

| Category | Status | Notes |
|---|---|---|
| Codex context docs | present | All expected context docs were present. |
| WO-3 docs | present_with_one_expected_name_missing | `CWP01_KARTE_ORDER_PERSISTENCE_REPORT.md` was missing, but `CWP01_INTEGRATION_GATE_REPORT.md` exists and was used as the CWP-01 evidence source. |
| WO-4 docs | present | Required CWP-03/04/06 reports were present. |
| WO-5 docs | present | Phase 4 handoff evidence exists; Phase 4 not run. |
| WO-6 docs | present | Phase 4 prompt/approval gate docs exist; no execution approval. |
| WO-7 docs | present | Pre-execution readiness exists; blocked by approval scope. |
| WO-8 docs | present | Incorporated; stopped before live traffic because approved wrapper/action could not be identified. |
| Release / manager docs | present | Release validation, readiness, and unknowns docs were present. |
| DADS reference | present | Used only as future UI release-readiness reference, not current UI compliance evidence. |

## Present Input Documents

| Path | Evidence use |
|---|---|
| `docs/codex/unified-orca-postretry-clinical-wave1-20260421/00_CURRENT_CONTEXT.md` | Phase 3 retry context; `00001` limited live evidence boundary. |
| `docs/codex/unified-orca-postretry-clinical-wave1-20260421/01_EXECUTION_STRATEGY.md` | Strategy context. |
| `docs/codex/unified-orca-postretry-clinical-wave1-20260421/02_WORK_ORDERS.md` | Work order context. |
| `docs/codex/unified-orca-postretry-clinical-wave1-20260421/05_CLINICAL_WAVE1_GATE.md` | Clinical Wave 1 local/static boundary. |
| `docs/codex/unified-orca-postretry-clinical-wave1-20260421/06_PHASE4_HANDOFF_GATE.md` | Phase 4 handoff gate and forbidden actions. |
| `docs/codex/unified-orca-postretry-clinical-wave1-20260421/07_EVIDENCE_SANITIZE_POLICY.md` | Sanitized evidence and claim separation policy. |
| `docs/codex/unified-orca-postretry-clinical-wave1-20260421/08_PACKAGE_POLICY.md` | Package/sidecar policy. |
| `docs/codex/unified-orca-postretry-clinical-wave1-20260421/13_ACCEPTANCE_MATRIX.md` | Unified acceptance boundaries. |
| `docs/codex/unified-orca-postretry-clinical-wave1-20260421/14_MAIN_AGENT_AUTONOMY_AND_STOP_POLICY.md` | Main-agent stop policy context. |
| `docs/codex/unified-orca-postretry-clinical-wave1-20260421/references/phase3-retry-20260421T060636Z/final-summary.sanitized.md` | Prior `acceptmodv2` limited live trial success for `00001`. |
| `docs/implementation/unified-clinical-wave1-batch1-wo3-20260421/FINAL_REPORT.md` | WO-3 PASS, local/server/component/static only. |
| `docs/implementation/unified-clinical-wave1-batch1-wo3-20260421/MAIN_AGENT_REPORT.md` | WO-3 supporting report. |
| `docs/implementation/unified-clinical-wave1-batch1-wo3-20260421/CWP01_INTEGRATION_GATE_REPORT.md` | CWP-01 equivalent evidence source; expected filename differed. |
| `docs/implementation/unified-clinical-wave1-batch1-wo3-20260421/CWP02_SOAP_SERVER_RELOAD_REPORT.md` | SOAP local save/reload evidence. |
| `docs/implementation/unified-clinical-wave1-batch1-wo3-20260421/CWP05_DISEASE_DATE_READBACK_REPORT.md` | Disease date/readback evidence. |
| `docs/implementation/unified-clinical-wave1-batch2-wo4-20260421/FINAL_REPORT.md` | WO-4 PASS, local/server/component/static only. |
| `docs/implementation/unified-clinical-wave1-batch2-wo4-20260421/MAIN_AGENT_REPORT.md` | WO-4 supporting report. |
| `docs/implementation/unified-clinical-wave1-batch2-wo4-20260421/CWP03_PRESCRIPTION_LOCAL_FLOW_REPORT.md` | Prescription local flow evidence. |
| `docs/implementation/unified-clinical-wave1-batch2-wo4-20260421/CWP04_GENERIC_ORDER_MATRIX_REPORT.md` | Generic order matrix evidence. |
| `docs/implementation/unified-clinical-wave1-batch2-wo4-20260421/CWP06_DOCUMENT_TWO_PHASE_FAILURE_REPORT.md` | Document two-phase failure evidence. |
| `docs/implementation/unified-phase4-handoff-wo5-20260421/FINAL_REPORT.md` | WO-5 handoff PASS pending review; no Phase 4. |
| `docs/implementation/unified-phase4-handoff-wo5-20260421/MAIN_AGENT_REPORT.md` | WO-5 supporting report. |
| `docs/implementation/unified-phase4-handoff-wo5-20260421/PHASE4_HANDOFF_RUNBOOK.md` | Phase 4 handoff steps. |
| `docs/implementation/unified-phase4-handoff-wo5-20260421/PHASE4_PRECHECK_MATRIX.md` | Phase 4 precheck matrix. |
| `docs/implementation/unified-phase4-handoff-wo5-20260421/PHASE4_EVIDENCE_REQUIREMENTS.md` | Future Phase 4 evidence requirements. |
| `docs/implementation/unified-phase4-handoff-wo5-20260421/PHASE4_FORBIDDEN_ACTIONS.md` | Forbidden actions. |
| `docs/implementation/unified-phase4-execution-prompt-wo6-20260422/FINAL_REPORT.md` | WO-6 prompt prep PASS; no execution approval. |
| `docs/implementation/unified-phase4-execution-prompt-wo6-20260422/MAIN_AGENT_REPORT.md` | WO-6 supporting report. |
| `docs/implementation/unified-phase4-execution-prompt-wo6-20260422/PHASE4_EXECUTION_PROMPT_DRAFT.md` | Draft future execution prompt. |
| `docs/implementation/unified-phase4-execution-prompt-wo6-20260422/PHASE4_OWNER_APPROVAL_REQUEST.md` | Owner approval request template. |
| `docs/implementation/unified-phase4-execution-prompt-wo6-20260422/PHASE4_GO_NO_GO_MATRIX.md` | Phase 4 go/no-go matrix. |
| `docs/implementation/unified-phase4-execution-prompt-wo6-20260422/PHASE4_COMMAND_GUARD.md` | Command guard requirements. |
| `docs/implementation/unified-phase4-execution-prompt-wo6-20260422/PHASE4_EVIDENCE_TEMPLATE.md` | Evidence template. |
| `docs/implementation/unified-phase4-execution-prompt-wo6-20260422/PHASE4_STOP_POLICY.md` | Stop policy. |
| `docs/implementation/unified-phase4-execution-prompt-wo6-20260422/WO6_ACCEPTANCE_MATRIX.md` | WO-6 acceptance matrix. |
| `docs/implementation/unified-phase4-preexecution-readiness-wo7-20260422/FINAL_REPORT.md` | WO-7 blocked by approval scope; no live action. |
| `docs/implementation/unified-phase4-preexecution-readiness-wo7-20260422/MAIN_AGENT_REPORT.md` | WO-7 supporting report. |
| `docs/implementation/unified-phase4-preexecution-readiness-wo7-20260422/PHASE4_PREEXEC_GO_NO_GO_MATRIX.md` | Pre-execution go/no-go matrix. |
| `docs/implementation/unified-phase4-preexecution-readiness-wo7-20260422/PHASE4_BLOCKERS_CARRIED_FORWARD.md` | Carried blockers. |
| `docs/implementation/unified-phase4-preexecution-readiness-wo7-20260422/ZERO_CANDIDATE_HARNESS_READINESS_REVIEW.md` | Harness readiness review. |
| `docs/implementation/unified-phase4-preexecution-readiness-wo7-20260422/CREDENTIAL_REDACTION_SYNTHETIC_REHEARSAL.md` | Synthetic redaction rehearsal. |
| `docs/implementation/unified-phase4-preexecution-readiness-wo7-20260422/OWNER_APPROVAL_TOKEN_SCOPE_REVIEW.md` | Owner token scope review. |
| `docs/implementation/unified-phase4-preexecution-readiness-wo7-20260422/final-summary.sanitized.md` | WO-7 sanitized summary. |
| `docs/implementation/unified-phase4-preexecution-readiness-wo7-20260422/final-summary.sanitized.json` | WO-7 machine-readable summary. |
| `docs/implementation/unified-phase4-execution-wo8-20260422/FINAL_REPORT.md` | WO-8 incorporated; stopped before live action. |
| `docs/implementation/unified-phase4-execution-wo8-20260422/MAIN_AGENT_REPORT.md` | WO-8 supporting report. |
| `docs/implementation/unified-phase4-execution-wo8-20260422/PHASE4_EXECUTION_REPORT.sanitized.md` | WO-8 execution status. |
| `docs/implementation/unified-phase4-execution-wo8-20260422/PHASE4_BUSINESS_SUCCESS_ASSESSMENT.sanitized.md` | WO-8 business success not assessed because no live action. |
| `docs/implementation/unified-phase4-execution-wo8-20260422/final-summary.sanitized.md` | WO-8 sanitized summary. |
| `docs/implementation/unified-phase4-execution-wo8-20260422/final-summary.sanitized.json` | WO-8 machine-readable summary. |
| `docs/implementation/clinical-functional-release-readiness-roadmap-20260422/order-family-v2-candidate-research-20260425T215740Z.md` | Existing source-backed no-live order-family candidate research. |
| `docs/implementation/clinical-functional-release-readiness-roadmap-20260422/orca-trial-remaining-spec-intake-20260426T124656Z.md` | Sanitized intake of remaining ORCA Trial spec findings, operation mappings, no-live priorities, and live stop conditions. |
| `docs/runbooks/release-validation.md` | Release validation gate source. |
| `docs/managerdocs/README.md` | Manager docs index. |
| `docs/managerdocs/01_current_state_and_decision_rules.md` | Current state and decision rules. |
| `docs/managerdocs/02_release_readiness_and_repo_external_signoff.md` | Release readiness external sign-off requirements. |
| `docs/managerdocs/06_open_unknowns_and_evidence_gaps.md` | Open unknowns and evidence gaps. |
| `docs/codex/unified-orca-postretry-clinical-wave1-20260421/references/dads_app_ui_design_rules_20260411.md` | DADS reference boundary for future UI readiness. |

## Missing Expected Inputs

| Expected path | Status | Conservative handling |
|---|---|---|
| `docs/implementation/unified-clinical-wave1-batch1-wo3-20260421/CWP01_KARTE_ORDER_PERSISTENCE_REPORT.md` | missing/not_found | Do not infer content under this filename. Use `CWP01_INTEGRATION_GATE_REPORT.md` only as the available CWP-01 equivalent evidence source. Final verdict uses the missing-input variant. |

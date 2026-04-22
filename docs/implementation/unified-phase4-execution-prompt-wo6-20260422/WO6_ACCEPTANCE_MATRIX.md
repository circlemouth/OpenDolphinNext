# WO-6 Acceptance Matrix

| gate | required evidence | status | notes |
|---|---|---|---|
| prompt draft complete | `PHASE4_EXECUTION_PROMPT_DRAFT.md` | pass | Begins with `DRAFT ONLY - DO NOT RUN IN WO-6`. |
| owner approval request complete | `PHASE4_OWNER_APPROVAL_REQUEST.md` | pass | Separates prepared work from not-run execution. |
| go/no-go matrix complete | `PHASE4_GO_NO_GO_MATRIX.md` | pass | Keeps future execution approval blocked. |
| command guard complete | `PHASE4_COMMAND_GUARD.md` | pass | Requires env/secure credential delivery and redaction. |
| evidence template complete | `PHASE4_EVIDENCE_TEMPLATE.md` | pass | Requires sanitized summaries, not raw bodies. |
| stop policy complete | `PHASE4_STOP_POLICY.md` | pass | Stops on drift, raw artifacts, stale sidecars, and overclaims. |
| no Phase 4 execution | command log and reports | pass | Phase 4 remains `not_run`. |
| no fullflow | command log and reports | pass | fullflow remains `not_run`. |
| no live ORCA mutation | command log and reports | pass | live ORCA mutation remains no. |
| no live ORCA connection test | command log and reports | pass | no ORCA connection tests in WO-6. |
| no raw sensitive artifact | final package source-scope scan | blocked_until_final_sidecar_validation_passes | Must target final WO-6 ZIP hash. |
| sidecar naming unique | final sidecar directory | blocked_until_final_sidecar_validation_passes | Uses `<final ZIP basename>.sidecars/`. |
| source-scope scan | final sidecar log | blocked_until_final_sidecar_validation_passes | Bound to final ZIP path and sha256. |
| metadata validation | final sidecar log | blocked_until_final_sidecar_validation_passes | Bound to final ZIP path and sha256. |
| artifact ledger verification | final sidecar log | blocked_until_final_sidecar_validation_passes | Ledger covers final sidecar directory files. |
| may_run_phase4 | final report | blocked | `may_run_phase4=false`. |
| may_request_owner_phase4_execution_approval | final report | blocked_until_final_sidecar_validation_passes | `yes` if final package and sidecars pass. |

## WO-6 Decision

- `may_run_phase4=false`
- `may_request_owner_phase4_execution_approval=yes`, after final package/source-scope scan/metadata validation/artifact ledger verification pass.
- `may_start_phase4_execution=no_until_explicit_owner_approval_after_ChatGPT_review`

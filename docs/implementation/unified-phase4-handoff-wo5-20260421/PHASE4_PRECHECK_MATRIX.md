# Phase 4 Precheck Matrix

| precheck | required evidence | source path / artifact path | accepted / blocked / not verified | notes |
|---|---|---|---|---|
| Phase 3 already executed once only | sanitized Phase 3 retry summary | `docs/codex/unified-orca-postretry-clinical-wave1-20260421/references/phase3-retry-20260421T060636Z/final-summary.sanitized.md` | accepted | Phase 3 retry must not be rerun. |
| Phase 4 not_run | WO-4/WO-5 reports | `docs/implementation/unified-clinical-wave1-batch2-wo4-20260421/FINAL_REPORT.md`; `docs/implementation/unified-phase4-handoff-wo5-20260421/FINAL_REPORT.md` | accepted | WO-5 did not run Phase 4. |
| fullflow not_run | WO-4/WO-5 reports | same as above | accepted | No fullflow evidence is claimed. |
| `00002` through `00011` not_run | sanitized current context | `docs/codex/unified-orca-postretry-clinical-wave1-20260421/00_CURRENT_CONTEXT.md` | accepted | Future mutation scope remains candidate/patient `00001` only. |
| WO-2 owner waiver not converted to success | WO-3/WO-4 final reports | `docs/implementation/unified-clinical-wave1-batch1-wo3-20260421/FINAL_REPORT.md`; `docs/implementation/unified-clinical-wave1-batch2-wo4-20260421/FINAL_REPORT.md` | accepted | WO-2 reopen package evidence remains owner-waived / not_verified. |
| WO-3 accepted | ChatGPT/user-provided acceptance and WO-3 report | `docs/implementation/unified-clinical-wave1-batch1-wo3-20260421/FINAL_REPORT.md` | accepted | Local/server/component/static only. |
| WO-4 accepted | ChatGPT/user-provided acceptance and WO-4 report | `docs/implementation/unified-clinical-wave1-batch2-wo4-20260421/FINAL_REPORT.md` | accepted | Local/server/component/static only. |
| static checks green | WO-4 final regression summary | `docs/implementation/unified-clinical-wave1-batch2-wo4-20260421/TEST_LOGS.sanitized.md` | accepted | WO-5 docs-only did not rerun npm/Maven static suites. |
| final package scan target final hash | WO-5 post-package scan log and summary | `docs/implementation/unified-phase4-handoff-wo5-20260421/review-package/<final-zip>.secret-scan-review-bundle.log`; `docs/implementation/unified-phase4-handoff-wo5-20260421/review-package/<final-zip>.summary.txt` | accepted with external sidecar | Must be rerun if ZIP is regenerated. |
| raw artifact exclusion | package source-scope scan and package manifest | `docs/implementation/unified-phase4-handoff-wo5-20260421/review-package/` | accepted with external sidecar | Excludes HAR, traces, videos, screenshots, raw network dumps, raw ORCA bodies, credential-bearing files. |
| command guard reviewed | this runbook and forbidden action doc | `docs/implementation/unified-phase4-handoff-wo5-20260421/PHASE4_HANDOFF_RUNBOOK.md`; `docs/implementation/unified-phase4-handoff-wo5-20260421/PHASE4_FORBIDDEN_ACTIONS.md` | accepted | Future prompt must carry the explicit approval gate. |

## Current WO-5 Decision

- may_run_phase4: `false`
- may_prepare_phase4_prompt: `no_until_ChatGPT_accepts_WO5`
- may_start_next: `no_until_ChatGPT_accepts_WO5`

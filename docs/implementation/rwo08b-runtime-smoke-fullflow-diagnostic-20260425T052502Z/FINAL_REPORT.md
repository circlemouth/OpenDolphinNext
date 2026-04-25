# RWO-08B Runtime Smoke And Diagnostic Fullflow

RUN_ID: `20260425T052502Z`

## Result

`RUNTIME_READY_SMOKE_PASS_DIAGNOSTIC_FULLFLOW_BLOCKED_MEDICAL_INFORMATION_OMISSION`

The canonical `runtime-ready-smoke` passed against the current non-S3 Trial-local runtime with JSON-only evidence. It resolved the smoke appointment/visit row, opened Charts, rendered the smoke patient display name in the Charts patient summary, completed the start transition, and recorded zero blocked route hits.

The next diagnostic fullflow was executed under the owner-approved Diagnostic Artifact Exception with `QA_ARTIFACT_DIR` set to a gitignored local diagnostic directory. It exited `1` and is classified as blocked before order/send: the sanitized fullflow summary reports `repo-defect` / `medical_information_omission_violation`, no request XML was created, and canonical Charts handoff did not become available after accept.

## Sanitized Evidence

| Item | Result |
|---|---|
| Runtime smoke | `pass` |
| Runtime smoke artifacts | JSON-only under gitignored `artifacts/webclient/runtime-gate-ready/20260425T052502Z/` |
| Diagnostic fullflow | `blocked` / exit `1` |
| Fullflow blocker | `repo-defect` / `medical_information_omission_violation` |
| Medical information gate | enforced, `ok=false`, checked requests `1` |
| Charts handoff | `error`, no schedule/encounter key became available |
| Order/send | not run; request XML not created |
| Diagnostic artifacts | local-only, untracked, gitignored |
| Raw artifacts committed/packaged | `false` |

## Diagnostic Artifact Manifest

Local-only root: `artifacts/diagnostic-fullflow/20260425T052502Z/fullflow`

| Class | Count |
|---|---:|
| screenshots | 4 |
| network JSON | 2 |
| request XML | 0 |
| HAR | 0 |
| logs | 3 |
| JSON | 8 |
| markdown | 1 |
| total files | 16 |

These files are diagnostic artifacts only and are not release evidence, not committed, and not packaged.

## Misuse Cases Checked

| Misuse case | Control / result |
|---|---|
| Runtime smoke pass is overclaimed as L4 fullflow success. | Not claimed; diagnostic fullflow is separately blocked. |
| Raw diagnostic screenshots/network/request details enter tracked evidence. | Only counts and allowlisted classifications were copied; artifact roots are gitignored. |
| Wrapper exit or HTTP-level activity is treated as business success. | Not claimed; business classification is `blocked_repo_defect`, `businessAccepted=false`. |
| Production ORCA or S3 readiness is inferred from Trial-local evidence. | Not claimed; both remain out of scope/non-claims. |

## Claim Boundary

Allowed claim: `runtime-ready-smoke` passed for the current non-S3 Trial-local runtime.

Not claimed: L4 fullflow success, Trial ORCA business success, `diseasev3` acceptance, `subjectivesv2` acceptance, Request_Number `02` / `03` / `04` acceptance, production ORCA readiness, S3/object-storage readiness, rollback rehearsal, owner final GO, or final release readiness.

## Next Action

Investigate and fix/classify the fullflow accept workflow medical-information omission and canonical handoff timeout with focused no-live tests. After a concrete fix or changed precondition, rerun `runtime-ready-smoke` and one diagnostic fullflow into a gitignored local output directory.

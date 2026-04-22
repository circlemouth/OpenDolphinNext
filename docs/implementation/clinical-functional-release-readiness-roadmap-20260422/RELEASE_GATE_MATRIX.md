# Release Gate Matrix

RUN_ID: `20260422T134401Z`

| Gate | Current status | Evidence | Blocker | Required exit criteria | Next WO |
|---|---|---|---|---|---|
| Functional local/server/component/static gate | PARTIAL_PASS | WO-3/WO-4 PASS for CWP-01/02/03/04/05/06. | Expected CWP-01 filename missing; evidence is local/static only. | Owner accepts equivalent CWP-01 report mapping and targeted checks remain green. | RWO-01 |
| Browser e2e gate | NOT_RUN | WO-3/4 explicitly say Playwright/e2e/runtime browser not run. | No runtime browser evidence. | Sanitized browser e2e passes for core chart workflows. | RWO-02-RWO-05 |
| ORCA trial live gate | PARTIAL_LIMITED | Prior Phase 3 acceptmodv2 `00001` only; WO-8 no live action. | medicalmodv2/diseasev3/subjectivesv2/fullflow not verified. | Owner-approved live trial evidence per endpoint/scope. | RWO-06/RWO-07 |
| ORCA production readiness gate | NOT_RUN | Manager docs list production config/secrets as external unknowns. | No production ORCA evidence. | Production credentials/config governance and owner approval completed. | RWO-10 |
| Security/secret handling gate | PARTIAL_PASS_FOR_DOC_SCOPE | WO-6/7 redaction policies; this roadmap uses sanitized docs only. | Future live evidence still needs strict parser and scan. | No raw credentials, cookies, sessions, patient/insurance details, or raw ORCA bodies in package. | RWO-09 |
| Evidence sanitization gate | PASS_FOR_ROADMAP_SCOPE | Evidence policy applied; scan performed on roadmap/review bundle. | Not a full-source scan. | Review-bundle scan passes or findings are resolved. | RWO-01/RWO-09 |
| Package/review bundle gate | PENDING_UNTIL_PACKAGE | Package generated in Phase 9. | Sidecar validation must bind to final ZIP. | ZIP, sha256, size/count, sidecars, manifests complete. | RWO-01 |
| Repo state / CI gate | NOT_RUN_THIS_TASK | Preflight branch/HEAD/status recorded. | No CI executed by this documentation-only task. | Release validation commands pass in a dedicated validation WO. | RWO-09/RWO-11 |
| Deployment configuration gate | NOT_VERIFIED | Manager docs external config list. | DB, ORCA keys, S3, 2FA, integrity keyring, proxies unknown. | External config/secrets evidence and deployment manifest sign-off. | RWO-09/RWO-10 |
| Operator runbook gate | PARTIAL | Release validation and Phase 4 runbooks exist. | Actual operator dry run/sign-off not shown. | Operator can execute documented start/stop/rollback and evidence capture. | RWO-09 |
| Rollback / stop policy gate | PARTIAL | WO-6/WO-7 stop policy and release-validation rollback references. | Final release stop/rollback not rehearsed here. | Release candidate stop/rollback criteria accepted by owner. | RWO-09/RWO-11 |
| Owner sign-off gate | NOT_VERIFIED | WO-7 approval absent; WO-8 approval wrapper/action mismatch. | Release owner GO/NO-GO missing. | Written owner sign-off for roadmap, live ORCA scopes, and final release. | RWO-01/RWO-11 |
| UI/DADS review gate | NOT_VERIFIED | DADS reference exists; no UI change in this task. | Current UI compliance not audited. | Separate UI readiness review if release includes UI compliance claim. | RWO-02/RWO-09 |


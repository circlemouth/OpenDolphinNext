# Risk Register

RUN_ID: `20260422T134401Z`

| Risk | Severity | Current control | Residual gap | Next work |
|---|---|---|---|---|
| Prescription/order live ORCA registration unverified. | High | Local/static tests and claim boundary. | No live medicalmodv2 evidence. | RWO-03/RWO-04/RWO-06. |
| Full electronic chart fullflow unverified. | High | Fullflow explicitly not claimed. | No integrated browser/live workflow evidence. | RWO-08. |
| Production ORCA readiness accidentally treated as required or claimed. | High | Roadmap now scopes ORCA connectivity to WebORCA / ORCA Trial only; RUN_ID `20260423T034854Z` refreshed the RWO-10 non-claim marker. | A separate production plan may be needed later if stakeholders request production ORCA readiness. | Keep `not_applicable_trial_only`; do not execute production ORCA in this automation. |
| S3/object-storage readiness accidentally treated as required or claimed. | High | Roadmap now skips S3/MinIO/object-storage-dependent tasks and keeps object storage as an explicit non-claim. | Attachment storage or PHR export storage would need a separate owner-approved S3 plan later. | RWO-11 final summary must preserve `not_applicable_out_of_scope`. |
| Browser runtime behavior only partially verified for Clinical Wave 1. | High | Artifact-free browser chart-open, local persistence, and one SOAP/disease UI clickthrough evidence exists for selected RWO-02 through RWO-05 workflows. | Prescription/order full UI click-through browser coverage and fullflow are still missing. | Continue safe no-artifacts browser specs; do not use artifact-capturing fixtures. |
| Overclaiming from prior Phase 3 success. | High | Claim boundary limits to `00001` acceptmodv2. | Stakeholders may extrapolate. | RWO-01 owner sign-off. |
| Raw artifact/secret leakage in future live runs. | High | Evidence sanitize policy. | Future live scripts must enforce allowlists. | RWO-06/RWO-09. |
| Missing expected CWP-01 filename. | Medium | Equivalent report found. | Owner may require filename-specific trace. | RWO-01. |
| Release gates conflated with merge readiness. | High | Manager docs distinguish them; RWO-09 static/CI evidence is recorded as partial release-readiness progress only. | External checks/secrets, runtime-ready smoke, package refresh, and owner GO/NO-GO still unknown. | RWO-11 final decision remains `not_ready` until evidence exists. |

# Risk Register

RUN_ID: `20260422T134401Z`

| Risk | Severity | Current control | Residual gap | Next work |
|---|---|---|---|---|
| Prescription/order live ORCA registration unverified. | High | Local/static tests and claim boundary. | No live medicalmodv2 evidence. | RWO-03/RWO-04/RWO-06. |
| Full electronic chart fullflow unverified. | High | Fullflow explicitly not claimed. | No integrated browser/live workflow evidence. | RWO-08. |
| Production ORCA readiness accidentally treated as required or claimed. | High | Roadmap now scopes ORCA connectivity to WebORCA / ORCA Trial only. | A separate production plan may be needed later if stakeholders request production ORCA readiness. | RWO-10 records `not_applicable_trial_only`. |
| Browser runtime behavior unverified for Clinical Wave 1. | High | Local tests only. | No browser e2e. | RWO-02-RWO-05. |
| Overclaiming from prior Phase 3 success. | High | Claim boundary limits to `00001` acceptmodv2. | Stakeholders may extrapolate. | RWO-01 owner sign-off. |
| Raw artifact/secret leakage in future live runs. | High | Evidence sanitize policy. | Future live scripts must enforce allowlists. | RWO-06/RWO-09. |
| Missing expected CWP-01 filename. | Medium | Equivalent report found. | Owner may require filename-specific trace. | RWO-01. |
| Release gates conflated with merge readiness. | High | Manager docs distinguish them. | External checks/secrets still unknown. | RWO-09/RWO-11. |

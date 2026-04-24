# RWO-06D subjectivesv2 502 contract investigation

Run ID: `20260424T130326Z`

The active handoff `subjectivesv2-live-trial-post-root-fix-transport-rejected-502-contract-investigation` was handled without a live retry. A second repo-local request-contract defect was found and fixed.

## Result

The remaining post-root-fix HTTP `502` has a new concrete repo-local hypothesis: the wrapper emitted `Insurance_Combination_Number` inside `HealthInsurance_Information`, but the official `subjectivesv2` contract places `Insurance_Combination_Number` directly under `subjectivesmodreq`. `HealthInsurance_Information` is for insurer/person detail fields.

This is different from the prior fixed `subjectivesmodreq` root-name defect. The generated XML shape is now aligned with the official field location, and focused no-live verification passed.

## Evidence

- Summary: `docs/implementation/rwo06d-subjectivesv2-502-contract-investigation-20260424T130326Z/summary.sanitized.json`
- Command log: `docs/implementation/rwo06d-subjectivesv2-502-contract-investigation-20260424T130326Z/command-log.jsonl`
- Dry-run evidence: `docs/implementation/rwo06d-subjectivesv2-502-contract-investigation-20260424T130326Z/wrapper-dry-run/phase4-soap-disease-summary.sanitized.json`
- Official contract reviewed: `https://www.orca.med.or.jp/receipt/tec/api/subjectives.html`

## Checks

| Check | Result |
| --- | --- |
| `mvn -f pom.server-modernized.xml -pl server-modernized -am -Dsurefire.failIfNoSpecifiedTests=false -Dtest=OrcaChartSupportResourceTest test` | pass / 13 tests |
| `npm --prefix web-client test -- phase4SoapDiseaseSafeEvidence.test.ts` | pass / 11 tests |
| `qa-phase4-safe-soap-disease.mjs` dry-run for exact `subjectivesv2` payload | pass / no live ORCA / `notVerified` |

No runtime route check or live Trial ORCA call was run in this investigation pass.

## Misuse Cases Checked

1. Client or payload drift cannot place `Insurance_Combination_Number` in an arbitrary nested location; the server now emits the contract field in the fixed top-level slot.
2. Request_Number `02` / `03` / `04` remains forbidden for this checkpoint.
3. HTTP 200 or `Api_Result` zero alone is still not business success; completion evidence remains required.

## Retry Decision

`retryPermitted=true` for exactly one subsequent live Trial retry, only after rebuilding/recreating the current non-S3 `server-modernized` runtime and proving status-only route readiness. The material changed precondition is `subjectivesv2_request_contract_insurance_combination_number_location_fixed`.

The retry must use the same exact identity:

- workflow: `subjectivesv2`
- ORCA endpoint: `/orca25/subjectivesv2`
- official server route: `/api/orca/official/chart-support/subjectives-mod-v2`
- target: `00001`
- operation: `create`
- Request_Number/class: `01` equivalent / `01`
- payload SHA-256: `9c90a3b0d731bce2b9e1280d01a5c61222bbd97126e3f9fc50aa6135842dc308`

## Claim Boundary

No SOAP `subjectivesv2` Trial business acceptance, `diseasev3` Trial reachability, disease update/delete readiness, Request_Number `02` / `03` / `04`, fullflow, production ORCA readiness, S3/object-storage readiness, broad clinical release readiness, or final release GO is claimed.

Credentials printed/captured: `false`

Raw artifacts captured: `false`

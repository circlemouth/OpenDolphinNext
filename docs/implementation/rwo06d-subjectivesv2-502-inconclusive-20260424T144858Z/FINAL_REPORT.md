# RWO-06D subjectivesv2 502 no-live investigation

Run ID: `20260424T144858Z`

## Result

The active handoff `subjectivesv2-live-trial-post-request-number-fix-transport-rejected-502-investigation` was completed without any live ORCA retry.

No additional repo-local `subjectivesv2` request-contract defect was established safely from sanitized evidence and no-live checks. The current implementation still preserves the prior fixes:

- request root is `subjectivesmodreq`
- `Insurance_Combination_Number` is emitted directly under `subjectivesmodreq`
- body `Request_Number` is not emitted; create is selected by query `class=01`
- route deployment was already proven by the prior authenticated empty-payload `400` validation rejection

The repeated HTTP `502` from RUN_ID `20260424T142513Z` remains classified as `transportRejected`, `businessAccepted=false`, and no SOAP business acceptance is claimed.

## Evidence

- Previous live retry reviewed: `docs/implementation/rwo06d-subjectivesv2-post-request-number-live-retry-20260424T142513Z/summary.sanitized.json`
- Dry-run wrapper evidence: `docs/implementation/rwo06d-subjectivesv2-502-inconclusive-20260424T144858Z/wrapper-dry-run/phase4-soap-disease-summary.sanitized.json`
- Official contract reviewed: `https://www.orca.med.or.jp/receipt/tec/api/subjectives.html`
- Secret/raw-artifact scan: `docs/implementation/rwo06d-subjectivesv2-502-inconclusive-20260424T144858Z/secret-raw-artifact-scan.sanitized.txt`

## Checks

| Check | Result |
| --- | --- |
| Previous sanitized live retry review | 3 unchanged sends, all HTTP `502` / `transportRejected` / `businessAccepted=false`; process error already recorded |
| Official `subjectivesv2` contract review | no new safe repo-local request-shape defect identified after root, insurance field, and Request_Number fixes |
| `mvn -f pom.server-modernized.xml -pl server-modernized -am -Dsurefire.failIfNoSpecifiedTests=false -Dtest=OrcaChartSupportResourceTest,OrcaChartSupportSupportTest test` | pass / 31 tests |
| `npm --prefix web-client test -- phase4SoapDiseaseSafeEvidence.test.ts` | pass / 11 tests |
| exact `subjectivesv2` wrapper dry-run | pass / `notVerified` / no live ORCA |
| secret/raw-artifact scan | pass / zero hits |

## Misuse Cases Checked

1. Live `subjectivesv2` retry was not executed.
2. Request_Number `02` / `03` / `04`, live `diseasev3`, fullflow, production ORCA, and S3/object-storage paths were not executed.
3. HTTP status, wrapper dry-run, and parser success were not promoted to business success.
4. Repeating unchanged live sends remains forbidden; future retry requires a concrete fix or documented changed precondition plus focused no-live verification and a new explicit handoff.

## Classification

The blocker is `inconclusive_transport_or_trial_side_limited_by_sanitized_evidence`. Raw ORCA request/response bodies, raw network captures, container logs that could include bodies, screenshots, HAR, traces, and videos were not captured, so no deeper Trial-side diagnosis is claimed.

## Next Work

Do not run another `subjectivesv2` live retry from the current evidence. Continue to independent non-S3 Trial-backed release-readiness work, especially RWO-09/RWO-11 static/security/package/claim-boundary refreshes. A future `subjectivesv2` retry requires a new concrete repo-local fix or changed precondition.

## Claim Boundary

No SOAP `subjectivesv2` Trial business acceptance, `diseasev3` Trial reachability, disease update/delete readiness, Request_Number `02` / `03` / `04`, fullflow, production ORCA readiness, S3/object-storage readiness, broad clinical release readiness, or final release GO is claimed.

Credentials printed/captured: `false`

Raw artifacts captured: `false`

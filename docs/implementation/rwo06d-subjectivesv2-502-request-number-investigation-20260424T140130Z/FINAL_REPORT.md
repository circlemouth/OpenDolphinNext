# RWO-06D subjectivesv2 502 request-number investigation

Run ID: `20260424T140130Z`

## Result

The active handoff `subjectivesv2-live-trial-post-insurance-field-fix-transport-rejected-502-investigation` was completed without a live ORCA retry.

No-live contract review found a concrete repo-local `subjectivesv2` request XML defect:

- Official ORCA `subjectivesv2` selects create/delete by query string: `POST /orca25/subjectivesv2?class=01`.
- The official request body list starts at `InOut` and does not include `Request_Number`.
- The server wrapper already sends `class=01`, but also emitted `<Request_Number>01</Request_Number>` inside `subjectivesmodreq`.
- The extra XML field was removed.

## Evidence

- Previous live retry reviewed: `docs/implementation/rwo06d-subjectivesv2-post-insurance-field-live-retry-20260424T133658Z/summary.sanitized.json`
- Dry-run wrapper evidence: `docs/implementation/rwo06d-subjectivesv2-502-request-number-investigation-20260424T140130Z/wrapper-dry-run/phase4-soap-disease-summary.sanitized.json`
- Official contract reviewed: `https://www.orca.med.or.jp/receipt/tec/api/subjectives.html`

## Files Changed

- `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaChartSupportSupport.java`
- `server-modernized/src/test/java/open/dolphin/rest/orca/OrcaChartSupportResourceTest.java`
- `docs/implementation/automation-handoff/NEXT_WORKER_PROMPT.md`
- `docs/implementation/automation-handoff/HANDOFF_STATE.json`
- `docs/implementation/rwo06d-subjectivesv2-502-request-number-investigation-20260424T140130Z/summary.sanitized.json`
- `docs/implementation/rwo06d-subjectivesv2-502-request-number-investigation-20260424T140130Z/FINAL_REPORT.md`

## Checks

| Check | Result |
| --- | --- |
| Previous sanitized live retry review | HTTP `502`, `transportRejected`, `businessAccepted=false` |
| Official `subjectivesv2` request contract review | request body has no `Request_Number`; create is `class=01` query |
| `mvn -f pom.server-modernized.xml -pl server-modernized -am -Dsurefire.failIfNoSpecifiedTests=false -Dtest=OrcaChartSupportResourceTest test` | pass / 13 tests |
| `npm --prefix web-client test -- phase4SoapDiseaseSafeEvidence.test.ts` | pass / 11 tests |
| exact `subjectivesv2` wrapper dry-run | pass / `notVerified` / no live ORCA |

## Misuse Cases Checked

1. Live retry was not executed from this investigation prompt.
2. Request_Number `02` / `03` / `04` remains forbidden; create is still constrained to query `class=01` and the approved payload identity.
3. HTTP 200, wrapper dry-run, and parser success remain insufficient for business success.

## Next Handoff

The next worker prompt permits exactly one future `subjectivesv2` Trial retry only after rebuilding/recreating the current non-S3 `server-modernized` runtime with this request XML fix and recording sanitized route/readiness preflight.

## Claim Boundary

No SOAP `subjectivesv2` Trial business acceptance, `diseasev3` Trial reachability, disease update/delete readiness, Request_Number `02` / `03` / `04`, fullflow, production ORCA readiness, S3/object-storage readiness, broad clinical release readiness, or final release GO is claimed.

Credentials printed/captured: `false`

Raw artifacts captured: `false`

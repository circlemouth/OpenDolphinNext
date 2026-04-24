# RWO-06D subjectivesv2 502 investigation

Run ID: `20260424T121609Z`

The active handoff `subjectivesv2-live-trial-post-rebuild-transport-rejected-502-investigation` was handled by investigating before retry. A repo-local request XML contract defect was found and fixed: the `subjectivesv2` mutation request root emitted `subjectivesreq`, but the mutation route uses the `subjectivesmodreq` contract. The fix was rebuilt into the local dev/Trial runtime before any live retry.

## Result

The fix changed a material precondition and passed no-live verification, so one diagnosis-backed live Trial retry was justified. That single post-fix retry still returned sanitized HTTP `502`, classified as `transportRejected`, with `businessAccepted=false`.

No additional identical retry was run.

## Evidence

- Summary: `docs/implementation/rwo06d-subjectivesv2-502-investigation-20260424T121609Z/summary.sanitized.json`
- Command log: `docs/implementation/rwo06d-subjectivesv2-502-investigation-20260424T121609Z/command-log.jsonl`
- Route preflight: `docs/implementation/rwo06d-subjectivesv2-502-investigation-20260424T121609Z/route-preflight-post-fix.sanitized.json`
- Dry-run evidence: `docs/implementation/rwo06d-subjectivesv2-502-investigation-20260424T121609Z/wrapper-dry-run/phase4-soap-disease-summary.sanitized.json`
- Live post-fix attempt evidence: `docs/implementation/rwo06d-subjectivesv2-502-investigation-20260424T121609Z/wrapper-live-post-fix-attempt-1/phase4-soap-disease-summary.sanitized.json`

## Checks

| Check | Result |
| --- | --- |
| `npm --prefix web-client test -- phase4SoapDiseaseSafeEvidence.test.ts` | pass / 11 tests |
| `mvn -f pom.server-modernized.xml -pl server-modernized -am -Dsurefire.failIfNoSpecifiedTests=false -Dtest=OrcaChartSupportResourceTest test` | pass / 13 tests |
| `docker compose build server-modernized-dev` | pass |
| `docker compose up -d server-modernized-dev` | pass |
| health/readiness | `200` / `200` |
| authenticated empty JSON route preflight | expected `400` |
| subjectivesv2 wrapper dry-run | pass / no live ORCA |
| subjectivesv2 live post-fix attempt | HTTP `502`, `transportRejected`, `businessAccepted=false` |

An initial `./mvnw` command was attempted and failed because the repo root has no Maven wrapper. Verification was rerun with the repository's `pom.server-modernized.xml` Maven command and passed.

## Retry Decision

`retryPermitted=false` for the current exact identity until another material precondition changes. The root-name fix was a valid reason for exactly one retry, but the post-fix retry still failed at transport level.

Next work should investigate the remaining request contract and payload semantics without live traffic first, including query/class handling and subjectivesv2 field requirements. Another live retry should happen only after a second concrete fix or sanitized evidence of changed upstream/runtime state.

## Claim Boundary

No SOAP `subjectivesv2` Trial business acceptance, `diseasev3` Trial reachability, disease update/delete readiness, Request_Number `02` / `03` / `04`, fullflow, production ORCA readiness, S3/object-storage readiness, broad clinical release readiness, or final release GO is claimed.

Credentials printed/captured: `false`

Raw artifacts captured: `false`

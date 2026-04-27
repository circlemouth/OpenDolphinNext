# ACCEPTMODV2 Target Inventory Read-only Route

RUN_ID: `20260427T170708Z`

## Result

Implemented a reviewed server-side, facility-scoped, read-only `acceptlstv2` target inventory route:

- Public route: `/api/orca/official/visits/acceptance-list`
- ORCA endpoint: `/api01rv2/acceptlstv2`
- Method: `POST`
- Allowed classes: `01`, `02`, `03`
- Response contract: allowlisted presence flags and row hashes only

No Trial read-only call and no live mutation were executed in this run.

## Security Boundary

The request accepts only `acceptanceDate`, `classCode`, and optional `departmentCode`. It does not accept client-provided `Acceptance_Id`, `Patient_ID`, owner, facility, role, object key, URI, or digest as authoritative input.

The response DTO excludes patient names, insurance numbers, raw ORCA request/response bodies, cookies, sessions, Authorization headers, CSRF values, and credential-bearing URLs. It returns only row hash, required-field presence flags, row counts, class/date metadata, and sanitized contract labels.

## Misuse Cases

| Misuse case | Result |
| --- | --- |
| Unauthenticated caller probes Trial acceptance rows. | Rejected with `remote_user_missing`; facility scope is derived from authenticated remote user. |
| Caller injects target identity such as `Acceptance_Id`, `Patient_ID`, or facility into the request. | Not accepted by the request DTO and not used as authority. |
| Parser or route leaks patient/insurance detail while proving target readiness. | Sanitized DTO contains only booleans and SHA-256 row hash. |

## Checks

| Check | Result |
| --- | --- |
| Server focused tests | PASS: `mvn -f pom.server-modernized.xml -pl api-contract,server-modernized -Dtest='open.dolphin.orca.converter.OrcaXmlMapperTypedTextParsingTest,open.dolphin.orca.service.OrcaLiveGatewaySupportTest,open.dolphin.orca.service.OrcaLiveGatewayReadOnlyContractPayloadTest,open.dolphin.rest.orca.OrcaVisitResourceTest' -Dsurefire.failIfNoSpecifiedTests=false test` |
| Web focused wrapper test | PASS: `npm run test:ci -- scripts/__tests__/phase4Acceptmodv2TargetInventoryEvidence.test.ts` |
| No-live dry-run | PASS: `RUN_ID=20260427T170708Z node scripts/qa-phase4-acceptmodv2-target-inventory.mjs --dry-run --sanitized-evidence-only --disable-browser-artifacts --class 01 --acceptance-date 2026-04-27` |

## Claim Boundary

This run claims only route/action readiness plus focused no-live tests. It does not claim read-only Trial inventory success, server-derived live target proof, RN02/RN03/RN04 live readiness, acceptmodv2 mutation success, fullflow success, production ORCA readiness, S3/object-storage readiness, rollback rehearsal, owner final GO/NO-GO, or final release readiness.

## Next Action

Start the approved non-S3 WebORCA Trial runtime and run sanitized read-only inventory through `/api/orca/official/visits/acceptance-list`. Use the result only to prove or block server-derived target preconditions before any RN02/RN03/RN04 live preflight.

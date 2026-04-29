# RWO-08B Provisional Visit-Context Gate

RUN_ID: `20260429T003500Z`

## Result

Implemented a constrained provisional gate for RWO-08B target readiness.

The existing strict `identifierPreflightReady` behavior remains unchanged: it still requires complete official voucher / sequential / insurance identifier proof from `medicalgetv2` or `visitptlstv2`.

The new `provisionalIdentifierPreflightReady` is separate and can become true only when the server-derived selected `acceptlstv2` target is ready and exactly one `visitptlstv2` row matches the selected acceptance patient, visit date, department, and insurance combination while raw sensitive fields remain excluded. It does not trust patient ID alone, client-provided identifiers, or UI state.

## Changed Files

- `api-contract/src/main/java/open/dolphin/rest/dto/orca/MedicalIdentifierPreflightResponse.java`
- `server-modernized/src/main/java/open/dolphin/orca/service/DefaultOrcaLiveGateway.java`
- `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaVisitResource.java`
- `server-modernized/src/test/java/open/dolphin/orca/service/DefaultOrcaLiveGatewayTest.java`
- `web-client/scripts/qa-lib/rwo08b-target-readiness-evidence.mjs`
- `web-client/scripts/__tests__/rwo08bTargetReadinessEvidence.test.ts`
- `docs/runbooks/release-validation.md`

## Security Boundary

This is a diagnostic-readiness relaxation, not a strict identifier proof. It keeps:

- server-side selected acceptance row as authority;
- `patientId + visitDate + departmentCode + insuranceCombinationNumber` match as the provisional minimum;
- exactly one matching visit-context row;
- fail-closed behavior on multiple/no matching rows;
- raw ORCA bodies, raw patient details, raw insurance details, credentials, HAR, traces, screenshots, videos, and request XML out of committed evidence.

## Non-claims

This does not claim strict identifier proof, diagnostic Fullflow success, Trial order-send business acceptance, production ORCA readiness, S3/object-storage readiness, rollback rehearsal, owner final GO/NO-GO/PENDING, or final release readiness.

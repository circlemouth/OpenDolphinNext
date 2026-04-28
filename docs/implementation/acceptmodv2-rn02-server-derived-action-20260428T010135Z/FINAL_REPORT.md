# ACCEPTMODV2 RN02 Server-Derived Action

RUN_ID: `20260428T010135Z`

## Result

Implemented a no-live safe RN02 server-derived action for future `acceptmodv2 Request_Number=02` Trial execution:

- Route: `/api/orca/official/visits/acceptance-operation`
- Target identity: sanitized `acceptlstv2` target row hash
- Request class: `acceptmodv2_request_02_server_derived_action`
- Live Trial executed: no

## Security Design

The action does not accept client-provided ORCA identifiers such as `Acceptance_Id`, patient ID, department, physician, insurance, owner, URI, digest, or role. It accepts only `requestNumber=02`, `acceptanceDate`, `classCode`, `targetRowHash`, and the exact duplicate-live checkpoint.

Before calling `mutateVisit`, the server re-reads `acceptlstv2`, locates the selected row hash, verifies RN02-ready presence flags, and builds the mutation request from server-resolved internal fields. Those internal fields are `JsonIgnore` and are not exposed in the public inventory response.

## Verification

- `mvn -f pom.server-modernized.xml -pl server-modernized -am -Dtest=OrcaVisitResourceTest,OrcaXmlMapperTypedTextParsingTest -Dsurefire.failIfNoSpecifiedTests=false test`: pass, 33 tests
- RN02 no-live dry-run wrapper with prior precondition summary: pass

## Non-Claims

This is not RN02 live Trial success, RN03/RN04 readiness, fullflow success, production ORCA readiness, S3/object-storage readiness, rollback rehearsal, owner final GO/NO-GO, or final release readiness.

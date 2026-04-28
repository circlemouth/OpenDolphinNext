# RWO-08B Artifact-Free Identifier Preflight

RUN_ID: `20260428T140210Z`

Implemented a no-live, artifact-free identifier preflight path for RWO-08B.

## Scope

- Route: `/api/orca/official/visits/identifier-preflight`
- Read-only ORCA endpoints represented: `/api01rv2/acceptlstv2` and `/api01rv2/medicalgetv2`
- Target identity: server-derived `acceptlstv2` row hash
- Response evidence: presence booleans, row hashes, counts, endpoint/request-class metadata

## Security Boundary

The route does not trust client-provided patient, insurance, acceptance, department, physician, or medical identifiers as authority. It rereads `acceptlstv2`, resolves the selected target row server-side, then builds the `medicalgetv2` read-only request from server-held fields. Public response fields exclude raw patient detail, raw insurance detail, raw ORCA bodies, and server-only identifiers.

## Verification

- `mvn -f pom.server-modernized.xml -pl server-modernized -am -Dtest=OrcaXmlMapperTypedTextParsingTest -Dsurefire.failIfNoSpecifiedTests=false test`
- Result: pass, 8 tests.

## Non-Claims

No live Trial mutation, read-only Trial execution, fullflow success, order-send business acceptance, production ORCA readiness, S3/object-storage readiness, rollback rehearsal, operator acceptance, final owner decision, or final release readiness is claimed.

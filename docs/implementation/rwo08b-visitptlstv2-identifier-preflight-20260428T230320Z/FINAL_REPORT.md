# RWO-08B visitptlstv2 identifier-preflight contract

RUN_ID: `20260428T230320Z`

## Result

`RWO-08B_VISITPTLSTV2_IDENTIFIER_PREFLIGHT_CONTRACT_AND_RUNTIME_RERUN` is partially resolved.

The previous contract blocker is resolved repo-locally: official `visitptlstv2` `Request_Number=01` is now implemented as a sanitized read-only alternative identifier-proof source for RWO-08B.

The live read-only rerun did not complete because the local runtime could not decrypt its existing ORCA connection configuration. Diagnostic Fullflow was not run.

## Official-source decision

Checked official ORCA pages on `2026-04-29`:

- `https://www.orca.med.or.jp/receipt/users/tec/api/visitpatient.html`
- `https://www.orca.med.or.jp/receipt/users/tec/api/medicalinfo.html`
- `https://www.orca.med.or.jp/receipt/users/tec/api/acceptancelst.html`

`visitptlstv2` `Request_Number=01` is a read-only visit-date lookup. Its official response includes patient, department, voucher number, sequential number, and insurance-combination fields. That makes it a safe alternative identifier-proof source only when the row matches the server-selected `acceptlstv2` target.

## Implemented rule

`identifierPreflightReady` now requires:

- a server-derived selected `acceptlstv2` target row; and
- either a ready `medicalgetv2` identifier row, or a ready `visitptlstv2` row.

A `visitptlstv2` row is ready only if it has patient ID, visit date, department code, voucher number, sequential number, insurance-combination number, and matches the selected acceptance patient, date, department, and insurance combination. Client-provided identifiers are still not trusted.

## Verification

- `mvn -f pom.server-modernized.xml -pl server-modernized -am -Dtest=DefaultOrcaLiveGatewayTest,OrcaXmlMapperTypedTextParsingTest -Dsurefire.failIfNoSpecifiedTests=false test`
  - `17` tests passed.
- `cd web-client && npm test -- --run scripts/__tests__/rwo08bTargetReadinessEvidence.test.ts`
  - web guard pretests passed.
  - `10` tests passed.
- Server image build succeeded with the gitignored local runtime env loaded.
- The recreated server runtime started, but readiness remained blocked by local ORCA configuration decryption.

## Runtime blocker

The artifact-free read-only wrapper was run with sanitized evidence mode and no browser artifacts. It failed before usable identifier-preflight evidence could be produced:

- HTTP status: `500`
- classification: `runtime_orca_config_decrypt_blocked_before_identifier_preflight`
- mutation: `false`
- diagnostic Fullflow: not run

The safe next action is to restore or realign the approved local ORCA runtime configuration and its matching local-only encryption key without printing or replacing secret values, then rerun the same read-only target-readiness wrapper.

## Non-claims

This is not diagnostic Fullflow success, Trial order-send business acceptance, production ORCA readiness, S3/object-storage readiness, rollback rehearsal, owner final GO/NO-GO/PENDING, or final release readiness.

Credentials captured: `false`

Diagnostic artifacts captured: `false`

Raw artifacts committed or packaged: `false`

Production ORCA attempted: `false`

S3/object storage used: `false`

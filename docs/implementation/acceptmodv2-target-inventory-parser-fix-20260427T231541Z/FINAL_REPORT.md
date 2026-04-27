# ACCEPTMODV2 Target Inventory Parser Fix

RUN_ID: `20260427T231541Z`

## Result

`server_parser_presence_flags_repaired_readonly_target_ready`

The previous RN01 create-then-inventory evidence showed one sanitized `acceptlstv2` class `01`/`03` row, but the row was not target-ready because `Acceptance_Date` and `Insurance_Combination_Number` presence flags were false.

Official `acceptlstv2` documentation shows `Acceptance_Date` at the response level and `Insurance_Combination_Number` nested under each row's `HealthInsurance_Information`. The server parser was only checking row-level fields for both values.

## Change

- [OrcaXmlMapper.java](/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient/server-modernized/src/main/java/open/dolphin/orca/converter/OrcaXmlMapper.java) now derives `Acceptance_Date` presence from row-level value or response-level `acceptlstres.Acceptance_Date`.
- [OrcaXmlMapper.java](/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient/server-modernized/src/main/java/open/dolphin/orca/converter/OrcaXmlMapper.java) now derives insurance-combination presence from row-level value or nested `HealthInsurance_Information.Insurance_Combination_Number`.
- [OrcaXmlMapperTypedTextParsingTest.java](/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient/server-modernized/src/test/java/open/dolphin/orca/converter/OrcaXmlMapperTypedTextParsingTest.java) covers the official response shape while keeping route evidence presence-only.

## Security Boundary

Misuse cases checked:

- Client-supplied date alone must not authorize RN02/RN03/RN04 mutation.
- Raw patient, insurance, or ORCA body values must not be exposed while deriving presence flags.
- HTTP 2xx or `Api_Result=00` alone must not satisfy target readiness.

## Verification

- `npm run --prefix web-client test:ci -- scripts/__tests__/phase4Acceptmodv2TargetInventoryEvidence.test.ts`: pass, 9 tests.
- `mvn -f pom.server-modernized.xml -pl server-modernized -am -Dtest=OrcaXmlMapperTypedTextParsingTest -Dsurefire.failIfNoSpecifiedTests=false test`: pass, 7 tests.
- `docker compose -f docker-compose.modernized.dev.yml -f docker-compose.override.dev.yml build server-modernized-dev`: pass, values loaded from local ignored runtime env without printing them.
- `docker compose -f docker-compose.modernized.dev.yml -f docker-compose.override.dev.yml up -d server-modernized-dev`: pass.
- Sanitized read-only `acceptlstv2` inventory for `2026-04-28`: class `01` target-ready `1/1`, class `02` target-ready `0/0`, class `03` target-ready `1/1`.

## Next Action

Assemble the RN02/RN03/RN04 duplicate checkpoint and endpoint-specific preflight from the target-ready class `01`/`03` inventory. Do not execute RN02/RN03/RN04 live until that packet is complete.

## Evidence Boundary

Credentials captured: false

Diagnostic artifacts captured: false

Raw artifacts committed or packaged: false

Live ORCA Trial mutation executed: false

Read-only ORCA Trial inventory executed: true

No RN02/RN03/RN04 business success, fullflow success, production ORCA readiness, S3/object-storage readiness, rollback rehearsal, owner final GO/NO-GO, or final release readiness is claimed.

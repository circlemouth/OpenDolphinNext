# RWO-08B medicalgetv2 identifier-preflight blocker investigation

RUN_ID: `20260428T220414Z`

## Scope

- Work order: `RWO-08B`
- Task: `RWO-08B_IDENTIFIER_PREFLIGHT_MEDICALGETV2_BLOCKER_INVESTIGATION`
- Selected non-duplicate target: `00002`
- Acceptance date/class: `2026-04-29` / `01`
- Selected acceptlstv2 row hash: `b3b3d7c1416f047abb6450023e575fa39f53ed1d8f804aef8cf3551d945a5ddb`

## Misuse Cases Checked

- Do not treat the target-ready `acceptlstv2` row as medicalgetv2 or order-send readiness.
- Do not reuse duplicate-blocked `00001` or `00005`.
- Do not treat HTTP 200, read-only discovery, dry-run, wrapper exit, or identifier-preflight metadata as Fullflow L4 success.
- Do not capture or commit raw ORCA bodies, credentials, patient details, insurance details, HAR, trace, video, screenshot, or raw network dumps.

## Official Source Evidence

- Source checked: `https://www.orca.med.or.jp/receipt/users/tec/api/medicalinfo.html`
- Checked date: `2026-04-29`
- Relevant endpoint: `/api01rv2/medicalgetv2`
- No-live conclusion: class `01` is a read-only medical information/history lookup and requires body-level `Request_Number`; class `01` should be probed as a history lookup before diagnostic Fullflow retry.

## Changes

- `server-modernized/src/main/java/open/dolphin/orca/service/OrcaLiveGatewaySupport.java`
  - Added body-level `Request_Number` to the server-generated medicalgetv2 identifier payload.
  - Added outpatient `InOut=O` and `For_Months=1`.
  - For class `01`, stopped sending the detail `Medical_Information` filter because class `01` is the history lookup path.
  - Preserved server-side authority: patient/date/department/insurance inputs still come from the selected sanitized `acceptlstv2` row, not client-provided identifiers.
- `server-modernized/src/test/java/open/dolphin/orca/service/OrcaLiveGatewaySupportTest.java`
  - Fixed class `01` payload shape and non-history detail-filter behavior.
- `web-client/scripts/qa-lib/rwo08b-target-readiness-evidence.mjs`
  - Added allowlisted `apiResult` and `apiResultClass` to sanitized identifier-preflight evidence.
- `web-client/scripts/__tests__/rwo08bTargetReadinessEvidence.test.ts`
  - Fixed that nonzero `apiResult` is recorded without raw ORCA messages.

## Result

The blocker is narrowed but not fully cleared.

After the repo-local payload fix and rebuilt `server-modernized-dev`, the read-only wrapper reached `/api01rv2/medicalgetv2` successfully at HTTP transport level. The sanitized result remains `identifier_preflight_target_blocked`:

- `transportStatusClass`: `2xx`
- `apiResult`: `15`
- `apiResultClass`: `nonzero`
- `medicalSourceRowCount`: `1`
- `medicalSanitizedRowCount`: `1`
- `medicalReadyRowCount`: `0`
- `identifierPreflightReady`: `false`

The only sanitized class `01` row has `hasPerformDate=true` but lacks `Department_Code`, `Sequential_Number`, and `Insurance_Combination_Number`. A class `03` read-only probe also did not produce ready rows.

## Evidence

- Main read-only evidence: `docs/implementation/rwo08b-fullflow-l4-medicalgetv2-20260428T220414Z/summary.sanitized.json`
- Class `03` probe: `docs/implementation/rwo08b-fullflow-l4-medicalgetv2-20260428T220414Z/class03-probe/summary.sanitized.json`

## Checks

- `mvn -f pom.server-modernized.xml -pl server-modernized -am -Dtest=OrcaLiveGatewaySupportTest,DefaultOrcaLiveGatewayTest,OrcaXmlMapperTypedTextParsingTest -Dsurefire.failIfNoSpecifiedTests=false test`
  - Passed: 28 tests.
- `cd web-client && npm test -- --run scripts/__tests__/rwo08bTargetReadinessEvidence.test.ts`
  - Passed: 9 tests.
- `docker compose -f docker-compose.modernized.dev.yml -f docker-compose.override.dev.yml build server-modernized-dev`
  - Passed.
- `docker compose -f docker-compose.modernized.dev.yml -f docker-compose.override.dev.yml up -d --force-recreate server-modernized-dev`
  - Passed; container health returned `healthy`.
- `node web-client/scripts/qa-rwo08b-target-readiness.mjs --execute-readonly --sanitized-evidence-only --disable-browser-artifacts ...`
  - Executed read-only only; result remains `identifier_preflight_target_blocked`.

## Claim Boundary

This is RWO-08B target-readiness blocker evidence only. It is not diagnostic Fullflow success, Trial order-send business acceptance, production ORCA readiness, S3/object-storage readiness, rollback rehearsal, owner final GO/NO-GO/PENDING, or final release readiness.

`credentialsCaptured=false`, `diagnosticArtifactsCaptured=false`, `rawArtifactsCommittedOrPackaged=false`, `productionOrcaAttempted=false`, `s3ObjectStorageUsed=false`.

## Next Safe Action

Do not run diagnostic Fullflow yet. The next safe action is to decide whether the identifier-preflight readiness contract can combine the server-derived `acceptlstv2` department/insurance metadata with the class `01` medicalgetv2 history row, or whether a different official read-only endpoint is required to prove `Sequential_Number` / order-send identifiers without raw artifacts.

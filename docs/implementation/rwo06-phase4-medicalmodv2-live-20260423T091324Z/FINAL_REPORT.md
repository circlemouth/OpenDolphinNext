# RWO-06 Phase4 medicalmodv2 Live Trial Investigation Report

RUN_ID: `20260423T100216Z`

## Result

`RWO06_PHASE4_MEDICALMODV2_EXECUTED_ONCE_NOT_ACCEPTED_INVESTIGATION_REQUIRED`

The active RWO-06 handoff's single approved Phase4 `medicalmodv2` WebORCA Trial action was already executed under RUN_ID `20260423T091324Z`. It must not be repeated under that handoff.

Sanitized wrapper classification:

- endpoint: `POST /api/orca/official/chart-support/medical-mod-v2`
- request class: `medicalmodv2`
- target: `00001 / 00001`
- payload SHA-256: `e0f34fa28177155bf19cc0476863bf540f8b1ff4d844ddf189b88ab327645618`
- live Trial action: `executed_once`
- verdict: `live_trial_not_accepted`
- HTTP status observed by wrapper: `500`
- response classification: `transportRejected`
- business accepted: `false`
- completion evidence present: `false`

## Investigation Findings

The local backend was reachable for liveness but not ready:

- `GET /openDolphin/api/health`: HTTP `200`
- `GET /openDolphin/api/health/readiness`: HTTP `503`
- sanitized readiness: database `UP`, ORCA `DOWN` with `orca_probe_failed`, attachment storage `DISABLED` with `attachment_storage_disabled`
- Docker status: PostgreSQL `healthy`, `server-modernized-dev` running but Docker health `unhealthy`
- container-to-WebORCA base reachability without body capture: HTTP `200`

Current evidence points to a runtime/readiness and ORCA transport classification problem before business success can be established. The wrapper did not capture raw response bodies, patient details, insurance details, HAR, traces, screenshots, videos, request XML, or raw network dumps.

Two concrete follow-up risks were identified:

1. The object-storage-free Trial profile leaves `attachmentStorage.status=DISABLED`, but current readiness aggregation treats disabled attachment storage as not ready. That keeps the container healthcheck unhealthy even though this profile intentionally disables storage for non-S3 Trial verification.
2. The Phase4 endpoint returned an HTTP `500` to the wrapper for an ORCA transport failure path. Existing exception mappers are intended to map ORCA gateway failures to sanitized `502` or `503`, so the exact route/runtime failure path needs no-live reproduction or focused tests before any further Trial mutation.

## Safety Incident

During this investigation, one local command accidentally printed ORCA Trial Basic values from ignored generated runtime config to terminal output. The values were not added to tracked files, evidence artifacts, docs, package outputs, or automation memory. No additional live Trial action was sent after this incident.

- credentials printed or captured in this investigation run: `true`
- raw ORCA request/response bodies captured: `false`
- raw patient or insurance details captured: `false`
- forbidden browser/network artifacts captured: `false`

## Misuse Cases Checked

| Misuse case | Result |
|---|---|
| Re-running the single approved live `medicalmodv2` action after a non-accepted result | Blocked by updating the next handoff to no-live investigation only. |
| Treating HTTP `500` or wrapper exit status as business success | Rejected; business success remains `false` because endpoint-specific completion evidence is absent. |
| Claiming S3/object-storage readiness from disabled profile behavior | Rejected; disabled storage remains a non-claim and must fail closed. |
| Using raw logs or raw network artifacts to diagnose the 500 | Not used. Investigation stayed with sanitized summaries, status-only probes, and static code inspection. |

## Evidence

- live wrapper summary: [phase4-medicalmodv2-summary.sanitized.json](/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient/docs/implementation/rwo06-phase4-medicalmodv2-live-20260423T091324Z/live-wrapper/phase4-medicalmodv2-summary.sanitized.json)
- live wrapper markdown: [phase4-medicalmodv2-summary.sanitized.md](/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient/docs/implementation/rwo06-phase4-medicalmodv2-live-20260423T091324Z/live-wrapper/phase4-medicalmodv2-summary.sanitized.md)
- approved payload dry-run summary: [phase4-medicalmodv2-summary.sanitized.json](/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient/docs/implementation/rwo06-phase4-medicalmodv2-live-20260423T091324Z/wrapper-dry-run-approved-payload/phase4-medicalmodv2-summary.sanitized.json)

## Verification

- `jq empty docs/implementation/automation-handoff/HANDOFF_STATE.json`: PASS
- `git diff --check`: PASS
- `bash -n setup-modernized-env.sh`: PASS
- `node --check web-client/scripts/qa-phase4-safe-medicalmodv2.mjs`: PASS
- `node --check web-client/scripts/qa-lib/phase4-medicalmodv2-safe-evidence.mjs`: PASS
- `npm test --prefix web-client -- --run scripts/__tests__/phase4Medicalmodv2SafeEvidence.test.ts`: PASS, 1 file / 6 tests
- `mvn -f pom.server-modernized.xml -pl server-modernized -am -Dsurefire.failIfNoSpecifiedTests=false -Dtest=OrcaGatewayExceptionMapperTest,OperationsHealthResourceTest,OrcaChartSupportSupportTest test`: PASS, 29 tests
- `bash server-modernized/tools/ci/check-doc-links.sh`: PASS
- `bash server-modernized/tools/ci/check-config-contract.sh`: PASS

## Claim Boundary

Allowed claim: one approved Phase4 `medicalmodv2` WebORCA Trial action was executed through the safe wrapper and classified as not business accepted.

Not claimed: live Trial `medicalmodv2` success, ORCA business acceptance, fullflow success, production ORCA readiness, S3/object-storage readiness, attachment/PHR storage readiness, or final release readiness.

## Recommended Next Action

Do not send another Phase4 `medicalmodv2` live mutation until a no-live investigation closes the readiness/transport path. The next worker should add or run focused local tests around non-S3 readiness aggregation and ORCA gateway exception mapping for `OrcaChartSupportResource.medicalModV2`, then update the gate matrix before any new owner-approved live attempt is considered.

# RWO-06 Phase4 medicalmodv2 No-Live Repair Report

RUN_ID: `20260423T110051Z`

## Result

`RWO06_PHASE4_MEDICALMODV2_NO_LIVE_REPAIR_COMPLETE`

No additional WebORCA Trial `medicalmodv2` mutation was sent in this run. The prior one-shot live attempt remains RUN_ID `20260423T091324Z` and remains `live_trial_not_accepted` / `transportRejected` / `businessAccepted=false`.

## Root Cause Findings And Fixes

1. `attachment.storage.mode=disabled` was being treated as readiness-blocking even in the explicit non-S3 Trial profile. The evaluator now keeps the `attachmentStorage` check as `DISABLED` with reason `attachment_storage_disabled`, but does not fail overall readiness solely for that disabled check when storage-dependent features are disabled.
2. The storage non-claim remains fail-closed: if patient image storage is enabled while attachment storage is disabled, readiness still returns `DOWN` with `patient_images_storage_unavailable`.
3. ORCA transport/config failures that escape route code now map to sanitized gateway envelopes instead of ambiguous internal failures. `OrcaConnectionPolicyException` maps to HTTP `503` with `orca_gateway_error`; wrapped `OrcaGatewayException` maps to sanitized `502`/`503`.
4. ORCA gateway/config 5xx logging no longer writes the exception stack from those gateway failures, preventing raw target material embedded in exception messages from reaching command logs.

## Misuse Cases Checked

| Misuse case | Result |
|---|---|
| Re-running the consumed one-shot `medicalmodv2` live mutation during repair | Not run. |
| Claiming storage readiness from disabled attachment storage | Rejected; check remains `DISABLED`, and storage readiness remains a non-claim. |
| Enabling patient images while storage is disabled | Fails closed with readiness `DOWN`. |
| Leaking ORCA target URL/userinfo from wrapped gateway exception messages | Blocked by response sanitization and stack logging suppression. |

## Verification

- `mvn -f pom.server-modernized.xml -pl server-modernized -am -Dsurefire.failIfNoSpecifiedTests=false -Dtest=OperationsHealthResourceTest,RestExceptionMapperTest,OrcaGatewayExceptionMapperTest,OrcaChartSupportResourceTest test`: PASS, 23 tests.

The verification was no-live and did not capture raw ORCA request/response bodies, patient details, insurance details, HAR, traces, screenshots, videos, request XML, raw network dumps, production ORCA evidence, or S3/object-storage evidence.

## Claim Boundary

Allowed claim: no-live repo-local readiness aggregation and ORCA gateway error mapping repair is implemented and focused-test verified.

Not claimed: live Trial `medicalmodv2` business acceptance, another approved live attempt, production ORCA readiness, S3/object-storage readiness, attachment/PHR storage readiness, fullflow success, or final release readiness.

## Recommended Next Action

Proceed to independent non-live roadmap work, or require fresh explicit owner approval before any future `medicalmodv2` live mutation.

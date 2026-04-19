# acceptmodv2 sanitized summary artifact contract

This folder records the package-facing dynamic evidence contract for `qa-acceptmodv2-weborca.mjs`.

## Artifact

- Runtime path: `artifacts/orca-remediation/closeout/<RUN_ID>/qa/acceptmodv2/accept-summary.sanitized.json`
- Packet path: `closeout-packet/qa/acceptmodv2/accept-summary.sanitized.json`
- The reviewer packet script treats the sanitized summary as required closeout evidence.

## Required fields

- `runId`
- `candidateId`
- `preflight.path`
- `preflight.sha256`
- `command`
- `cwd`
- `startTime`
- `endTime`
- `exitCode`
- `httpStatus`
- `apiResult`
- `sanitizedMessage`
- `responseClassification`
- `business.businessAccepted`
- `business.businessRejected`
- `business.c7GateObserved`
- `rejectionReason`
- `acceptanceIdPresent`
- `patientIdMatched`
- `c7.targetMutationRequestCount`
- `c7.checkedRequests`
- `c7.violationCount`
- `c7.violatedKeys`
- `c7.bodyKeysObserved`
- `c7.medicalInformationFieldPresent`
- `c7.unspecifiedRun`
- `secretScanScope`
- `rawSensitiveFieldsExcluded`

## Sanitization rules

- Raw request and response body dumps are not package evidence.
- Saved network artifacts keep method/status/header names and JSON keys, but body values are redacted.
- Secret-bearing headers and URL query values are redacted.
- Business acceptance and C7 acceptance are separate: a live business reject can still record `business.c7GateObserved=true`.

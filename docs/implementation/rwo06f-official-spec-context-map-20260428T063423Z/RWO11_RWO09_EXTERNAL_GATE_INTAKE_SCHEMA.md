# RWO-11/RWO-09 External Gate Intake Schema

RUN_ID: `20260428T063423Z`

## Classification

`RWO-11/RWO-09` remains an `external_owner_operator_release_management_gate`.

Automation may record sanitized external evidence, but must not execute rollback rehearsal, release-candidate deployment stop, paired restore, restored-target smoke, operator acceptance, or final owner GO/NO-GO/PENDING generation.

## Gate Closure Rule

`closed_go` is valid only when all of the following sanitized external evidence exists:

- rollback rehearsal result: `pass`
- release-candidate stop / paired restore / restored-target smoke result: `pass`
- operator acceptance: `accepted` or `GO`
- final owner decision: explicit `GO`
- `automationExecuted=false`
- `forbiddenEvidenceAbsent=true`

`NO-GO` may be recorded as `closed_no_go`, but it is not release-approved. `PENDING` remains `pending_external_evidence`.

## Acceptable Sanitized Evidence Classes

| Evidence class | Required external actor | Automation may record | Automation must not execute |
|---|---|---|---|
| `rollback_rehearsal` | release operator plus owner/reviewer | candidate/restore identity, pass/fail/blocked/pending, actor attestations, forbidden-evidence absence | rollback rehearsal, restore, environment stop/start, raw artifact review |
| `release_candidate_stop_restore_smoke` | release operator plus smoke reviewer | stop/restore/smoke status and sanitized check IDs | stop, restore, smoke, runtime operation |
| `operator_acceptance` | release operator / operational owner | explicit acceptance status, reviewed evidence IDs, non-claim acknowledgement | infer operator acceptance from tests |
| `final_owner_decision` | final release owner | explicit GO/NO-GO/PENDING text and reviewed evidence IDs | infer or generate owner decision |
| `claim_boundary` | release owner | Trial-only allowed/non-claim boundaries | promote Trial-only evidence to production readiness |
| `automation_reassignment` | release owner, plus platform/security owner if scope changes | exact reassignment scope and still-forbidden actions | execute ambiguous reassignment |

## Common Sanitized JSON Shape

```json
{
  "schemaVersion": "opendolphinnext.releaseExternalGate.sanitized.v1",
  "gateName": "RWO-11_RWO-09_EXTERNAL_GATE",
  "workOrders": ["RWO-11", "RWO-09"],
  "evidenceClass": "rollback_rehearsal",
  "status": "pass",
  "releaseCandidate": {
    "label": "rc-<sanitized-label>",
    "commit": "<git-sha>",
    "artifactDigest": "sha256:<digest>"
  },
  "externalActors": [
    {
      "role": "release_operator",
      "attestedAt": "YYYY-MM-DDTHH:mm:ssZ",
      "attestation": "I performed this external gate outside automation and submitted sanitized evidence only."
    }
  ],
  "safety": {
    "automationExecuted": false,
    "credentialsIncluded": false,
    "tokensCookiesAuthorizationIncluded": false,
    "patientDataIncluded": false,
    "insuranceDetailIncluded": false,
    "rawOrcaBodyIncluded": false,
    "harTraceScreenshotVideoIncluded": false,
    "rawNetworkDumpIncluded": false,
    "s3ObjectStorageSecretIncluded": false,
    "productionDataIncluded": false,
    "forbiddenEvidenceAbsent": true
  },
  "automationRecordPolicy": {
    "mayRecord": true,
    "mayCloseGate": false,
    "reasonGateNotClosed": "final owner GO missing"
  },
  "nonClaims": [
    "No production ORCA readiness is claimed.",
    "No S3/object-storage readiness is claimed.",
    "No final release readiness is inferred from Trial-only evidence."
  ]
}
```

## Forbidden Evidence

Automation must reject or stop before processing evidence that contains credentials, tokens, cookies, Authorization headers, CSRF/session values, patient data, insurance details, raw ORCA request/response XML/JSON, HAR, traces, screenshots, videos, raw network dumps, production config dumps, S3/object-storage credentials, bucket/key/path proof, or raw deployment logs with secrets.

## Decision Templates

### Final GO

```text
Decision: GO
Gate: RWO-11/RWO-09 external release-management gate
Release candidate: <sanitized label / commit / artifact digest>

I, <owner role/name-or-id>, approve closing the RWO-11/RWO-09 external
release-management gate for this release candidate.

I base this decision only on the following sanitized evidence:
- rollback rehearsal evidence: <id>
- release-candidate stop / restore / smoke evidence: <id>
- operator acceptance evidence: <id>
- RWO-09 non-S3 static/package/security evidence: <id>

I acknowledge that production ORCA readiness, production credentials handling,
S3/object-storage readiness, raw artifact capture, and broad endpoint/fullflow
coverage are not claimed unless separately recorded.

Signed/attested by: <owner role/name-or-id>
Timestamp: <ISO-8601>
```

### NO-GO

```text
Decision: NO-GO
Gate: RWO-11/RWO-09 external release-management gate
Release candidate: <sanitized label / commit / artifact digest>

Blocking reasons:
- <sanitized blocker id / reason>

Automation may record this as closed_no_go.
Automation must not treat this as release-approved.

Signed/attested by: <owner role/name-or-id>
Timestamp: <ISO-8601>
```

### PENDING

```text
Decision: PENDING
Gate: RWO-11/RWO-09 external release-management gate
Release candidate: <sanitized label / commit / artifact digest>

Missing external evidence:
- <rollback/operator/restore/smoke/evidence id>

Automation may record this as pending_external_evidence.
Automation must not close the release gate.

Signed/attested by: <owner role/name-or-id>
Timestamp: <ISO-8601>
```

## Claim Boundary

This schema is for sanitized external evidence intake only. It is not a rollback rehearsal, not operator acceptance, not final owner GO/NO-GO/PENDING, not production ORCA readiness, not S3/object-storage readiness, and not final release readiness.

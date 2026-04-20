# Phase 3 sanitized evidence contract

## Allowed evidence
- `phase3-approved-command.sanitized.json`
- `accept-summary.sanitized.json`
- `accept-summary.sanitized.md`
- `steps.log` containing sanitized step labels only
- Test logs, sanitized secret scan logs, manifests, and SHA-256 ledgers

## Prohibited evidence
- Raw ORCA request body
- Raw ORCA response body
- Raw patient detail
- Raw insurance detail
- HAR
- trace
- video
- screenshot
- raw network dump
- browser visual capture artifact
- credential-bearing URL
- Cookie, Authorization, JSESSIONID, CSRF, raw session, raw password

## Required fields
```json
{
  "schemaVersion": 1,
  "commandContract": "approved-phase3-acceptmodv2-sanitized-only",
  "mutation": "not_run",
  "phase3": "not_run",
  "phase4": "not_run",
  "fullflow": "not_run",
  "candidate": "00001",
  "otherCandidatesMutation": "not_run",
  "allowedMutationAttemptCount": 0,
  "forbiddenMutationRequestCount": 0,
  "intendedMutationRequestNumber": "01",
  "browserNetworkArtifactMode": "disabled",
  "sanitizedEvidenceOnly": true,
  "rawSensitiveFieldsExcluded": true
}
```

For a future actual Phase 3 run, `allowedMutationAttemptCount` may become `1` only inside the approved wrapper's `--execute-approved-mutation` mode. Phase 4 and fullflow remain `not_run`.


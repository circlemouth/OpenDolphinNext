# RWO-06K Radiology V2 Live Trial Checkpoint

RUN_ID: `20260425T001701Z`

## Result

`RADIOLOGY_V2_LIVE_TRIAL_BUSINESS_REJECTED`

The active automation handoff was already `completed`, so this run continued the roadmap queue by executing the prepared `radiologyOrder` / Claim007 class `700` v2 endpoint-specific checkpoint exactly once.

## Endpoint Identity

| Field | Value |
|---|---|
| Official server route | `POST /api/orca/official/chart-support/medical-mod-v2` |
| ORCA request class | `medicalmodv2` |
| Workflow | `radiology` |
| Entity | `radiologyOrder` |
| Target | `00001` |
| Request_Number | `01` |
| Class_Code | `01` |
| Claim007 class | `700` |
| Candidate code | `002000099` body part + `170027910` imaging fee |
| Payload SHA-256 | `ba41ca8d029b362d197361def1653a334ea27032935a6979298548465df4d436` |
| Duplicate-live checkpoint | `rwo06k:medicalmodv2:rwo06k-radiology-medicalmodv2-v1:target-00001:request-01:class-01:payload-sha256-ba41ca8d029b362d197361def1653a334ea27032935a6979298548465df4d436` |

## Sanitized Live Result

| Field | Value |
|---|---|
| Runtime health / readiness | `200` / `200` |
| Duplicate checkpoint status before live | `not_found` |
| Live Trial action | `executed_once` |
| HTTP status | `200` |
| Parsed API result | `80` |
| Response classification | `businessRejected` |
| Business accepted | `false` |
| Completion evidence | timestamp present; medical UID / invoice / data id absent |

HTTP `200` and wrapper execution are not treated as business success. The endpoint-specific business-success classification is `businessRejected`.

## Misuse Cases Checked

| Misuse case | Control / result |
|---|---|
| Repeating the rejected `radiologyOrder/700` v1 identity | Rejected: this run used the distinct v2 payload SHA `ba41ca...d436`; v1 was not sent. |
| Treating HTTP `200` or wrapper exit behavior as success | Rejected: parsed API result `80` plus missing completion evidence classified the attempt as `businessRejected`. |
| Expanding update/delete/cancel semantics through this wrapper | Rejected: the wrapper remains Request_Number `01` only and blocks `02` / `03` / `04`. |

## Verification

| Check | Result |
|---|---|
| `node --check` for wrapper and safe-evidence library | pass |
| `npm run --prefix web-client test -- --run scripts/__tests__/phase4Medicalmodv2SafeEvidence.test.ts` | pass / 19 tests |
| `qa-phase4-safe-medicalmodv2.mjs --dry-run --workflow radiology ...` | pass / no live ORCA |
| `qa-phase4-safe-medicalmodv2.mjs --execute-approved-phase4 --workflow radiology ...` | executed once / `businessRejected` |
| Forbidden artifact file scan for this evidence directory | pass / zero hits |
| Focused secret/raw-artifact text scan for this evidence directory | pass / zero hits |
| `git diff --check` | pass |

## Evidence

- [summary.sanitized.json](summary.sanitized.json)
- [wrapper-dry-run/phase4-medicalmodv2-summary.sanitized.json](wrapper-dry-run/phase4-medicalmodv2-summary.sanitized.json)
- [wrapper-live-attempt-1/phase4-medicalmodv2-summary.sanitized.json](wrapper-live-attempt-1/phase4-medicalmodv2-summary.sanitized.json)
- [command-log.jsonl](command-log.jsonl)
- [secret-scan.sanitized.txt](secret-scan.sanitized.txt)
- [forbidden-artifact-scan.sanitized.txt](forbidden-artifact-scan.sanitized.txt)

## Claim Boundary

This run does not claim radiology Trial acceptance, all-radiology coverage, body-part billing success, `diseasev3` acceptance, `subjectivesv2` acceptance, Request_Number `02` / `03` / `04`, fullflow readiness, production ORCA readiness, S3/object-storage readiness, broad clinical release readiness, or final release GO.

Credentials captured: `false`

Diagnostic artifacts captured: `false`

Raw artifacts committed or packaged: `false`

## Next Step

Do not repeat this v2 checkpoint unchanged. Investigate API result `80` no-live first, then retry only after a concrete repo-local fix or changed Trial/business precondition plus focused no-live verification and sanitized preflight. If no concrete fix exists, continue independent roadmap work such as diagnostic fullflow inventory.

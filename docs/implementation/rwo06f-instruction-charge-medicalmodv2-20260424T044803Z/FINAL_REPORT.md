# RWO-06F Instruction-Charge medicalmodv2 Trial Reachability

RUN_ID: `20260424T044803Z`

## Scope

This run handled the highest-priority order-item gap from the exhaustive matrix: `instractionChargeOrder` / `指導料` / Claim007 class `130`.

No production ORCA, S3/MinIO/object-storage, fullflow, diseasev3, subjectivesv2, Request_Number `02` / `03` / `04`, browser screenshots, HAR, traces, videos, raw network dumps, raw ORCA bodies, or raw patient/insurance detail were used.

## Result

`instractionChargeOrder/130` is now covered by the safe wrapper contract and no-live tests, but the first representative Trial candidate was not accepted by ORCA Trial.

| Item | Classification |
|---|---|
| Workflow | `instruction-charge` |
| Payload identity | `medicalmodv2_instruction_charge_trial_reachability_v1.json` |
| Entity | `instractionChargeOrder` |
| Claim007 class | `130` |
| Request_Number | `01` only |
| API class | `01` only |
| Payload SHA-256 | `8b9ec7db74971f7c567945c75bee7ad1fa3cbbaba97c2f8a689c2a1f0c9af64e` |
| Duplicate-live checkpoint | `rwo06f:medicalmodv2:rwo06f-instruction-charge-medicalmodv2-v1:target-00001:request-01:class-01:payload-sha256-8b9ec7db74971f7c567945c75bee7ad1fa3cbbaba97c2f8a689c2a1f0c9af64e` |
| No-live dry-run | passed |
| Runtime readiness before live | health HTTP `200`, readiness HTTP `200` |
| Live Trial action | executed once |
| Live business classification | `businessRejected` |
| Business accepted | `false` |

## Sanitized Evidence

- Dry-run summary: `artifacts/orca-remediation/closeout/20260424T044803Z/qa/phase4-safe-medicalmodv2-instruction-charge/phase4-medicalmodv2-summary.sanitized.json`
- Live summary: `artifacts/orca-remediation/closeout/20260424T044803Z/qa/phase4-safe-medicalmodv2-instruction-charge-live/phase4-medicalmodv2-summary.sanitized.json`
- Run summary: `docs/implementation/rwo06f-instruction-charge-medicalmodv2-20260424T044803Z/summary.sanitized.json`

## Misuse Cases Checked

| Misuse case | Control |
|---|---|
| Treating `指導料` as covered by prior prescription/treatment acceptance. | Added a separate `instruction-charge` workflow requiring `instractionChargeOrder` and class `130`. |
| Running Request_Number `02` / `03` / `04` during order-item expansion. | Existing Phase 4 guard still rejects every request number except `01`. |
| Repeating already accepted prescription or treatment checkpoints. | New duplicate checkpoint uses the RWO-06F namespace and a distinct payload hash. |
| Claiming HTTP `200` as success. | The parser requires endpoint-specific completion evidence and classified the live result as `businessRejected`, not success. |
| Capturing raw ORCA or credential artifacts to diagnose rejection. | Only status codes, allowlisted classifications, hashes, and sanitized categories were recorded. |

## Blocker

The v1 class `130` representative candidate produced HTTP `200` with a sanitized ORCA business rejection classification. Repo-local XML construction tests already cover base and instruction charge serialization, and the wrapper proved that the entity/class/request constraints are correct before live execution.

The remaining gap is therefore not closed by repeating the same payload. The next safe step is to create a v2 `instractionChargeOrder/130` candidate only after sanitized no-live investigation identifies a different Trial-valid billing item or encounter prerequisite. If that cannot be established without raw ORCA response bodies or a human business decision, keep the row blocked and continue with the next independent order family.

## Claim Boundary

This run does not claim `指導料` Trial acceptance, all guidance-fee variants, all order items, production ORCA readiness, S3/object-storage readiness, or final release readiness. It only establishes a safe wrapper/payload route and records one sanitized negative Trial result for `instractionChargeOrder/130` candidate v1.

Credentials captured: `false`

Raw artifacts captured: `false`

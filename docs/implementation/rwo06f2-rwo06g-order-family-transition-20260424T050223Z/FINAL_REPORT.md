# RWO-06F2 / RWO-06G Order Family Transition

RUN_ID: `20260424T050223Z`

## Scope

This run followed the active RWO-06F2 handoff for `instractionChargeOrder` / `指導料` / Claim007 class `130`, then queued, no-live verified, and executed one sanitized Trial attempt for the next independent matrix row: `baseChargeOrder` / `基本診療料` / Claim007 class `110`.

No production ORCA, S3/MinIO/object-storage, fullflow, diseasev3, subjectivesv2, Request_Number `02` / `03` / `04`, browser screenshots, HAR, traces, videos, raw network dumps, raw ORCA bodies, raw patient/insurance detail, or legacy `client/` / `server/` changes were used.

## RWO-06F2 Result

`instractionChargeOrder/130` remains blocked pending business or Trial data decision.

The v1 payload identity from RUN_ID `20260424T044803Z` is explicitly not repeated. Repo-local evidence contains the rejected v1 item `112007410` and test-only class `130` fixtures, but it does not prove a different Trial-valid class `130` billing item or encounter prerequisite without raw ORCA response bodies or a human billing decision. A v2 live attempt was therefore not created.

| Item | Classification |
|---|---|
| Work Order | `RWO-06F2` |
| Entity | `instractionChargeOrder` |
| Claim007 class | `130` |
| Prior v1 duplicate checkpoint | `rwo06f:medicalmodv2:rwo06f-instruction-charge-medicalmodv2-v1:target-00001:request-01:class-01:payload-sha256-8b9ec7db74971f7c567945c75bee7ad1fa3cbbaba97c2f8a689c2a1f0c9af64e` |
| v1 live classification | `businessRejected` |
| v2 candidate | `not_created_no_sanitized_justification` |
| Current status | `pending_business_or_trial_data_decision` |

## RWO-06G Result

The next independent non-S3 order family reached one sanitized live Trial classification, but it was not accepted by ORCA Trial.

| Item | Classification |
|---|---|
| Work Order | `RWO-06G` |
| Workflow | `base-charge` |
| Payload identity | `medicalmodv2_base_charge_trial_reachability_v1.json` |
| Entity | `baseChargeOrder` |
| Claim007 class | `110` |
| Request_Number | `01` only |
| API class | `01` only |
| Payload SHA-256 | `d2db1ff2ad68174bcb236498786c87a8fffa0879917712c7ca639aa2732b9d93` |
| Duplicate-live checkpoint | `rwo06g:medicalmodv2:rwo06g-base-charge-medicalmodv2-v1:target-00001:request-01:class-01:payload-sha256-d2db1ff2ad68174bcb236498786c87a8fffa0879917712c7ca639aa2732b9d93` |
| No-live unit test | passed |
| Wrapper dry-run | passed |
| Runtime readiness before live | health HTTP `200`, readiness HTTP `200` |
| Live Trial action | executed once |
| Live business classification | `businessRejected` |
| Business accepted | `false` |

## Sanitized Evidence

- Base-charge dry-run summary: `artifacts/orca-remediation/closeout/20260424T050223Z/qa/phase4-safe-medicalmodv2-base-charge/phase4-medicalmodv2-summary.sanitized.json`
- Base-charge live summary: `artifacts/orca-remediation/closeout/20260424T050223Z/qa/phase4-safe-medicalmodv2-base-charge-live/phase4-medicalmodv2-summary.sanitized.json`
- Run summary: `docs/implementation/rwo06f2-rwo06g-order-family-transition-20260424T050223Z/summary.sanitized.json`

## Misuse Cases Checked

| Misuse case | Control |
|---|---|
| Repeating the rejected `指導料` v1 live checkpoint. | RWO-06F2 explicitly records `do_not_repeat`; no v2 payload was created without sanitized justification. |
| Treating test-only class `130` fixtures as Trial-valid billing evidence. | RWO-06F2 remains blocked pending business/Trial data decision instead of inventing a candidate. |
| Treating no-live base-charge dry-run or HTTP `200` as ORCA Trial acceptance. | RWO-06G required parsed business evidence and classified the live response as `businessRejected`. |
| Broadening one base-charge class into all base-charge readiness. | The wrapper only allows `baseChargeOrder` class `110`; `114/120/124` remain separate. |
| Capturing raw ORCA or credential artifacts. | Evidence is limited to hashes, classifications, endpoint metadata, and allowlisted summaries. |

## Claim Boundary

This run does not claim `指導料` Trial acceptance, base-charge Trial acceptance, all charge variants, all order items, fullflow, production ORCA readiness, S3/object-storage readiness, or final release readiness. Do not repeat the RWO-06G v1 duplicate-live checkpoint without a new justified candidate.

Credentials captured: `false`

Raw artifacts captured: `false`

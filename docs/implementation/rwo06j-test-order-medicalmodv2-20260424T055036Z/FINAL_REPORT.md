# RWO-06J Test Order medicalmodv2 Trial Classification

RUN_ID: `20260424T055036Z`

## Scope

This run followed the active RWO-06E-next handoff for `testOrder` / `検査` / Claim007 class `600`.

No production ORCA, S3/MinIO/object-storage, fullflow, diseasev3, subjectivesv2, Request_Number `02` / `03` / `04`, browser screenshots, HAR, traces, videos, raw network dumps, raw ORCA bodies, raw patient/insurance detail, or legacy `client/` / `server/` changes were used.

## Result

The RWO-06J payload identity was created, no-live verified, and executed once against WebORCA / ORCA Trial through the safe `medicalmodv2` wrapper. The live result is not accepted.

| Item | Classification |
|---|---|
| Work Order | `RWO-06J` |
| Workflow | `test-order` |
| Payload identity | `medicalmodv2_test_order_trial_reachability_v1.json` |
| Entity | `testOrder` |
| Claim007 class | `600` |
| Request_Number | `01` only |
| API class | `01` only |
| Payload SHA-256 | `b4fd3a422ac38f51b73a2fb2a56d07e2418339878f9451a6d73eb185bbd334d2` |
| Duplicate-live checkpoint | `rwo06j:medicalmodv2:rwo06j-test-order-medicalmodv2-v1:target-00001:request-01:class-01:payload-sha256-b4fd3a422ac38f51b73a2fb2a56d07e2418339878f9451a6d73eb185bbd334d2` |
| No-live unit test | passed |
| Wrapper dry-run | passed |
| Runtime readiness before live | health HTTP `200`, readiness HTTP `200` |
| Live Trial action | executed once |
| Live HTTP status | `200` |
| Live business classification | `businessRejected` |
| Business accepted | `false` |

## Sanitized Evidence

- Dry-run summary: `artifacts/orca-remediation/closeout/20260424T055036Z/qa/phase4-safe-medicalmodv2-test-order/phase4-medicalmodv2-summary.sanitized.json`
- Live summary: `artifacts/orca-remediation/closeout/20260424T055036Z/qa/phase4-safe-medicalmodv2-test-order-live/phase4-medicalmodv2-summary.sanitized.json`
- Run summary: `docs/implementation/rwo06j-test-order-medicalmodv2-20260424T055036Z/summary.sanitized.json`

## Misuse Cases Checked

| Misuse case | Control |
|---|---|
| Treating `testOrder/600` as physiology or bacteria coverage. | The wrapper workflow allows only canonical `testOrder` and class `600`; `physiologyOrder` and `bacteriaOrder` remain fail-closed/non-claim rows. |
| Treating local-only test admin/memo/subtype fields as Trial acceptance evidence. | The candidate is justified by coded test/comment rows; local-only details are not business success evidence. |
| Treating HTTP `200`, dry-run, or timestamp evidence as acceptance. | The sanitized parser requires zero-like `apiResult` plus completion evidence; the live response was classified as `businessRejected`. |
| Repeating prior accepted/rejected checkpoints. | A new `rwo06j` duplicate-live checkpoint was used; prior prescription/treatment/instruction/base-charge/injection/surgery checkpoints were not repeated. |
| Capturing raw ORCA or credential artifacts. | Evidence is limited to hashes, status codes, classifications, endpoint metadata, and allowlisted summaries. |

## Claim Boundary

This run does not claim test-order Trial acceptance, all test variants, physiology/bacteria coverage, all order items, fullflow, production ORCA readiness, S3/object-storage readiness, Request_Number `02` / `03` / `04`, or final release readiness. Do not repeat the RWO-06J v1 duplicate-live checkpoint without a new justified candidate.

Credentials captured: `false`

Raw artifacts captured: `false`

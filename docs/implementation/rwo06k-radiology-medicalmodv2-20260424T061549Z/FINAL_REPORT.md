# RWO-06K Radiology medicalmodv2 Trial Classification

RUN_ID: `20260424T061549Z`

## Scope

This run followed the active RWO-06E-next handoff for `radiologyOrder` / `画像診断` / Claim007 class `700`.

No production ORCA, S3/MinIO/object-storage, fullflow, diseasev3, subjectivesv2, Request_Number `02` / `03` / `04`, browser screenshots, HAR, traces, videos, raw network dumps, raw ORCA bodies, raw patient/insurance detail, or legacy `client/` / `server/` changes were used.

## Result

The RWO-06K payload identity was created, no-live verified, and executed once against WebORCA / ORCA Trial through the safe `medicalmodv2` wrapper. The live result is not accepted.

| Item | Classification |
|---|---|
| Work Order | `RWO-06K` |
| Workflow | `radiology` |
| Payload identity | `medicalmodv2_radiology_trial_reachability_v1.json` |
| Entity | `radiologyOrder` |
| Claim007 class | `700` |
| Request_Number | `01` only |
| API class | `01` only |
| Payload SHA-256 | `d4dede12f9c7a43ab3c20bf972ef35a44ef0a33411e91a22429e85e985004f9e` |
| Duplicate-live checkpoint | `rwo06k:medicalmodv2:rwo06k-radiology-medicalmodv2-v1:target-00001:request-01:class-01:payload-sha256-d4dede12f9c7a43ab3c20bf972ef35a44ef0a33411e91a22429e85e985004f9e` |
| No-live unit test | passed |
| Wrapper dry-run | passed |
| Runtime readiness before live | health HTTP `200`, readiness HTTP `200` |
| Live Trial action | executed once |
| Live HTTP status | `200` |
| Live business classification | `businessRejected` |
| Business accepted | `false` |

## Sanitized Evidence

- Dry-run summary: `docs/implementation/rwo06k-radiology-medicalmodv2-20260424T061549Z/wrapper-dry-run/phase4-medicalmodv2-summary.sanitized.json`
- Live summary: `docs/implementation/rwo06k-radiology-medicalmodv2-20260424T061549Z/live-wrapper/phase4-medicalmodv2-summary.sanitized.json`
- Run summary: `docs/implementation/rwo06k-radiology-medicalmodv2-20260424T061549Z/summary.sanitized.json`

## Misuse Cases Checked

| Misuse case | Control |
|---|---|
| Treating one `radiologyOrder/700` candidate as all radiology variants. | The wrapper workflow allows only canonical `radiologyOrder` and class `700`; `701`, `702`, `703`, `704`, `731`, and `732` remain unverified. |
| Trusting local memo/admin text or raw response detail as business evidence. | The payload identity is based on coded body-part/main/auxiliary/comment rows; local memo/admin data and raw ORCA body fields are not stored. |
| Treating HTTP `200`, dry-run, or timestamp evidence as acceptance. | The sanitized parser requires endpoint-specific business success evidence; the live response was classified as `businessRejected`. |
| Repeating prior accepted/rejected checkpoints. | A new `rwo06k` duplicate-live checkpoint was used; prior prescription/treatment/instruction/base-charge/injection/surgery/test checkpoints were not repeated. |
| Capturing raw ORCA or credential artifacts. | Evidence is limited to hashes, status codes, classifications, endpoint metadata, and allowlisted summaries. |

## Claim Boundary

This run does not claim radiology Trial acceptance, all radiology variants, all order items, fullflow, production ORCA readiness, S3/object-storage readiness, Request_Number `02` / `03` / `04`, diseasev3, subjectivesv2, or final release readiness. Do not repeat the RWO-06K v1 duplicate-live checkpoint without a new justified candidate.

Credentials captured: `false`

Raw artifacts captured: `false`

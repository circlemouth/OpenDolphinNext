# Phase4 accepted reference ledger lock

RUN_ID: `20260427T150350Z`

No live ORCA action was run. This docs-only step locked the current accepted `medicalmodv2` references as regression anchors and updated the feature ledger.

## Anchors

| Work Order | Workflow | Payload SHA-256 | Classification |
|---|---|---|---|
| `RWO-06J` | `testOrder/600` v3 | `6a4e1800dbc6993c08c90d01a5ed57e490c0b38a346b6966325bfa0d86a61a28` | `live_trial_business_accepted` |
| `RWO-06K` | `radiologyOrder/700` v3 | `144850285178276d543ebb424610cbf91a2e188b8dc597f957cc882577c4a16a` | `live_trial_business_accepted` |

These references are anchors only. The same duplicate-live checkpoints should not be repeated unnecessarily.

## Claim Boundary

Allowed claim: two endpoint-specific accepted Trial anchors are recorded.

Not claimed: all-test coverage, all-radiology coverage, all-order readiness, Request_Number `02` / `03` / `04` success, diseasev3 or subjectivesv2 acceptance, fullflow success, production ORCA readiness, S3/object-storage readiness, rollback rehearsal, owner final GO/NO-GO, or final release readiness.

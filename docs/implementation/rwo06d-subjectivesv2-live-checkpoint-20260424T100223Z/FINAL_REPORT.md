# RWO-06D Subjectivesv2 Live Trial Checkpoint

RUN_ID: `20260424T100223Z`

## Result

`RWO06D_SUBJECTIVESV2_LIVE_TRIAL_TRANSPORT_REJECTED`

The active handoff `subjectivesv2-live-trial-checkpoint-readiness-not-run` was executed for the exact approved identity. The safe wrapper performed one sanitized live wrapper action, but the result is not business success.

## Scope

| Field | Value |
|---|---|
| Workflow | `subjectivesv2` |
| Official server route | `POST /api/orca/official/chart-support/subjectives-mod-v2` |
| ORCA endpoint | `/orca25/subjectivesv2` |
| Target | `00001` |
| Payload SHA-256 | `9c90a3b0d731bce2b9e1280d01a5c61222bbd97126e3f9fc50aa6135842dc308` |
| Duplicate-live checkpoint key | `rwo06b:subjectivesv2:rwo06b-subjectivesv2-live-readiness-v1:target-00001:operation-create:request-01:class-01:payload-sha256-9c90a3b0d731bce2b9e1280d01a5c61222bbd97126e3f9fc50aa6135842dc308` |

## Evidence

- [summary.sanitized.json](summary.sanitized.json)
- [wrapper-dry-run/phase4-soap-disease-summary.sanitized.json](wrapper-dry-run/phase4-soap-disease-summary.sanitized.json)
- [wrapper-live-attempt/phase4-soap-disease-summary.sanitized.json](wrapper-live-attempt/phase4-soap-disease-summary.sanitized.json)
- [command-log.jsonl](command-log.jsonl)
- [secret-scan.sanitized.txt](secret-scan.sanitized.txt)

## Verification

| Check | Result |
|---|---|
| wrapper syntax | pass |
| `phase4SoapDiseaseSafeEvidence.test.ts` | pass / 11 tests |
| subjectivesv2 wrapper dry-run | pass / no live ORCA / `notVerified` |
| subjectivesv2 live wrapper action | executed once / `transportRejected` / HTTP 404 |
| focused server tests | pass / 16 tests |

## Classification

The live wrapper action reached backend health/readiness `200/200`, confirmed no accepted duplicate checkpoint, and posted only the exact approved payload through sanitized evidence mode. The authenticated official route returned sanitized HTTP `404`, so the Trial business-success classification is `transportRejected` and `businessAccepted=false`.

Focused server tests passed for the current source route contract, so the next smallest safe task is to verify or refresh the current non-S3 server runtime pair before any retry. Do not repeat this live checkpoint blindly; rerun only after evidence shows the deployed backend contains `subjectives-mod-v2`.

## Claim Boundary

No SOAP `subjectivesv2` Trial business acceptance, `diseasev3` Trial reachability, disease update/delete readiness, Request_Number `02` / `03` / `04`, fullflow, production ORCA readiness, S3/object-storage readiness, broad clinical release readiness, or final release GO is claimed.

Credentials captured: `false`

Raw artifacts captured: `false`

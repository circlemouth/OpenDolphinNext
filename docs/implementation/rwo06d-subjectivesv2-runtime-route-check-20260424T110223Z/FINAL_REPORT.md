# RWO-06D Subjectivesv2 Runtime Route Check

RUN_ID: `20260424T110223Z`

## Result

`RWO06D_SUBJECTIVESV2_RUNTIME_ROUTE_DEPLOYMENT_RESOLVED_RETRY_NOT_RERUN`

The active handoff route/deployment blocker was narrowed and resolved: the running `server-modernized-dev` container was stale. Before rebuild, authenticated empty-payload probes returned:

| Route | Status | Meaning |
|---|---:|---|
| `/api/orca/official/chart-support/medical-mod-v2` | 400 | route present; validation rejected empty payload |
| `/api/orca/official/chart-support/subjectives-mod-v2` | 404 | route absent from running WAR |
| `/api/orca/official/chart-support/disease-mod-v3` | 404 | route absent from running WAR |

After rebuilding and recreating only the current master worktree runtime, the same authenticated probes returned `400` for all three routes. That proves the active local Trial runtime now contains `POST /api/orca/official/chart-support/subjectives-mod-v2`.

## Evidence

- [summary.sanitized.json](summary.sanitized.json)
- [route-deployment.sanitized.json](route-deployment.sanitized.json)
- [wrapper-dry-run/phase4-soap-disease-summary.sanitized.json](wrapper-dry-run/phase4-soap-disease-summary.sanitized.json)
- [wrapper-live-retry/phase4-soap-disease-summary.sanitized.json](wrapper-live-retry/phase4-soap-disease-summary.sanitized.json)
- [command-log.jsonl](command-log.jsonl)
- [secret-scan.sanitized.txt](secret-scan.sanitized.txt)

## Verification

| Check | Result |
|---|---|
| wrapper syntax | pass |
| `phase4SoapDiseaseSafeEvidence.test.ts` | pass / 11 tests |
| subjectivesv2 wrapper dry-run | pass / no live ORCA / `notVerified` |
| focused server tests | pass / 16 tests |
| Docker build | pass / `server-modernized-dev` current master image built |
| Docker recreate | pass / current worktree `server-modernized-dev` only |
| post-rebuild health/readiness | pass / 200 and 200 |
| post-rebuild route deployment | pass / `subjectives-mod-v2` authenticated empty payload returned 400 |

## Live Trial Classification

One exact `subjectivesv2` live retry was executed before the rebuild evidence was available. It returned sanitized HTTP `404`, so it remains `transportRejected`, `businessAccepted=false`.

No second live retry was executed in this run after the rebuild. The handoff allowed one retry, and the safe next action is now precise: run the same duplicate-live checkpoint once against the rebuilt current runtime through the safe wrapper.

## Claim Boundary

No SOAP `subjectivesv2` Trial business acceptance, `diseasev3` Trial reachability, disease update/delete readiness, Request_Number `02` / `03` / `04`, fullflow, production ORCA readiness, S3/object-storage readiness, broad clinical release readiness, or final release GO is claimed.

Credentials captured: `false`

Raw artifacts captured: `false`

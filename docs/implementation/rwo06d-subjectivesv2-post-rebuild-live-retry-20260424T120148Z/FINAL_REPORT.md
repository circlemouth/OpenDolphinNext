# RWO-06D Subjectivesv2 Post-Rebuild Live Retry

RUN_ID: `20260424T120148Z`

## Result

`RWO06D_SUBJECTIVESV2_POST_REBUILD_LIVE_RETRY_TRANSPORT_REJECTED_502`

The active handoff `subjectivesv2-live-trial-post-rebuild-exact-retry-not-run` was executed for the exact approved identity after confirming the current runtime still exposes the deployed route.

Preflight before live retry:

| Check | Result |
|---|---:|
| health | 200 |
| readiness | 200 |
| authenticated empty JSON `POST /api/orca/official/chart-support/subjectives-mod-v2` | 400 |

The `400` route probe means the route is present and validation rejected the empty probe. It is no longer the stale-WAR `404` blocker.

## Live Trial Classification

The exact approved `subjectivesv2` checkpoint was attempted three times through `web-client/scripts/qa-phase4-safe-soap-disease.mjs`, with sanitized evidence mode only:

| Attempt | HTTP status | Classification | Business accepted |
|---:|---:|---|---|
| 1 | 502 | `transportRejected` | false |
| 2 | 502 | `transportRejected` | false |
| 3 | 502 | `transportRejected` | false |

This worker's three authorized live retries are exhausted. HTTP 200, wrapper execution, and transport reachability were not treated as business success. No endpoint-specific parsed completion evidence was present.

Control correction: the three attempts had unchanged material preconditions and therefore should not be repeated as a pattern. The active follow-up prompt now requires investigation, a concrete sanitized `502` hypothesis, and either a verified repo-local fix or evidence of changed runtime/upstream state before any future live retry. Any justified retry should be scoped to one attempt unless a new owner prompt explicitly authorizes more with a diagnosis-backed reason.

## Evidence

- [summary.sanitized.json](summary.sanitized.json)
- [route-preflight.sanitized.json](route-preflight.sanitized.json)
- [preflight-attempt-1.sanitized.json](preflight-attempt-1.sanitized.json)
- [preflight-attempt-2.sanitized.json](preflight-attempt-2.sanitized.json)
- [preflight-attempt-3.sanitized.json](preflight-attempt-3.sanitized.json)
- [wrapper-dry-run/phase4-soap-disease-summary.sanitized.json](wrapper-dry-run/phase4-soap-disease-summary.sanitized.json)
- [wrapper-live-attempt-1/phase4-soap-disease-summary.sanitized.json](wrapper-live-attempt-1/phase4-soap-disease-summary.sanitized.json)
- [wrapper-live-attempt-2/phase4-soap-disease-summary.sanitized.json](wrapper-live-attempt-2/phase4-soap-disease-summary.sanitized.json)
- [wrapper-live-attempt-3/phase4-soap-disease-summary.sanitized.json](wrapper-live-attempt-3/phase4-soap-disease-summary.sanitized.json)
- [command-log.jsonl](command-log.jsonl)
- [secret-scan.sanitized.txt](secret-scan.sanitized.txt)

## Verification

| Check | Result |
|---|---|
| wrapper syntax | pass |
| `phase4SoapDiseaseSafeEvidence.test.ts` | pass / 11 tests |
| subjectivesv2 wrapper dry-run | pass / no live ORCA |
| current runtime containers | up / healthy |
| pre-live route deployment | pass / `subjectives-mod-v2` authenticated empty payload returned 400 |

## Claim Boundary

No SOAP `subjectivesv2` Trial business acceptance, `diseasev3` Trial reachability, disease update/delete readiness, Request_Number `02` / `03` / `04`, fullflow, production ORCA readiness, S3/object-storage readiness, broad clinical release readiness, or final release GO is claimed.

Credentials captured: `false`

Raw artifacts captured: `false`

Recommended next task: investigate the sanitized HTTP `502` transport rejection path without raw ORCA bodies, credentials, HAR, trace, video, screenshot, or raw network capture. Do not run another live retry until that investigation creates a new precise retry decision based on a changed precondition, verified fix, or safety stop.

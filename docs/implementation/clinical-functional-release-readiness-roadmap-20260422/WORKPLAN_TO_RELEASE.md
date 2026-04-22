# Workplan To Release

RUN_ID: `20260422T134401Z`

## Recommended Sequence

1. RWO-01: owner accepts this roadmap and claim boundaries.
2. RWO-02: no-live browser smoke for core chart workflows.
3. RWO-03: prescription browser e2e/local persistence.
4. RWO-04: generic order browser e2e/local persistence.
5. RWO-05: disease and SOAP browser e2e.
6. RWO-06: trial ORCA live verification, one target and one endpoint at a time.
7. RWO-07: Request_Number 02/03/04 only if business scope requires it and owner approves.
8. RWO-08: safe fullflow after browser and live endpoint prerequisites.
9. RWO-09: security, secrets, CI, package, deployment readiness.
10. RWO-10: production ORCA readiness and owner approval.
11. RWO-11: final release candidate validation and sign-off.

## Why This Sequence Is Safe

The sequence avoids using live ORCA to discover basic browser or local persistence defects. It first closes documentation and browser-local gaps, then expands live ORCA narrowly with explicit owner approval and sanitized evidence rules. Fullflow is placed after endpoint-level live evidence so that a failure can be classified without raw artifacts.

## Task Classes

| Task class | Work Orders | Notes |
|---|---|---|
| Docs-only | RWO-01 | No runtime or live execution. |
| Browser tests | RWO-02, RWO-03, RWO-04, RWO-05 | No live ORCA; sanitized evidence only. |
| Live ORCA requiring explicit owner approval | RWO-06, RWO-07, RWO-08, RWO-10 | Credentials required through approved channel; raw artifact capture prohibited. |
| Production-readiness | RWO-09, RWO-10, RWO-11 | Includes CI, deployment config, rollback, owner sign-off. |

No background or asynchronous work is claimed by this roadmap.


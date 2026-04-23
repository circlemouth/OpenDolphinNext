# Workplan To Release

RUN_ID: `20260422T134401Z`

## ORCA Connection Scope

This roadmap assumes WebORCA / ORCA Trial as the only ORCA connection target. Production ORCA connectivity, production ORCA credentials, and production ORCA functional execution are out of scope for this automation and are not required to advance the roadmap.

Trial evidence must not be used to claim production ORCA readiness. If production ORCA readiness is requested later, it requires a separate owner-approved production plan outside this roadmap.

## Recommended Sequence

1. RWO-01: owner accepts this roadmap and claim boundaries.
2. RWO-02: no-live browser smoke for core chart workflows.
3. RWO-03: prescription browser e2e/local persistence.
4. RWO-04: generic order browser e2e/local persistence.
5. RWO-05: disease and SOAP browser e2e.
6. RWO-06: trial ORCA live verification, one target and one endpoint at a time.
7. RWO-07: Request_Number 02/03/04 only if business scope requires it and owner approves.
8. RWO-08: safe fullflow after browser and live endpoint prerequisites.
9. RWO-09: security, secrets, CI, package, deployment readiness without production ORCA execution.
10. RWO-10: record production ORCA as out-of-scope / not applicable for this Trial-only roadmap.
11. RWO-11: final Trial-backed release candidate validation and owner sign-off.

## Why This Sequence Is Safe

The sequence avoids using live ORCA to discover basic browser or local persistence defects. It first closes documentation and browser-local gaps, then expands live ORCA narrowly with explicit owner approval and sanitized evidence rules. Fullflow is placed after endpoint-level live evidence so that a failure can be classified without raw artifacts.

## Task Classes

| Task class | Work Orders | Notes |
|---|---|---|
| Docs-only | RWO-01 | No runtime or live execution. |
| Browser tests | RWO-02, RWO-03, RWO-04, RWO-05 | No live ORCA; sanitized evidence only. |
| Live ORCA requiring explicit owner approval | RWO-06, RWO-07, RWO-08 | Trial credentials/config required through approved channel; raw artifact capture prohibited. |
| Release-readiness without production ORCA execution | RWO-09, RWO-11 | Includes CI, deployment config, rollback, owner sign-off, and explicit production-ORCA non-claim. |
| Production ORCA out-of-scope marker | RWO-10 | Records that production ORCA execution/readiness is not part of this Trial-only roadmap. |

No background or asynchronous work is claimed by this roadmap.

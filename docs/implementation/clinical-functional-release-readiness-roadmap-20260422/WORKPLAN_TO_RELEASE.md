# Workplan To Release

RUN_ID: `20260422T134401Z`

## ORCA Connection Scope

This roadmap assumes WebORCA / ORCA Trial as the only ORCA connection target. Production ORCA connectivity, production ORCA credentials, and production ORCA functional execution are out of scope for this automation and are not required to advance the roadmap.

Trial evidence must not be used to claim production ORCA readiness. If production ORCA readiness is requested later, it requires a separate owner-approved production plan outside this roadmap.

## S3 / Object Storage Scope

This roadmap also skips tasks that require S3, MinIO, object-storage credentials, attachment-storage S3 configuration, or PHR export S3 configuration. Those tasks are `skipped_s3_required_out_of_scope` unless a non-S3 approved runtime path exists.

Do not request, generate, print, commit, or workaround S3/MinIO/object-storage secret values. Do not claim attachment storage, PHR export storage, S3 persistence, or object-storage deployment readiness from this roadmap.

Owner direction recorded by RUN_ID `20260423T054833Z`: do not unblock Trial ORCA by adding a local dummy S3/MinIO server. The preferred unblocker is an explicit object-storage-free dev/Trial runtime profile that requires no S3/MinIO/object-storage credentials, keeps attachment/patient-image/PHR storage features fail-closed, and preserves storage readiness as an explicit non-claim.

## Current-Run Exhaustion Policy

Each automation run should complete every safe task that is currently possible. A task blocked only by local environment availability is skipped for that run, not treated as the end of the run.

Environment-only blockers include Docker unavailable, local backend unavailable, browser runtime unavailable, missing local runtime secret/config, missing local test seed, missing safe non-S3 runtime path, and browser/fullflow harnesses that would create forbidden artifacts. Record these as `skipped_environment_unavailable_*` or the more specific `skipped_s3_required_out_of_scope`, then continue to the next independent safe Work Order.

When a Work Order is skipped, the same run should continue with docs, static guards, unit/component tests, parser/sanitizer tests, safe wrapper dry-runs, package metadata checks, claim-boundary updates, release gate updates, risk register updates, and final summaries that do not depend on the skipped runtime.

Only stop the run when no independent safe task remains, the run time budget is exhausted, the repo state is unsafe, raw artifacts would be required to decide success, or the next action requires a non-skippable human decision outside standing Trial approval.

## Recommended Sequence

1. RWO-01: owner accepts this roadmap and claim boundaries.
2. RWO-02: no-live browser smoke for core chart workflows.
3. RWO-03: prescription browser e2e/local persistence.
4. RWO-04: generic order browser e2e/local persistence.
5. RWO-05: disease and SOAP browser e2e.
6. RWO-06A: implement and locally verify the object-storage-free dev/Trial runtime profile if live Trial ORCA remains blocked by object-storage startup requirements.
7. RWO-06: trial ORCA live verification, one target and one endpoint at a time, only through non-S3-approved runtime paths.
8. RWO-07: Request_Number 02/03/04 only if business scope requires it and owner approves.
9. RWO-08: safe fullflow after browser and live endpoint prerequisites.
10. RWO-09: security, secrets, CI, package, deployment readiness without production ORCA execution or S3/MinIO/object-storage setup.
11. RWO-10: record production ORCA as out-of-scope / not applicable for this Trial-only roadmap.
12. RWO-11: final Trial-backed release candidate validation and owner sign-off.

## Current Safe Work Queue

When the active handoff is superseded or skipped, process this queue in order and continue until no safe task remains:

1. Record any skipped active handoff or Work Order in `HANDOFF_STATE.json`, the gate matrix, and the final summary.
2. Complete or refresh RWO-01 claim-boundary docs under standing Trial approval; if explicit owner sign-off is absent, mark it `pending_owner_signoff` and continue.
3. Run repo-local static/contract checks that do not need runtime secrets, browser screenshots/HAR/traces/videos, production ORCA, or S3/object storage.
4. Run unit/component tests and wrapper dry-runs that do not require unavailable runtime services or forbidden artifacts.
5. For RWO-02 through RWO-05, run only artifact-safe no-live browser checks if an artifact-free harness exists; otherwise record `skipped_environment_unavailable_safe_browser_harness_missing` and continue.
6. For RWO-06 through RWO-08, run only Trial live/fullflow checks that have approved non-S3 runtime paths and safe evidence modes; if the only blocker is object-storage startup coupling, first process the active RWO-06A non-S3 runtime-profile handoff.
7. Complete RWO-09 non-S3 security/secret handling, CI/static evidence, packaging, rollback, and non-claim updates that are possible without unavailable runtime services.
8. Complete RWO-10 production ORCA non-claim docs-only marker.
9. Complete RWO-11 final Trial-backed non-S3 summary as far as evidence allows, with any remaining runtime-dependent gates listed as skipped or pending rather than overclaimed.

## Why This Sequence Is Safe

The sequence avoids using live ORCA to discover basic browser or local persistence defects. It first closes documentation and browser-local gaps, then expands live ORCA narrowly with explicit owner approval and sanitized evidence rules. Fullflow is placed after endpoint-level live evidence so that a failure can be classified without raw artifacts.

## Task Classes

| Task class | Work Orders | Notes |
|---|---|---|
| Docs-only | RWO-01 | No runtime or live execution. |
| Browser tests | RWO-02, RWO-03, RWO-04, RWO-05 | No live ORCA; sanitized evidence only. |
| Non-S3 runtime blocker resolution | RWO-06A | Repo-local implementation/docs/tests for an object-storage-free dev/Trial profile; no dummy S3/MinIO and no storage readiness claim. |
| Live ORCA requiring explicit owner approval | RWO-06, RWO-07, RWO-08 | Trial credentials/config required through approved channel; raw artifact capture prohibited; skip if S3/MinIO/object-storage config is required. |
| Release-readiness without production ORCA or S3 execution | RWO-09, RWO-11 | Includes CI, non-S3 deployment config, rollback, owner sign-off, and explicit production-ORCA/S3 non-claims. |
| Production ORCA out-of-scope marker | RWO-10 | Records that production ORCA execution/readiness is not part of this Trial-only roadmap. |

No background or asynchronous work is claimed by this roadmap.

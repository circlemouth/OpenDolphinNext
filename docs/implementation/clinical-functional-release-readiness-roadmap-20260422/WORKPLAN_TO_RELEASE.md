# Workplan To Release

RUN_ID: `20260422T134401Z`

## ORCA Connection Scope

This roadmap assumes WebORCA / ORCA Trial as the only ORCA connection target. Production ORCA connectivity, production ORCA credentials, and production ORCA functional execution are out of scope for this automation and are not required to advance the roadmap.

Trial evidence must not be used to claim production ORCA readiness. If production ORCA readiness is requested later, it requires a separate owner-approved production plan outside this roadmap.

## medicalmodv2 Iterative Retry Scope

Owner direction recorded by RUN_ID `20260423T122650Z`: RWO-06 `medicalmodv2` fix-and-retry cycles may be repeated as many times as needed. The `orca` automation should proceed as autonomously as possible without waiting for additional user permission until `medicalmodv2` is accepted or a non-skippable safety stop condition is reached. A later worker does not need fresh owner approval for each additional `medicalmodv2` retry when the retry follows a repo-local investigation/fix/focused no-live verification cycle, uses the approved safe wrapper/evidence mode, and stays within the Trial-only non-S3 scope.

This does not authorize blind retry loops or stopping at a proposal. Each live retry must be preceded by a documented investigation and focused no-live verification, and each result must be recorded as sanitized endpoint-specific business evidence.

This direction applies only to `medicalmodv2`. Phase3 / `acceptmodv2`, `diseasev3`, `subjectivesv2`, fullflow, production ORCA, and S3/object-storage remain separately gated or out of scope unless a later work order adds endpoint-specific wrappers, success criteria, and approval records. Owner direction recorded on 2026-04-24 now requests all electronic-chart operations that can be acted on by users, including Request_Number `02` / `03` / `04` update/delete/cancel-like paths, to be enumerated and tested where safe.

## ORCA Trial Reachability Expansion Scope

Owner request recorded by RUN_ID `20260424T025733Z`: add roadmap tasks to verify WebORCA / ORCA Trial reachability for currently unverified major chart workflows, including prescription, treatment/generic orders, SOAP, and disease CRUD.

The detailed expansion plan is [ORCA_TRIAL_REACHABILITY_EXPANSION_PLAN.md](ORCA_TRIAL_REACHABILITY_EXPANSION_PLAN.md).

One automation run may execute multiple reachability checks when each check has an independent endpoint/request-class scope, preflight, wrapper, parser/sanitizer contract, endpoint-specific business-success criteria, and sanitized evidence directory. A failed check must be recorded as an endpoint-specific blocker, then the same run may continue to independent safe checks. This batch rule does not allow blind retries, repeated unchanged live sends, committing/packaging raw diagnostic artifacts, production ORCA, S3/object-storage configuration, or treating generic HTTP/wrapper success as business success.

## Fullflow Diagnostic Artifact Scope

Owner direction recorded on 2026-04-24 authorizes browser/fullflow automation to run existing broad harnesses even when they create screenshots, HAR, traces, videos, or raw network artifacts, provided those artifacts remain local-only, untracked, and excluded from reviewer packets. The automation must derive sanitized summaries and diagnostic manifests for committed evidence. This does not authorize printing or committing credentials, cookies, sessions, Authorization headers, raw ORCA bodies, raw patient/insurance details, production data, production ORCA, or S3/object-storage configuration.

Owner clarification recorded after RUN_ID `20260424T142513Z`: when an owner permits "up to three live wrapper attempts" for an endpoint, that means up to three `try -> investigate -> fix -> focused no-live verification -> retry` cycles. It does not authorize sending the same unchanged live request repeatedly after the same failure. Every live retry after a failure must name the concrete repo-local fix or changed precondition that justifies the retry and must include focused no-live verification before the live action. If no fix or changed precondition exists, record the blocker and continue to independent safe work.

The `orca` automation may run once per hour. RWO-06B through RWO-08B must therefore be resumable: each run reads the previous endpoint-level checkpoint, skips already accepted live evidence for the same endpoint/request-class/target/payload identity, records blockers without blind retry, and leaves the next queued endpoint explicit when the hourly budget is exhausted. A run does not have to complete every queued check within one hour; it must avoid starting work that cannot safely finish with sanitized evidence, scans, updates, and commit inside the run budget.

## S3 / Object Storage Scope

This roadmap also skips tasks that require S3, MinIO, object-storage credentials, attachment-storage S3 configuration, or PHR export S3 configuration. Those tasks are `skipped_s3_required_out_of_scope` unless a non-S3 approved runtime path exists.

Do not request, generate, print, commit, or workaround S3/MinIO/object-storage secret values. Do not claim attachment storage, PHR export storage, S3 persistence, or object-storage deployment readiness from this roadmap.

Owner direction recorded by RUN_ID `20260423T054833Z`: do not unblock Trial ORCA by adding a local dummy S3/MinIO server. The preferred unblocker is an explicit object-storage-free dev/Trial runtime profile that requires no S3/MinIO/object-storage credentials, keeps attachment/patient-image/PHR storage features fail-closed, and preserves storage readiness as an explicit non-claim.

## Current-Run Exhaustion Policy

Each automation run should complete every safe task that is currently possible. A task blocked only by local environment availability is skipped for that run, not treated as the end of the run.

Environment-only blockers include Docker unavailable, local backend unavailable, browser runtime unavailable, missing local runtime secret/config, missing local test seed, missing safe non-S3 runtime path, and browser/fullflow harnesses whose diagnostic artifacts cannot be contained local-only/untracked. Record these as `skipped_environment_unavailable_*` or the more specific `skipped_s3_required_out_of_scope`, then continue to the next independent safe Work Order.

When a Work Order is skipped, the same run should continue with docs, static guards, unit/component tests, parser/sanitizer tests, safe wrapper dry-runs, package metadata checks, claim-boundary updates, release gate updates, risk register updates, and final summaries that do not depend on the skipped runtime.

Only stop the run when no independent safe task remains, the run time budget is exhausted, the repo state is unsafe, raw artifact contents would have to be committed/packaged to decide success, or the next action requires a non-skippable human decision outside standing Trial approval.

## Commit Requirement

Each worker run that changes source, docs, gate matrices, handoff state, sanitized evidence, review-package metadata, or roadmap summaries must commit the roadmap-scoped changes before returning the final report. Commit only after relevant verification has passed or after a sanitized skip/blocker record has been written.

Do not commit approved local runtime secret files, ORCA credentials, S3/MinIO/object-storage values, raw ORCA bodies, diagnostic HAR/trace/video/screenshot/raw network artifacts, or unrelated user changes. If unrelated worktree changes are present and cannot be safely staged apart from the current task, leave them uncommitted and report the reason.

## Recommended Sequence

1. RWO-01: owner accepts this roadmap and claim boundaries.
2. RWO-02: no-live browser smoke for core chart workflows.
3. RWO-03: prescription browser e2e/local persistence.
4. RWO-04: generic order browser e2e/local persistence.
5. RWO-05: disease and SOAP browser e2e.
6. RWO-06A: implement and locally verify the object-storage-free dev/Trial runtime profile if live Trial ORCA remains blocked by object-storage startup requirements.
7. RWO-06: trial ORCA live verification, starting from approved narrow scope, only through non-S3-approved runtime paths.
8. RWO-06B: inventory currently unverified Trial reachability paths and define safe wrappers/success criteria.
9. RWO-06C: run safe read-only Trial reachability probes in batches when wrappers and parsers exist.
10. RWO-06D: run endpoint-specific Trial mutation reachability checks in batches when approval, wrappers, no-live validation, and readiness gates pass.
11. RWO-06E: maintain an exhaustive order-item matrix covering documents, `指導料`, tests, treatments, injections, charges, surgery, radiology, local-only rows, and accepted endpoint-specific identities.
12. RWO-06F/RWO-06F2: verify `instractionChargeOrder` / `指導料` representative Trial reachability before broader charge/order families; v1 is safely tested but Trial-rejected, and v2 candidate selection should use web-researched official/public sources plus no-live contract checks before any live retry.
13. RWO-06G: run the no-live-prepared `baseChargeOrder` / `基本診療料` class `110` Trial classification through the same wrapper; v1 was Trial-rejected and must not be repeated without a justified v2 candidate.
14. RWO-06H: investigate and verify `injectionOrder` / `注射` class `310` through a separate payload identity; v1 was safely tested but Trial-rejected and must not be repeated without a justified v2 candidate.
15. RWO-06I: investigate and verify `surgeryOrder` / `手術` class `500` through a separate payload identity; v1 was safely tested but Trial-rejected and must not be repeated without a justified v2 candidate.
16. RWO-06J: investigate and verify `testOrder` / `検査` class `600` through a separate payload identity; v1 was safely tested but Trial-rejected and must not be repeated without a justified v2 candidate.
17. RWO-06K: investigate and verify `radiologyOrder` / `画像診断` class `700` through a separate payload identity; v1 was safely tested but Trial-rejected and must not be repeated. RUN_ID `20260424T225533Z` prepared source-backed v2 candidate `002000099+170027910` with passing no-live wrapper/contract evidence; next step is runtime readiness and duplicate-checkpoint preflight before any live Trial checkpoint.
18. RWO-07: enumerate and test all electronic-chart user operations that map to Request_Number 02/03/04 or equivalent update/delete/cancel semantics, with endpoint-specific wrappers and success criteria.
19. RWO-08: fullflow after browser and live endpoint prerequisites, using artifact-free mode or owner-approved diagnostic fullflow mode.
20. RWO-08B: fullflow reachability variants, batched through artifact-free or diagnostic mode with only sanitized extracted evidence committed.
20. RWO-09: security, secrets, CI, package, deployment readiness without production ORCA execution or S3/MinIO/object-storage setup.
21. RWO-10: record production ORCA as out-of-scope / not applicable for this Trial-only roadmap.
22. RWO-11: final Trial-backed release candidate validation and owner sign-off.

## Current Safe Work Queue

When the active handoff is superseded or skipped, process this queue in order and continue until no safe task remains:

1. Record any skipped active handoff or Work Order in `HANDOFF_STATE.json`, the gate matrix, and the final summary.
2. Complete or refresh RWO-01 claim-boundary docs under standing Trial approval; if explicit owner sign-off is absent, mark it `pending_owner_signoff` and continue.
3. Run repo-local static/contract checks that do not need runtime secrets, production ORCA, S3/object storage, or committing raw diagnostic artifacts.
4. Run unit/component tests and wrapper dry-runs that do not require unavailable runtime services or committing raw diagnostic artifacts.
5. For RWO-02 through RWO-05, run only artifact-safe no-live browser checks if an artifact-free harness exists; otherwise record `skipped_environment_unavailable_safe_browser_harness_missing` and continue.
6. For RWO-06 through RWO-08B, run only Trial live/fullflow checks that have approved non-S3 runtime paths and safe evidence modes; if the only blocker is object-storage startup coupling, first process the active RWO-06A non-S3 runtime-profile handoff.
7. For RWO-06B through RWO-06F, batch multiple reachability checks in one automation run when each check has independent preflight, wrapper, parser, business-success criteria, and sanitized evidence; record per-endpoint blockers and continue to independent safe checks.
8. Complete RWO-09 non-S3 security/secret handling, CI/static evidence, packaging, rollback, and non-claim updates that are possible without unavailable runtime services.
9. Complete RWO-10 production ORCA non-claim docs-only marker.
10. Complete RWO-11 final Trial-backed non-S3 summary as far as evidence allows, with any remaining runtime-dependent gates listed as skipped or pending rather than overclaimed.

## Why This Sequence Is Safe

The sequence avoids using live ORCA to discover basic browser or local persistence defects. It first closes documentation and browser-local gaps, then expands live ORCA narrowly with explicit owner approval and sanitized evidence rules. Fullflow is placed after endpoint-level live evidence so that a failure can be classified from either artifact-free evidence or owner-approved local diagnostic artifacts without committing raw content.

## Task Classes

| Task class | Work Orders | Notes |
|---|---|---|
| Docs-only | RWO-01 | No runtime or live execution. |
| Browser tests | RWO-02, RWO-03, RWO-04, RWO-05 | No live ORCA; sanitized evidence only. |
| Non-S3 runtime blocker resolution | RWO-06A | Repo-local implementation/docs/tests for an object-storage-free dev/Trial profile; no dummy S3/MinIO and no storage readiness claim. |
| Live ORCA requiring explicit owner approval | RWO-06, RWO-06B, RWO-06C, RWO-06D, RWO-07, RWO-08, RWO-08B | Trial credentials/config required through approved channel; diagnostic fullflow artifacts may be captured only local-only/untracked and never committed/packaged; skip if S3/MinIO/object-storage config is required. RWO-06 `medicalmodv2` has standing iterative retry approval after repo-local fix and focused no-live verification. RWO-06B through RWO-06D may batch multiple reachability checks per automation run when every check remains independently scoped and sanitized. Repeated unchanged live sends after a failure are forbidden; retry approval is for fix-and-retry cycles only. |
| Release-readiness without production ORCA or S3 execution | RWO-09, RWO-11 | Includes CI, non-S3 deployment config, rollback, owner sign-off, and explicit production-ORCA/S3 non-claims. |
| Production ORCA out-of-scope marker | RWO-10 | Records that production ORCA execution/readiness is not part of this Trial-only roadmap. |

No background or asynchronous work is claimed by this roadmap.

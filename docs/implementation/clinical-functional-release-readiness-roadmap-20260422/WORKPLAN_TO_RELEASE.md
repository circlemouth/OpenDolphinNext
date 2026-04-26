# Workplan To Release

RUN_ID: `20260422T134401Z`

## ORCA Connection Scope

This roadmap assumes WebORCA / ORCA Trial as the only ORCA connection target. Production ORCA connectivity, production ORCA credentials, and production ORCA functional execution are out of scope for this automation and are not required to advance the roadmap.

Trial evidence must not be used to claim production ORCA readiness. If production ORCA readiness is requested later, it requires a separate owner-approved production plan outside this roadmap.

## Automation Responsibility Boundary

`RWO-11/RWO-09` rollback rehearsal, final owner GO/NO-GO/PENDING, release-candidate deployment stop, paired restore, restored-target smoke, and operator acceptance are external owner/operator release-management gates. They remain claim-boundary context, but they are not work assigned to this automation.

Automation workers must not select, execute, reclassify, or block on `RWO-11/RWO-09`. When these gates appear in a queue, prompt, matrix, or summary, workers should preserve the non-claim boundary and immediately proceed to the next safe task outside `RWO-11/RWO-09`.

## ORCA Official Specification Research

If an ORCA task is blocked by unclear endpoint semantics, request numbers, class codes, row ordering, master lookup behavior, sample payload shape, or endpoint-specific business success criteria, the automation should actively perform web research before selecting the next executable task or preparing live evidence.

Research must prefer ORCA official sources first:

- [ORCA API overview](https://www.orca.med.or.jp/receipt/tec/api/overview.html)
- ORCA endpoint specification pages under `https://www.orca.med.or.jp/receipt/users/tec/api/`
- official endpoint pages discovered from the API overview, including pages such as `medicalmod.html`, `medicationgetv2.html`, and `diseasemod2.html`

Public/non-official sources may be used only as secondary leads. Endpoint semantics must be confirmed against ORCA official documentation or recorded as unconfirmed. Committed research evidence must be sanitized and limited to source URL, checked date, endpoint/request-class identity, request number/class/code mapping, derived no-live next action, and claim boundary. Official-source research is no-live evidence only; it can justify payload drafting, parser/sanitizer tests, wrapper dry-runs, read-only probes, or queue reordering, but it does not authorize live Trial mutation by itself.

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

Hourly workers must use the executable queue in `docs/implementation/automation-handoff/HANDOFF_STATE.json` before falling back to this prose queue. The queue separates work into `critical_path`, `parallel_no_live`, and `human_pending` lanes. `RWO-11/RWO-09` rollback rehearsal and owner GO/NO-GO are outside automation scope and must not be selected or rechecked by automation; preserve them as external claim-boundary gates and continue to the next executable non-human, non-RWO-11/RWO-09 item.

The queue may contain several safe no-live tasks. Workers should process more than one item per run when possible, especially official ORCA specification research, docs, parser/sanitizer tests, wrapper dry-runs, read-only preflight plans, static guards, and matrix updates. Live Trial mutation is the exception: it remains one endpoint, one target, one request class, one payload identity, and one sanitized attempt at a time.

Before any live Trial mutation, the corresponding endpoint packet must be complete. A complete packet includes payload SHA, endpoint/request class, target identity, duplicate-live checkpoint, no-live wrapper result, parser/sanitizer result, runtime readiness, endpoint-specific business-success criteria, stop conditions, and explicit sanitized evidence boundaries.

When independent tasks can progress in parallel, the main automation worker may delegate bounded subagent work in the same run. Delegated tasks must have disjoint write scopes and dedicated git worktrees. Suitable scopes are source-backed research, docs/matrix refreshes, no-live payload preparation, parser/sanitizer tests, static guards, package metadata checks, and sanitized evidence drafts. The main worker remains responsible for safety review, claim boundaries, integration, verification, and the final commit.

Parallel delegation does not change live Trial safety. Live ORCA Trial mutations must not be run by subagents or in parallel. The main worker must run live Trial actions sequentially, one endpoint/target/request-class/payload identity at a time, after reviewing any subagent-prepared no-live evidence and preflight materials.

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
12. RWO-06F/RWO-06F2: verify `instractionChargeOrder` / `指導料` representative Trial reachability before broader charge/order families; v1 is safely tested but Trial-rejected. RUN_ID `20260425T215740Z` intook source-backed no-live candidate research and keeps `113001810` as the prepared candidate, but live remains blocked until disease/facility/monthly billing context is proven and no-live checks pass.
13. RWO-06G: run the no-live-prepared `baseChargeOrder` / `基本診療料` class `110` Trial classification through the same wrapper; v1 was Trial-rejected. RUN_ID `20260425T215740Z` keeps `111000110` as the prepared candidate, but live remains blocked unless a first-visit-compatible Trial encounter state is proven.
14. RWO-06H: investigate and verify `injectionOrder` / `注射` class `310` through a separate payload identity; v1 was safely tested but Trial-rejected. RUN_ID `20260425T215740Z` prioritizes no-live progression of existing candidate `130000510` after medication/material master and wrapper contract checks.
15. RWO-06I: investigate and verify `surgeryOrder` / `手術` class `500` through a separate payload identity; v1 was safely tested but Trial-rejected and must not be repeated. RUN_ID `20260425T010143Z` prepared source-backed v2 candidate `150003110` with passing no-live wrapper/contract evidence. RUN_ID `20260425T020245Z` executed one sanitized live Trial checkpoint for that v2 identity; runtime readiness was `200` / `200`, HTTP status was `200`, parsed API result was `80`, and the endpoint-specific classification was `businessRejected`. Do not repeat the unchanged v2 identity without no-live investigation plus a concrete fix or changed Trial/business precondition.
16. RWO-06J: investigate and verify `testOrder` / `検査` class `600` through a separate payload identity; v1 was safely tested but Trial-rejected and must not be repeated without a justified v2 candidate.
17. RWO-06K: investigate and verify `radiologyOrder` / `画像診断` class `700` through a separate payload identity; v1 was safely tested but Trial-rejected and must not be repeated. RUN_ID `20260424T225533Z` prepared source-backed v2 candidate `002000099+170027910` with passing no-live wrapper/contract evidence. RUN_ID `20260425T001701Z` executed one sanitized live Trial checkpoint for that v2 identity; runtime readiness was `200` / `200`, HTTP status was `200`, parsed API result was `80`, and the endpoint-specific classification was `businessRejected`. Do not repeat the unchanged v2 identity without no-live investigation plus a concrete fix or changed Trial/business precondition.
18. RWO-07: enumerate and test all electronic-chart user operations that map to Request_Number 02/03/04 or equivalent update/delete/cancel semantics, with endpoint-specific wrappers and success criteria.
19. RWO-08: fullflow after browser and live endpoint prerequisites, using artifact-free mode or owner-approved diagnostic fullflow mode.
20. RWO-08B: fullflow reachability variants, batched through artifact-free or diagnostic mode with only sanitized extracted evidence committed.
20. RWO-09: security, secrets, CI, package, deployment readiness without production ORCA execution or S3/MinIO/object-storage setup.
21. RWO-10: record production ORCA as out-of-scope / not applicable for this Trial-only roadmap.
22. RWO-11: final Trial-backed release candidate validation and owner sign-off. This is an external owner/operator release-management gate and is not assigned to this automation.

## Current Safe Work Queue

When the active handoff is superseded or skipped, process this queue in order and continue until no safe task remains:

1. Record any skipped active handoff or Work Order in `HANDOFF_STATE.json`, the gate matrix, and the final summary.
2. Complete or refresh RWO-01 claim-boundary docs under standing Trial approval; if explicit owner sign-off is absent, mark it `pending_owner_signoff` and continue.
3. Run repo-local static/contract checks that do not need runtime secrets, production ORCA, S3/object storage, or committing raw diagnostic artifacts.
4. Run unit/component tests and wrapper dry-runs that do not require unavailable runtime services or committing raw diagnostic artifacts.
5. For RWO-02 through RWO-05, run only artifact-safe no-live browser checks if an artifact-free harness exists; otherwise record `skipped_environment_unavailable_safe_browser_harness_missing` and continue.
6. For RWO-06 through RWO-08B, run only Trial live/fullflow checks that have approved non-S3 runtime paths and safe evidence modes; if the only blocker is object-storage startup coupling, first process the active RWO-06A non-S3 runtime-profile handoff.
7. For RWO-06B through RWO-06F and later endpoint families, batch multiple reachability checks in one automation run when each check has independent preflight, wrapper, parser, business-success criteria, and sanitized evidence. If endpoint semantics are unclear, first perform official ORCA specification research and record sanitized no-live findings. RUN_ID `20260425T030245Z` prepared no-live v2 candidates for `instractionChargeOrder/130`, `baseChargeOrder/110`, and `injectionOrder/310`; RUN_ID `20260425T215740Z` added source-backed no-live candidate research for these and the rejected surgery/test/radiology families. No live Trial should run from research alone; live progression still requires endpoint-specific Trial/business preconditions, no-live wrapper checks, runtime readiness, sanitized preflight, and duplicate-checkpoint preflight.
8. Complete RWO-09 non-S3 security/secret handling, CI/static evidence, packaging, rollback, and non-claim updates that are possible without unavailable runtime services.
9. Complete RWO-10 production ORCA non-claim docs-only marker.
10. Do not execute or reclassify RWO-11 rollback/owner decision work. Keep it as an external owner/operator gate and continue only with non-RWO-11 automation tasks.

## Why This Sequence Is Safe

The sequence avoids using live ORCA to discover basic browser or local persistence defects. It first closes documentation and browser-local gaps, then expands live ORCA narrowly with explicit owner approval and sanitized evidence rules. Fullflow is placed after endpoint-level live evidence so that a failure can be classified from either artifact-free evidence or owner-approved local diagnostic artifacts without committing raw content.

## Task Classes

| Task class | Work Orders | Notes |
|---|---|---|
| Docs-only | RWO-01 | No runtime or live execution. |
| Browser tests | RWO-02, RWO-03, RWO-04, RWO-05 | No live ORCA; sanitized evidence only. |
| Non-S3 runtime blocker resolution | RWO-06A | Repo-local implementation/docs/tests for an object-storage-free dev/Trial profile; no dummy S3/MinIO and no storage readiness claim. |
| Live ORCA requiring explicit owner approval | RWO-06, RWO-06B, RWO-06C, RWO-06D, RWO-07, RWO-08, RWO-08B | Trial credentials/config required through approved channel; diagnostic fullflow artifacts may be captured only local-only/untracked and never committed/packaged; skip if S3/MinIO/object-storage config is required. RWO-06 `medicalmodv2` has standing iterative retry approval after repo-local fix and focused no-live verification. RWO-06B through RWO-06D may batch multiple reachability checks per automation run when every check remains independently scoped and sanitized. Repeated unchanged live sends after a failure are forbidden; retry approval is for fix-and-retry cycles only. |
| Release-readiness without production ORCA or S3 execution | RWO-09 | Includes CI, non-S3 deployment config, package/security checks, and explicit production-ORCA/S3 non-claims. RWO-11 owner/rollback gates are external and not automation-owned. |
| Production ORCA out-of-scope marker | RWO-10 | Records that production ORCA execution/readiness is not part of this Trial-only roadmap. |

No background or asynchronous work is claimed by this roadmap.

## Parallel Work Model

One automation run may advance multiple roadmap areas when the work is independent and safe to split. The recommended model is:

1. The main worker selects the highest-priority blocking path and keeps the critical path local.
2. The main worker may assign sidecar tasks to subagents only when those tasks do not block the next local step.
3. Each subagent uses a dedicated worktree and owns a clearly listed file/module scope.
4. Subagents produce sanitized evidence or patches only; the main worker reviews and integrates them.
5. The final commit is made from the main worktree after all integrated changes pass relevant checks.

This model is intended to increase same-run throughput for independent no-live and documentation work. It is not permission to parallelize live Trial mutations, share runtime secrets, operate on another worktree's containers, widen the roadmap scope, or relax claim boundaries.

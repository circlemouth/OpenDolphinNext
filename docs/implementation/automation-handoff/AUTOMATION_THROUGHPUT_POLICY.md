# Automation Throughput Policy

RUN_ID: `20260426T145500Z`

This policy reduces hourly automation stalls while preserving the Trial-only, non-S3, sanitized-evidence safety boundary.

## Automation Responsibility Boundary

Current automation prompt boundary recorded by RUN_ID `20260427T104612Z` and reaffirmed by owner instruction in RUN_ID `20260427T125006Z` treats `RWO-11/RWO-09` rollback rehearsal, release-candidate deployment stop, paired restore, restored-target smoke, operator acceptance, and final owner GO/NO-GO/PENDING decision capture as external owner/operator release-management gates.

Hourly automation must not select, execute, repeatedly reclassify, or block on those `RWO-11/RWO-09` gates. The current owner instruction is that these gates are not performed by this automation. Preserve the non-claim boundary and continue to the next safe non-RWO-11/RWO-09 task. A later explicit owner instruction is required to change this boundary.

## Problem

The hourly `orca` automation can spend too much time re-reading the same human-pending blocker, especially when rollback rehearsal or final owner GO/NO-GO is still absent. That is safe, but it slows progress on independent no-live work that could unblock later Trial checks.

## Task Lanes

Automation work is split into three lanes:

| Lane | Meaning | Examples | Hourly behavior |
|---|---|---|---|
| `critical_path` | Work that directly unblocks the next endpoint or release gate. | runtime readiness, read-only ORCA Trial preflight, duplicate-live checkpoint, parser/sanitizer contract. | Run first when safe and prerequisites are available. |
| `parallel_no_live` | Work that can progress without live mutation or secrets. | docs/matrix refresh, wrapper dry-run, static guards, no-live payload prep, rejected-result investigation. | Run in the same automation run after the critical path or after a skip. |
| `human_pending` | Work that cannot be completed by automation alone. | billing mapping decision, business context confirmation, final owner decision when explicit owner text is absent. | Check only when the item is inside automation scope and new explicit input exists; otherwise carry forward or mark pending, then continue. `RWO-11/RWO-09` rollback/owner decision gates are outside automation scope under the current prompt boundary. |

## Machine-Readable Queue

`HANDOFF_STATE.json` should include `nextExecutableQueue`. Each item is an executable or skippable unit:

```json
{
  "taskId": "RWO-06H_READONLY_MASTER_VALIDITY",
  "lane": "critical_path",
  "status": "queued",
  "workOrder": "RWO-06H",
  "summary": "Run sanitized read-only medicationgetv2/masterlastupdatev3 checks for injectionOrder/310 v2.",
  "requiresRuntime": true,
  "requiresLiveTrialMutation": false,
  "requiresHumanDecision": false,
  "requiresS3ObjectStorage": false,
  "safeToBatchWithNoLiveTasks": true,
  "skipCondition": "runtime unavailable or safe read-only wrapper missing",
  "successCriteria": "sanitized read-only master-validity evidence exists with credentialsCaptured=false and rawArtifactsCommittedOrPackaged=false",
  "nextOnSuccess": "RWO-06H_DUPLICATE_CHECKPOINT_PREFLIGHT",
  "nextOnSkip": "RWO-06G_NO_LIVE_FIRST_VISIT_PLAN"
}
```

Workers must process the queue from top to bottom, selecting the first item that is safe and currently executable. After a completed or skipped item, the worker should continue to the next safe independent item until the run budget or a real stop condition is reached.

## Stale Human Blockers

For `human_pending` items, do not repeat the same long-form classification every hour. `RWO-11/RWO-09` rollback rehearsal, operator acceptance, and final owner GO/NO-GO/PENDING are external release-management gates under the current automation prompt boundary. Workers should:

1. Check whether a new explicit owner/operator evidence file, state entry, or prompt text exists.
2. If the item is `RWO-11/RWO-09`, preserve it as external/out-of-scope for automation without reclassification.
3. Continue immediately to the next non-human, non-RWO-11/RWO-09 queue item.

This does not weaken the blocker. It only prevents hourly runs from spending most of the budget proving the same absence again.

## Official ORCA Specification Research

When a queue item is blocked by unclear ORCA API semantics, request numbers, class codes, row ordering, master lookup behavior, or endpoint-specific business success criteria, the next safe automation action should be no-live specification research before task selection or live preparation.

Research must prefer ORCA official sources first:

- `https://www.orca.med.or.jp/receipt/tec/api/overview.html`
- endpoint pages under `https://www.orca.med.or.jp/receipt/users/tec/api/`
- official endpoint pages discovered from the API overview, such as `medicalmod.html`, `medicationgetv2.html`, or `diseasemod2.html`

Public/non-official sources may be used only as secondary leads and must be confirmed against official ORCA documentation before they influence endpoint semantics. Record sanitized research evidence only: checked URL, checked date, endpoint/request class, relevant request number/class/code mapping, derived no-live next action, and claim boundary. Research may justify payload drafting, parser/sanitizer tests, wrapper dry-runs, read-only probes, or queue reordering, but it is not live Trial acceptance evidence and does not authorize live mutation by itself.

## Endpoint Packets

Before a live Trial mutation, the queue item should point to a complete endpoint packet. The packet must include:

- endpoint and request class;
- target identity and payload SHA-256;
- exact duplicate-live checkpoint key;
- no-live wrapper dry-run result;
- parser/sanitizer contract result;
- runtime readiness result;
- endpoint-specific business-success criteria;
- stop conditions;
- claim boundary;
- `credentialsCaptured=false`;
- `rawArtifactsCommittedOrPackaged=false`.

If the packet is incomplete, the worker must complete or skip the missing no-live/read-only preflight instead of running live.

## Same-Run Batching

Live Trial mutation remains sequential and main-worker controlled. No-live work may be batched in one run when each item has an independent scope and writes separate evidence paths.

Good same-run batches:

- RWO-06H read-only master-validity preflight plus RWO-06G no-live first-visit plan.
- RWO-06F disease/monthly precondition plan plus RWO-07 operation matrix update.
- RWO-06K official-spec research plus no-live payload/contract refinement.
- RWO-09 static/package refresh plus RWO-10 production-ORCA non-claim docs.
- RWO-08B local exact-match taxonomy review plus RWO-06H RN01/RN02 parser-contract split, when both stay repo-local and no runtime/live mutation is used.

Forbidden batches:

- two live Trial mutations;
- live mutation plus unresolved target ambiguity;
- any S3/MinIO/object-storage setup;
- any task requiring raw ORCA body, raw patient/insurance detail, credentials, or committed diagnostic artifacts.

## Status Values

Queue item status should use:

- `queued`
- `in_progress`
- `completed`
- `skipped_environment_unavailable`
- `skipped_s3_required_out_of_scope`
- `blocked_human_decision`
- `blocked_safety_stop`
- `superseded`

No-live progress should be recorded with specific result labels such as `preflight_plan_ready`, `readonly_validated`, `runtime_preflight_blocked`, `live_ready_pending_single_attempt`, `business_accepted`, or `business_rejected_no_retry_without_changed_precondition`.

## Current Priority

Do not select `RWO-11/RWO-09` rollback/owner-decision work in hourly automation. Treat it as an external release-management gate and continue to independent safe tasks such as official ORCA specification research, no-live endpoint packets, parser/sanitizer tests, wrapper dry-runs, read-only probes, static/package/security checks, and claim-boundary updates. Do not run a live mutation until endpoint packet preconditions are recorded.

After RUN_ID `20260427T125006Z`, the next active blocker-resolution task is `RWO-08B_LOCAL_EXACT_MATCH_DIAGNOSTIC`. It exists to split the coarse `local_exact_match_missing` fullflow blocker into actionable sanitized categories before any exact selected-candidate preflight or fullflow discussion. This research intake is sufficient for no-live/read-only tasks only; it is not live retry authorization.

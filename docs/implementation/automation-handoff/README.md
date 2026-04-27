# Automation Handoff

This directory defines the repo-local handoff contract used by recurring Codex automation when a worker hits a blocker.

## File Roles

| Path | Role |
|---|---|
| `NEXT_WORKER_PROMPT.md` | Highest-priority active task for the next automation run. |
| `AUTOMATION_PROMPT.md` | Full prompt to register in the hourly Codex automation. |
| `HANDOFF_STATE.json` | Machine-readable current handoff status. |
| `AUTOMATION_THROUGHPUT_POLICY.md` | Rules for executable queues, stale human blockers, and same-run batching. |
| `templates/NEXT_WORKER_PROMPT_TEMPLATE.md` | Template for future blocker handoffs. |
| `history/` | Completed or superseded handoff prompts may be archived here. |

## Automation Rule

Before selecting work from any roadmap, recurring automation must check this directory first.

Priority order:

1. `docs/implementation/automation-handoff/NEXT_WORKER_PROMPT.md`
2. Newest `docs/implementation/*/NEXT_WORKER_PROMPT.md`
3. Current roadmap / Work Order docs

If a handoff prompt is active, the next worker must treat it as the next task unless it conflicts with global safety rules. If a conflict exists, the stricter rule wins and the conflict must be reported.

## Executable Queue Rule

Hourly workers must read `HANDOFF_STATE.json.nextExecutableQueue` after checking the active prompt. The queue is the machine-readable source for the next safe task. It is allowed, and preferred, to complete or skip multiple queue items in one run when each item is independent and stays inside the Trial-only, non-S3, sanitized-evidence scope.

Queue items are grouped into lanes:

- `critical_path`: directly unblocks the next endpoint or release gate.
- `parallel_no_live`: can progress without live mutation, secrets, or raw artifacts.
- `human_pending`: needs owner/operator or business input and cannot be completed by automation alone.

For `human_pending` items, workers should check only for new explicit input. If none exists, record or carry forward `carried_forward_without_reclassification` and continue to the next non-human queue item. Do not re-record the same blocker classification every hour.

Before live Trial mutation, the corresponding endpoint packet must be complete: payload SHA, endpoint/request class, target, duplicate checkpoint, no-live wrapper result, parser/sanitizer result, runtime readiness, business-success criteria, stop conditions, and sanitized evidence policy. If any part is missing, the worker must complete or skip that no-live/read-only preflight instead of running live.

If the active blocker can be removed by an ORCA Trial operation that is inside the current scope, the worker should perform that operation through an approved safe wrapper instead of asking the owner to operate ORCA manually. This includes Trial-only prerequisite setup or cleanup such as acceptance creation, update/delete target preparation, or auxiliary Trial operations, provided production ORCA, S3/object storage, raw artifacts, raw patient/insurance detail, credentials, and external release-management gates remain out of scope. After such an operation, rerun the relevant read-only/probe evidence before any dependent live mutation.

## Parallel Subagent Rule

The main automation worker may use subagents inside one run when independent roadmap tasks can safely progress in parallel. This is allowed only for bounded, non-overlapping work such as docs updates, source-backed research, no-live payload preparation, parser/sanitizer tests, static guards, package metadata checks, and sanitized evidence drafting.

The main worker remains responsible for orchestration, safety decisions, final evidence review, integration, verification, and the final commit. Subagents must be assigned explicit ownership of their worktree, files, task scope, forbidden actions, expected evidence, and stop conditions. Each subagent must use its own dedicated git worktree and must not operate on another worker's containers or worktree.

Parallel subagents must not execute live ORCA Trial mutations, production ORCA actions, S3/MinIO/object-storage setup, credential handling, raw artifact capture, reviewer packet packaging, broad refactors, or changes under legacy `client/` or `server/`. Live Trial work remains sequential and main-worker controlled: one endpoint, one target, one request class, one payload identity, one sanitized preflight/attempt at a time.

When subagents are used, the final report and handoff state must record the subagent scopes, worktrees, changed files, integrated evidence, checks run by each worker, and any discarded or unmerged outputs. If a subagent blocks, the main worker records a sanitized blocker and continues only with independent safe work.

## Commit Rule

Every worker that changes tracked or newly generated repo evidence files must commit those changes before reporting completion. The commit must include only reviewed, relevant roadmap/handoff/source changes, must not include local runtime secret files or forbidden raw artifacts, and must be created after the relevant tests/checks pass or after a documented sanitized skip record is written.

If the worktree contains unrelated user or worker changes, do not revert them. Either leave unrelated changes uncommitted with a clear report, or include only the changes that are part of the current roadmap/handoff task when they can be safely staged separately.

## Status Values

| Status | Meaning |
|---|---|
| `active` | Next automation run should execute this prompt first. |
| `blocked` | Prompt is still relevant but cannot proceed without missing prerequisite. |
| `completed` | Prompt was executed and should be archived. |
| `superseded` | Another prompt replaced this one. |

## Global Safety Floor

No handoff prompt may authorize:

- production ORCA execution without separate production approval
- credential/password/cookie/token/session capture
- raw ORCA request/response body capture
- raw patient or insurance detail capture
- HAR, trace, video, screenshot, or raw network dump capture
- `env`, `printenv`, `set`, `history`, or `set -x`
- treating HTTP 200, wrapper exit 0, dry-run, precheck, not_run, not_verified, or owner-waived evidence as business success

## Live Retry Semantics

When the owner authorizes "up to 3 live wrapper attempts" for a failing Trial endpoint, that means up to 3 `try -> investigate -> fix -> no-live verify -> retry` cycles for the same approved endpoint/target/request-class/payload identity.

It does not authorize sending the identical live request repeatedly after the same failure. After any live failure, the next live attempt is forbidden until a worker has documented a concrete changed precondition, preferably a repo-local fix with focused no-live verification. If no concrete fix or changed precondition exists, record the blocker and continue to independent safe work instead of consuming another live attempt.

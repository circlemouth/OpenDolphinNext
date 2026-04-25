# Automation Handoff

This directory defines the repo-local handoff contract used by recurring Codex automation when a worker hits a blocker.

## File Roles

| Path | Role |
|---|---|
| `NEXT_WORKER_PROMPT.md` | Highest-priority active task for the next automation run. |
| `AUTOMATION_PROMPT.md` | Full prompt to register in the hourly Codex automation. |
| `HANDOFF_STATE.json` | Machine-readable current handoff status. |
| `templates/NEXT_WORKER_PROMPT_TEMPLATE.md` | Template for future blocker handoffs. |
| `history/` | Completed or superseded handoff prompts may be archived here. |

## Automation Rule

Before selecting work from any roadmap, recurring automation must check this directory first.

Priority order:

1. `docs/implementation/automation-handoff/NEXT_WORKER_PROMPT.md`
2. Newest `docs/implementation/*/NEXT_WORKER_PROMPT.md`
3. Current roadmap / Work Order docs

If a handoff prompt is active, the next worker must treat it as the next task unless it conflicts with global safety rules. If a conflict exists, the stricter rule wins and the conflict must be reported.

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

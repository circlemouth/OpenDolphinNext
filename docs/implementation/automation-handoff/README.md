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

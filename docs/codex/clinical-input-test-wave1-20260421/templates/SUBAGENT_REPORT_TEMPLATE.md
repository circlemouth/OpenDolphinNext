# Subagent report template

## Agent identity

```text
agent id:
model: gpt 5.4 high
worktree path:
branch name:
base branch:
base commit:
start time:
end time:
```

## Forbidden-action attestation

```text
external web used: no
live ORCA mutation: no
Phase 3/4/fullflow: no
production code changed: yes/no
raw HAR/trace/video/screenshot included: no
```

If production code changed, explain why and whether coordinator approved it.

## Scope completed

| Item | Status | Notes |
|---|---:|---|
| | done/partial/not done | |

## Changed files

| File | Type | Reason |
|---|---|---|
| | test / fixture / utility / doc / production | |

## Tests added

| Test file | Test name | Purpose | Boundary |
|---|---|---|---|
| | | | local/server/static/MSW |

## Commands run

| Command | CWD | Result | Exit code | Output summary |
|---|---|---:|---:|---|
| | | PASS/FAIL/NOT RUN | | |

## Not-run commands

| Command or suite | Reason |
|---|---|
| | |

## Failures / blockers

| Blocker id | Severity | Area | Description | Proposed next action |
|---|---:|---|---|---|
| | Critical/High/Medium/Low | | | |

## ORCA boundary statement

Write the exact statement for your agent:

```text
<Agent X> did not perform live ORCA mutation. All test evidence is local/server/static/MSW only and must not be described as live ORCA success.
```

## Merge recommendation

Choose one:

- merge as-is
- merge after conflict resolution
- do not merge; failing tests expose production blocker
- do not merge; needs source expansion
- do not merge; test harness ambiguous

Explain briefly.

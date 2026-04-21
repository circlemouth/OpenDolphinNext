# Merge decision template

## Branch

```text
subagent:
branch:
worktree:
base commit:
merge target:
```

## Diff review

| Check | Result | Notes |
|---|---:|---|
| test-only changes | pass/fail | |
| no live ORCA calls | pass/fail | |
| no external web artifacts | pass/fail | |
| no raw HAR/trace/video/screenshot | pass/fail | |
| no production logic changes | pass/fail | |
| no generated build artifacts | pass/fail | |
| report present | pass/fail | |

## Test result summary

| Command | Result | Notes |
|---|---:|---|
| | PASS/FAIL/NOT RUN | |

## Merge decision

Choose one:

- merge
- merge with conflict resolution
- hold branch due failing production blocker
- reject branch due scope violation
- ask subagent for revision

## Rationale

Write concise rationale.

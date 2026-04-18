# 06 final report template

Codex manager は作業後、以下の形式で final report を作る。

```markdown
# OpenDolphinNext post-fix static remediation report

## 1. overall verdict

- ACCEPT WORKER REPORT / PARTIAL / NEEDS REOPEN / REJECT WORKER REPORT

## 2. dynamic handoff verdict

- READY FOR DYNAMIC TRIAL CHECK / NOT READY FOR DYNAMIC TRIAL CHECK

## 3. changed files

| path | change type | reason | linked claim |
|---|---|---|---|

## 4. claim closure matrix

| claim | accepted / partial / rejected / not verified | strongest evidence | representative files | evidence type | why |
|---|---|---|---|---|---|
| C1 | | | | source/test/rerun/docs-only/not verified | |
| C2 | | | | | |
| C3 | | | | | |
| C4 | | | | | |
| C5 | | | | | |
| C6 | | | | | |
| C7 | | | | | |
| R-OBS-01 | | | | | |
| T-NEG-01 | | | | | |
| RT-01 | | | | | |
| older follow-up docs cleanup | | | | | |
| pass area guard | | | | | |
| static_exit_status | | | | | |
| dynamic_handoff_readiness | | | | | |

## 5. test execution evidence

| command | cwd | exit code | log path | accepted? | notes |
|---|---|---:|---|---|---|

Rules:
- Only commands actually run with saved logs can be accepted.
- Not-run commands must be listed as not run if they were part of expected evidence.
- Green command does not erase coverage gaps.

## 6. residual blockers

| blocker | severity | root cause type | affected area | file paths | why it matters | next action |
|---|---|---|---|---|---|---|

## 7. pass area regression guard

| area | preserved / regressed / not fully verified | evidence | caveat |
|---|---|---|---|
| reception official flow | | | |
| administration / manageusers / connection wording | | | |
| C1/C2 core fail-close / sanitize | | | |
| C4 current OrcaSummary direction | | | |
| send success != paid | | | |
| route taxonomy public surface | | | |

## 8. dynamic/live ORCA status

State explicitly:
- live ORCA / WebORCA was not run in this static remediation, unless it actually was run under an explicit dynamic task.
- No live success is claimed.
- Dynamic trial remains separate from static exit.

## 9. final recommendation

1. static fix status
2. docs/test alignment status
3. dynamic ORCA trial check readiness
```

# 12. Report templates

## Main agent report template

```text
# MAIN_AGENT_REPORT

## Work Order
- id:
- branch:
- commit:
- source_commit:
- worktree_clean:

## Scope
- included:
- excluded:

## No-run confirmations
- Phase 3 rerun:
- Phase 4:
- fullflow:
- live ORCA mutation:

## Subagents
| subagent | worktree | branch | scope | result |
|---|---|---|---|---|

## Changed files

## Commands
| command | cwd | start | end | exit_code | result |
|---|---|---|---|---:|---|

## Evidence/package
- package path:
- sha256:
- size:
- file count:
- final ZIP scan target hash:
- artifact ledger result:
- secret scan result:

## Findings

## Remaining blockers

## Next Work Order recommendation
```

## Work Order final summary template

```text
# FINAL_SUMMARY

- workOrder:
- source_branch:
- source_commit:
- packageMode:
- worktree_clean:
- full_source_secret_scan_claim:
- package_source_secret_scan_claim:
- dynamic_evidence_secret_scan_claim:
- Phase 3 rerun: not_run
- Phase 4: not_run
- fullflow: not_run
- new mutation: no_new_mutation
- may_start_next_work_order:
- may_run_phase4: no
```

## Subagent report template

```text
# SUBAGENT_REPORT

- subagent:
- worktree:
- branch:
- commit:
- scope:
- files changed:
- tests run:
- exit codes:
- findings:
- not verified:
- handoff notes:
```

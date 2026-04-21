# 06. WO-5 Phase 4 handoff preparation only

## Scope

Prepare Phase 4 handoff docs. Do not execute Phase 4.

## Required checks

- Phase 3 was not rerun in WO-1/WO-2/WO-3/WO-4.
- Phase 4 remains not_run.
- fullflow remains not_run.
- `00002`〜`00011` mutation remains not_run.
- Phase 3 accepted evidence can be referenced by sanitized evidence only.
- current package has static checks green or explicit waiver evidence.

## Handoff runbook required sections

- Phase 4 is not approved by this Work Order.
- Required inputs:
  - Phase 3 accepted evidence package
  - candidate 00001 only
  - acceptance ID / encounter key if sanitized evidence includes them
  - C7 dynamic gate accepted
  - static checks green or waiver accepted
  - final package scan for current package
- Required prechecks:
  - no second Phase 3 retry
  - source_commit matches artifact summary
  - package hash verified
  - raw artifacts absent
  - Phase 4 command guard reviewed
- Forbidden:
  - Phase 4 without explicit approval
  - fullflow
  - mutation of 00002〜00011
  - old artifact replay
- Required future Phase 4 evidence:
  - sanitized JSON/MD
  - relevant gates C5/C3/C6/C7 as applicable
  - dynamic secret scan
  - final package source-scope scan
  - no raw/browser/network artifacts

## Output directory

```text
docs/implementation/unified-phase4-handoff-wo5-20260421/
```

## Acceptance

- Phase 4 handoff docs complete.
- no Phase 4 execution.
- final recommendation says whether Phase 4 prompt may be prepared.

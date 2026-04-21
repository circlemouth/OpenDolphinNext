# 01. Execution strategy: unified plan without a giant task

## Why not one huge Codex prompt

The combined ORCA post-retry + Clinical Wave 1 scope is too broad for a single undivided Codex run. It touches:

- ORCA evidence/package hygiene
- C7/business evidence hardening
- static TypeScript/build/test failures
- DADS UI contract
- clinical persistence server tests
- local chart/document save/reload behavior
- Phase 4 handoff docs

Running all of this in one wave risks merge conflicts, hidden test failures, accidental overclaiming, and duplicated ORCA mutation attempts.

## Unified but staged model

Use one integration branch and one master plan, but execute in bounded Work Orders.

- Work Orders are sequential.
- Each Work Order has a stop point and review package.
- Subagents may run inside a Work Order, but not across all Work Orders at once.
- Maximum simultaneous active subagents: 2 by default, 3 only when conflicts are unlikely.
- Main agent owns merge order, conflict resolution, report alignment, package creation.

## Recommended current sequence

1. WO-0 Inventory and docset install
2. WO-1 ORCA post-retry evidence/C7 hardening
3. ChatGPT review of WO-1
4. WO-2 Static/DADS recovery
5. ChatGPT review of WO-2
6. WO-3 Clinical Wave 1 batch 1: CWP-01 + CWP-05 + CWP-02
7. ChatGPT review of WO-3
8. WO-4 Clinical Wave 1 batch 2: CWP-04 + CWP-03 + CWP-06
9. ChatGPT review of WO-4
10. WO-5 Phase 4 handoff docs only

## Integration branch naming

Main integration branch:

```text
codex/unified-orca-postretry-clinical-wave1-main-20260421
```

Per Work Order branch examples:

```text
codex/wo1-orca-postretry-hardening-20260421
codex/wo2-static-dads-recovery-20260421
codex/wo3-clinical-wave1-batch1-20260421
codex/wo4-clinical-wave1-batch2-20260421
codex/wo5-phase4-handoff-docs-20260421
```

## Stop point rule

At the end of each Work Order:

- create a package/review folder under `docs/implementation/...`
- include command logs, summaries, subagent reports, artifact hash ledger, scan logs
- state what was not run
- state whether next Work Order may start
- do not silently roll into the next Work Order

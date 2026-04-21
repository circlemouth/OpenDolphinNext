# 02. Work Orders

## WO-0: Inventory and docset install

Goal: install this docset into the repo and record initial state.

Required actions:

```bash
git branch --show-current
git rev-parse HEAD
git status --short
```

Place the docset at:

```text
docs/codex/unified-orca-postretry-clinical-wave1-20260421/
```

Acceptance:

- docset installed
- current branch / HEAD / status recorded
- Phase 3 retry already executed and must not be rerun
- no mutation run in WO-0

## WO-1: ORCA Phase 3 post-retry evidence/C7 hardening

Goal: fix evidence hygiene and harden C7/business evidence, without any new mutation.

Includes:

- final ZIP scan target hash validation
- artifact ledger presence/verification
- timestamped command logs
- run ID split: phase3ExecutionRunId / preflightIdentityRunId / childHarnessEvidenceRunId
- C7 requestNumber strict value verification
- K3 acceptedWithWarnings only with registration evidence + C7 accepted

Does not include:

- clinical Wave 1 changes
- Phase 4
- Phase 3 rerun
- fullflow

## WO-2: Static/DADS recovery

Goal: make `npm run typecheck`, `npm run build`, and `npm run test:ci` green, or produce explicit waivers.

Includes:

- charts/DADS contract type errors
- login redirect tests
- workspace tab timeout tests
- administration connection timeout tests
- DADS-based UI/test fixes only where relevant

Does not include:

- live ORCA
- broad UI redesign
- clinical Wave 1 implementation unless needed to fix currently failing tests

## WO-3: Clinical Wave 1 batch 1

Goal: integrate CWP-01 base, CWP-05 disease, CWP-02 SOAP.

Order:

1. CWP-01 gate
2. CWP-05 disease date/readback
3. CWP-02 SOAP server reload

## WO-4: Clinical Wave 1 batch 2

Goal: integrate CWP-04 generic order, CWP-03 prescription, CWP-06 document two-phase.

Order:

1. CWP-04 generic order bundle matrix
2. CWP-03 prescription full local persistence
3. CWP-06 document attachment two-phase failure

## WO-5: Phase 4 handoff docs only

Goal: prepare Phase 4 handoff materials. Do not run Phase 4.

Acceptance:

- Phase 4 runbook created
- prechecks documented
- forbidden actions documented
- future evidence requirements documented
- Phase 4 status remains not_run

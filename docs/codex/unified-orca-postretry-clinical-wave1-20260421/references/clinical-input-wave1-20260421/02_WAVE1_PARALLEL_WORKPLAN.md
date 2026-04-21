# 02. Wave 1 parallel workplan

## Overview

CWP-01 gate が通ったら、次の 5 work package を並列起動する。
全 sub-agent は gpt-5.4 high で起動し、必ず個別 worktree で作業する。

## Worktree commands

```bash
git worktree add ../odn-cwp05-disease-date-readback -b codex/cwp05-disease-date-readback
git worktree add ../odn-cwp02-soap-server-reload -b codex/cwp02-soap-server-reload
git worktree add ../odn-cwp03-prescription-local-flow -b codex/cwp03-prescription-local-flow
git worktree add ../odn-cwp04-generic-order-matrix -b codex/cwp04-generic-order-matrix
git worktree add ../odn-cwp06-document-two-phase-failure -b codex/cwp06-document-two-phase-failure
```

## Assignments

| sub-agent | work package | prompt file |
|---|---|---|
| A | CWP-05 disease date/readback validation | `subagents/CWP05_DISEASE_DATE_READBACK_PROMPT.md` |
| B | CWP-02 SOAP canonical server reload | `subagents/CWP02_SOAP_SERVER_RELOAD_PROMPT.md` |
| C | CWP-03 prescription full local persistence | `subagents/CWP03_PRESCRIPTION_LOCAL_FLOW_PROMPT.md` |
| D | CWP-04 generic order bundle matrix + static ORCA boundary | `subagents/CWP04_GENERIC_ORDER_MATRIX_PROMPT.md` |
| E | CWP-06 document attachment two-phase failure | `subagents/CWP06_DOCUMENT_TWO_PHASE_FAILURE_PROMPT.md` |

## Merge order

1. CWP-01 integration base
2. CWP-05 disease date/readback
3. CWP-02 SOAP server reload
4. CWP-04 generic order matrix
5. CWP-03 prescription local flow
6. CWP-06 document two-phase failure
7. shared docs/evidence updates
8. final targeted regression commands
9. final report

## Why this order

- Disease and SOAP are high-risk clinical persistence areas with limited overlap.
- Generic order matrix should land before prescription if shared order fixtures/helpers are introduced.
- Prescription full flow may reuse CWP-04 conventions but should preserve first-class prescription editor behavior.
- Document two-phase failure touches DocumentCreatePanel and save/retry messaging, so merge it after the order work to reduce UI conflict.

## Common command expectations

Each work package must report:

```text
branch:
commit:
worktree clean:
targeted commands:
exit code:
tests run:
failures/errors/skipped:
git diff --check:
doc link check:
not verified:
ORCA boundary:
DADS boundary:
```

## Wave 1 final outcome

The correct Wave 1 claim is:

```text
clinical local persistence coverage improved by targeted tests.
```

The following claims remain forbidden unless separately executed and evidenced:

```text
runtime browser verified
Playwright/e2e verified
live ORCA verified
Phase 3/4 verified
fullflow verified
official ORCA spec compatible
```

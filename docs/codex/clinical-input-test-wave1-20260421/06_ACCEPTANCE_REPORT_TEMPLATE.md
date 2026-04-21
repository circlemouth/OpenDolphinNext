# Wave 1 coordinator acceptance report template

Save final report as:

```text
docs/codex/clinical-input-test-wave1-20260421/results/WAVE1_COORDINATOR_REPORT.md
```

## 1. Summary verdict

Choose one:

- MERGEABLE TEST-ONLY PACKAGE
- PARTIAL / HAS FAILING TEST BLOCKERS
- PARTIAL / NEEDS PRODUCTION IMPLEMENTATION PACKAGE
- PARTIAL / NEEDS SOURCE EXPANSION
- INSUFFICIENT / RESTART REQUIRED

## 2. Scope actually completed

| Work package | Branch | Worktree | Status | Merged? | Notes |
|---|---|---|---|---|---|
| Agent A: order-containing karte document server tests | | | | | |
| Agent B: order local matrix and ORCA boundary tests | | | | | |
| Agent C: disease/SOAP readback tests | | | | | |
| Agent D: DADS/evidence tests | | | | | |

## 3. Base and merge information

```text
base branch:
base commit:
coordinator branch:
merge order:
final commit:
```

## 4. Changed files

| Area | Files changed | Test-only? | Notes |
|---|---|---:|---|
| Server document/revision | | yes/no | |
| Web order | | yes/no | |
| Disease/SOAP | | yes/no | |
| DADS/UI | | yes/no | |
| Evidence/package tests | | yes/no | |

## 5. Tests added

| Test file | Test cases added | Purpose | Expected boundary |
|---|---|---|---|
| | | | local/server/static/MSW only |

## 6. Commands run

| Command | CWD | Result | Exit code | Notes |
|---|---|---:|---:|---|
| | | PASS/FAIL/NOT RUN | | |

## 7. Failures and blockers

| Blocker id | Severity | Area | Description | Failing command/test | Proposed next action |
|---|---:|---|---|---|---|
| | Critical/High/Medium/Low | | | | |

## 8. ORCA boundary statement

Required text:

```text
Wave 1 did not perform live ORCA mutation. Local, unit, server, static contract, and MSW tests in this package are not live ORCA success evidence. medicalmodv2 / diseasev3 / subjectivesv2 remain future gates requiring explicit approval and ORCA official specification confirmation where needed.
```

## 9. DADS statement

Describe which DADS bases were covered:

- important information not hidden
- label/support text/error text
- placeholder not used as substitute
- disabled avoided or reason/enabling condition nearby
- one primary action per screen/context
- button order and hierarchy
- date input guidance
- error text concrete and static
- accessibility/focus/contrast if source supports checking

## 10. Evidence limitations

State precisely:

- whether Playwright ran
- whether server tests ran
- whether web unit/component tests ran
- whether any tests were skipped
- whether any failures reflect production behavior
- whether any source scope was unavailable
- no full-source secret scan unless actually run
- no clean checkout truth unless actually verified

## 11. Recommended next wave

| Next package | Reason | Owner | Should include production fixes? |
|---|---|---|---:|
| | | | yes/no |

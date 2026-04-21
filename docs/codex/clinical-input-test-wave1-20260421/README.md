# OpenDolphinNext clinical input test Wave 1: Codex instruction document set

## Purpose

This document set is for the first Codex implementation wave after the Web client clinical input coverage audit.

The goal is to **add and run tests** that verify local clinical input persistence and UI contract boundaries for:

- chart / karte document persistence
- SOAP / local subjectives persistence and readback
- order local persistence and ORCA boundary
- disease / diagnosis local persistence and validation
- DADS-based clinical UI contract
- safe dynamic evidence packaging

This is not a live ORCA mutation task.

## Repository placement

Place this directory in the repository as:

```text
docs/codex/clinical-input-test-wave1-20260421/
```

Recommended package contents:

```text
README.md
00_COORDINATOR_PROMPT.md
01_WORKTREE_AND_MERGE_PLAN.md
02_AGENT_A_ORDER_KARTE_DOCUMENT_SERVER_PROMPT.md
03_AGENT_B_ORDER_LOCAL_MATRIX_ORCA_BOUNDARY_PROMPT.md
04_AGENT_C_DISEASE_SOAP_READBACK_PROMPT.md
05_AGENT_D_DADS_PLAYWRIGHT_EVIDENCE_PROMPT.md
06_ACCEPTANCE_REPORT_TEMPLATE.md
07_TEST_COMMAND_AND_EVIDENCE_POLICY.md
08_FORBIDDEN_ACTIONS_AND_SCOPE.md
prompts/COPY_PASTE_COORDINATOR_PROMPT.md
prompts/COPY_PASTE_AGENT_A_PROMPT.md
prompts/COPY_PASTE_AGENT_B_PROMPT.md
prompts/COPY_PASTE_AGENT_C_PROMPT.md
prompts/COPY_PASTE_AGENT_D_PROMPT.md
templates/SUBAGENT_REPORT_TEMPLATE.md
templates/MERGE_DECISION_TEMPLATE.md
```

## Source evidence basis

The plan is based only on the review package and registered project materials. Do not use external web.

Known review constraints:

- package mode was `extracted_review_subset`, not a full repository archive
- dynamic evidence was not included
- worktree cleanliness was not verified
- package source-scope secret scan passed, but this is hygiene evidence only
- full-source secret-clean status was not claimed
- MSW / unit / local test success must not be represented as live ORCA success

## Recommended Wave 1 scope

Wave 1 should be implemented by Codex, not by ChatGPT, because it involves test source changes and test execution.

Use one main coordinator and four subagents:

| Agent | Scope | Primary risk addressed |
|---|---|---|
| A | chart / karte document server persistence | order-containing `/karte/document` persistence not proven |
| B | order local persistence matrix and ORCA boundary | local save vs ORCA mutation confusion |
| C | disease / diagnosis and SOAP readback | date/outcome silent drop and weak readback evidence |
| D | DADS UI contract and dynamic evidence packaging | UI contract drift and runtime evidence ambiguity |

All subagents must run in separate Git worktrees and must be launched with **gpt 5.4 high**.

## Hard rule

No subagent may perform live ORCA mutation, Phase 3, Phase 4, fullflow, registration mutation, or external-web ORCA spec lookup in this wave.

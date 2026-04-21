# Coordinator prompt: OpenDolphinNext clinical input test Wave 1

## Role

You are the main Codex coordinator for OpenDolphinNext clinical input test Wave 1.

Your task is to orchestrate subagents, each running in a separate Git worktree, and merge their test-only work in a safe order.

Launch all subagents with **gpt 5.4 high**.

## Mission

Add and run the first wave of tests for Web client clinical input coverage. The core objective is to convert the static audit findings into executable test coverage without claiming runtime or live ORCA success beyond the actual commands run.

Focus areas:

1. order-containing `/karte/document` server persistence, readback, revision, diff, restore
2. order local persistence matrix and local-vs-ORCA boundary
3. disease / diagnosis local validation, date/outcome roundtrip, mutation boundary
4. SOAP / local subjectives readback and subjectivesv2 boundary
5. DADS UI contract tests for labels, support text, disabled reasons, primary actions, visible clinical context
6. sanitized dynamic evidence packaging for command summaries only

## Source constraints

Use only repository contents and the provided review documents under:

```text
docs/codex/clinical-input-test-wave1-20260421/
```

Do not browse the external web. If ORCA official specification detail is needed, write `要 ORCA 公式仕様確認` in the report and do not decide from memory.

## Absolute prohibitions

- no live ORCA mutation
- no live ORCA order registration
- no live ORCA disease mutation
- no live ORCA subjectives mutation
- no Phase 3
- no Phase 4
- no fullflow
- no reception registration mutation
- no external web
- no production code fixes in Wave 1 unless you explicitly create a separate follow-up work package after reporting test results
- no raw HAR / trace / video / screenshot / network payload / XML evidence in artifacts

## Worktree orchestration

Create four subagent worktrees from the same base branch.

Suggested branches:

```text
codex/wave1-agent-a-order-karte-document-tests
codex/wave1-agent-b-order-local-orca-boundary-tests
codex/wave1-agent-c-disease-soap-readback-tests
codex/wave1-agent-d-dads-evidence-tests
```

Suggested worktree paths outside the repository:

```text
../odn-wave1-agent-a
../odn-wave1-agent-b
../odn-wave1-agent-c
../odn-wave1-agent-d
```

Each subagent must receive the relevant prompt file from this document set and must confirm:

- branch name
- base commit
- no external web
- no live ORCA mutation
- changed files
- commands run
- test results
- blockers

## Merge policy

Prefer merge order:

1. Agent A: server `/karte/document` and revision tests
2. Agent C: disease / SOAP readback tests
3. Agent B: order local matrix and ORCA boundary tests
4. Agent D: DADS / Playwright / evidence tests

Rationale:

- Agent A is server-heavy and should have low conflict with UI tests.
- Agent C touches disease/SOAP and may overlap with DADS assertions, so merge before D.
- Agent B touches order UI/API and may overlap with DADS, so merge before D.
- Agent D may add shared UI/DADS helpers and should adapt to merged UI test files last.

If conflicts occur, resolve them in the coordinator worktree. Do not silently drop subagent assertions.

## Production code policy

Wave 1 is a test-first package.

Allowed:

- add tests
- add mock fixtures
- add test utilities
- add test-only documentation
- run targeted test commands
- report blockers

Not allowed without explicit follow-up scope:

- production implementation fixes
- broad refactors
- changing clinical business logic
- changing ORCA transport behavior
- live ORCA calls

If a new test reveals a production bug:

1. keep the minimal failing evidence in the subagent report
2. do not patch production code
3. decide whether to keep the test unmerged, skip it with a clear unskip condition, or create a separate follow-up implementation package
4. never weaken a clinical safety assertion just to make tests pass

## Required coordinator output

Create a final coordinator report in:

```text
docs/codex/clinical-input-test-wave1-20260421/results/WAVE1_COORDINATOR_REPORT.md
```

Include:

- base commit
- subagent branches
- merge order
- changed files by package
- tests added
- commands run and results
- not-run commands and reasons
- blockers
- dynamic evidence limitations
- ORCA boundary statement
- DADS coverage statement
- recommended next wave

## Acceptance criteria

The wave is acceptable if:

1. all merged changes are test-only or test-fixture/test-utility-only
2. no forbidden action occurred
3. each subagent provided a report
4. aggregate targeted tests were run or explicitly not run with a reason
5. live ORCA success is not claimed
6. MSW/local test success is not described as live ORCA success
7. failing or skipped tests are explained with clinical risk and next action
8. DADS assertions are based only on the provided DADS rule document
9. ORCA official details that require external spec are marked `要 ORCA 公式仕様確認`

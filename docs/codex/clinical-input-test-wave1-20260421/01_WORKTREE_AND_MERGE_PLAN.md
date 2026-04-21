# Worktree and merge plan

## Base setup

Run from the clean repository root. Do not rely on the review zip as a mutable source tree.

Check current branch and commit:

```bash
git status --short
git rev-parse --abbrev-ref HEAD
git rev-parse HEAD
```

If the worktree is dirty, stop and report. Do not start subagents from a dirty base.

## Create worktrees

Use the repository's current integration branch as the base, unless the human owner specifies a different branch.

Example:

```bash
BASE_BRANCH=$(git rev-parse --abbrev-ref HEAD)
BASE_COMMIT=$(git rev-parse HEAD)

git worktree add ../odn-wave1-agent-a -b codex/wave1-agent-a-order-karte-document-tests "$BASE_BRANCH"
git worktree add ../odn-wave1-agent-b -b codex/wave1-agent-b-order-local-orca-boundary-tests "$BASE_BRANCH"
git worktree add ../odn-wave1-agent-c -b codex/wave1-agent-c-disease-soap-readback-tests "$BASE_BRANCH"
git worktree add ../odn-wave1-agent-d -b codex/wave1-agent-d-dads-evidence-tests "$BASE_BRANCH"
```

If branch creation fails because a branch already exists, choose a timestamped branch name and record it.

## Launch subagents

Launch each subagent with model **gpt 5.4 high**.

Provide each subagent:

- its worktree path
- its branch name
- the relevant prompt file
- `08_FORBIDDEN_ACTIONS_AND_SCOPE.md`
- `07_TEST_COMMAND_AND_EVIDENCE_POLICY.md`
- `templates/SUBAGENT_REPORT_TEMPLATE.md`

Do not allow subagents to share a worktree.

## Subagent output location

Each subagent must write a report to:

```text
docs/codex/clinical-input-test-wave1-20260421/results/AGENT_<ID>_REPORT.md
```

The coordinator may create the `results/` directory if needed.

## Merge steps

After each subagent completes:

```bash
git fetch . <subagent-branch>
git merge --no-ff <subagent-branch>
```

Or cherry-pick if repository policy requires it.

After every merge:

1. inspect changed files
2. ensure no production implementation changes were introduced unintentionally
3. run targeted tests affected by the merge, if feasible
4. record result in the coordinator report

## Conflict policy

If conflicts occur:

- preserve all clinically relevant assertions
- do not delete tests simply to resolve conflicts
- if two tests cover the same contract, keep the stricter safe assertion unless it is clearly wrong
- if a DADS assertion conflicts with existing UI behavior, do not patch production in Wave 1; report as blocker or pending test

## Aggregate validation

At the end, run the narrowest aggregate suite that includes all merged test files.

If full suite is too broad, run targeted commands by area:

- server tests added by Agent A
- server/UI tests added by Agent C
- web-client order tests added by Agent B
- web-client DADS / Playwright tests added by Agent D

Record commands and outcomes using `07_TEST_COMMAND_AND_EVIDENCE_POLICY.md`.

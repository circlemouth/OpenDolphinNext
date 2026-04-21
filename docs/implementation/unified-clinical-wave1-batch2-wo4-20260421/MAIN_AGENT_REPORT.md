# WO-4 Main Agent Report

RUN_ID: `20260421T224445Z`

## Status

`PASS`

## Source

- start commit: `40737ebca3b71fc86968467257fbcc8a9c8d9f29`
- main branch: `codex/wo4-clinical-wave1-batch2-main-20260421`
- current source commit before package generation: `21bc3cb1516bf4e16f509bf89867fb719fcff646`

## Scope

- CWP-04 generic order matrix.
- CWP-03 prescription local flow.
- CWP-06 document two-phase failure.

Explicitly not started or not run:

- WO-5: not_started.
- Phase 3 retry rerun: no.
- Phase 4: not_run.
- Fullflow: not_run.
- Live ORCA mutation: no.
- Live medicalmodv2/diseasev3/subjectivesv2 success: not claimed.

## Merge Order

1. CWP-04 generic order matrix: `fc91d7caee69f16f9374e0a630cdbf91eab49889`, merged by `cwp04-merge`.
2. CWP-03 prescription local flow: `a1c17bb625ea17efcff3fdd6454d6dacc0758732`, merged by `cwp03-merge`.
3. CWP-06 document two-phase failure: rebased by `cwp06-rebase-onto-main`, merged from `6a5e7e048ad9f89047be75c52631b86e31971219` by `cwp06-merge`.

## Implementation Summary

- CWP-04 added fail-closed radiology bodyPart static send blocking, generic local order matrix readback coverage, material/comment/bodyPart/bacteria preservation assertions, and server resource local-boundary tests.
- CWP-03 added server resource save/readback coverage for prescription RP/drug/usage/days/comments/settings/remarks/doctor comments through `/api/local/prescription-orders`.
- CWP-06 added attachment-backed document two-phase retry state. If `/karte/document` succeeds and `/odletter/letter` fails, the form and attachment selection remain recoverable; retry reuses the successful document id for the same fingerprint instead of double-posting `/karte/document`.

## Threat Model / Misuse Cases

- Client attempts to promote local-only or unsupported orders to ORCA sendable: CWP-04 static/local tests keep local-only and unsupported entities blocked from live mutation claims.
- Radiology payload without bodyPart reaches static medicalmodv2 preparation: CWP-04 blocks class 700 without a valid 002-family bodyPart and verifies server rejection.
- Prescription local save is mistaken for medicalmodv2 live mutation: CWP-03 tests assert local prescription endpoints and reports explicitly separate local persistence from live ORCA.
- `/karte/document` succeeds but `/odletter/letter` fails: CWP-06 keeps edits recoverable and prevents duplicate first-phase document creation on same-fingerprint retry.
- Patient switch after free document edit: CWP-06 tests keep free document readback/draft state patient-scoped.

## DADS Basis

Only `docs/codex/unified-orca-postretry-clinical-wave1-20260421/references/dads_app_ui_design_rules_20260411.md` was used as the DADS basis.

- Important local-only/sendable and failure information remains visible.
- Form labels and concrete validation/failure text were preserved or strengthened.
- Placeholder text was not used as guidance.
- No broad UI redesign was performed.
- No independent DADS rules were invented.
- Ordinary validation/failure paths were not converted into assertive live-region behavior.

## Evidence

- Command log index: `docs/implementation/unified-clinical-wave1-batch2-wo4-20260421/command-log.jsonl`
- Command logs: `docs/implementation/unified-clinical-wave1-batch2-wo4-20260421/command-logs/`
- Subagent prompts: `docs/implementation/unified-clinical-wave1-batch2-wo4-20260421/subagent-prompts/`
- Subagent reports: `docs/implementation/unified-clinical-wave1-batch2-wo4-20260421/subagent-reports/`

Subagent local logs are reference-only and are not final gate evidence. Final gate evidence was rerun in the main worktree after merge.

## Corrected Failures

- `cwp04-client-targeted` failed with exit 127 because `vitest` was unavailable before `npm ci` in the new main worktree. `main-npm-ci` restored dependencies and `cwp04-client-targeted-rerun` passed. This failure is retained as negative evidence.
- `post-package-source-scope-scan` failed with exit 1 due scan helper no-match handling under pipefail; `post-package-source-scope-scan-rerun` passed after correction.

## Worktree Cleanup

- Removed `../odn-cwp04-generic-order-matrix`.
- Removed `../odn-cwp03-prescription-local-flow`.
- Removed `../odn-cwp06-document-two-phase-failure`.
- No unmerged subagent change was left behind.
- Final registered worktree list is in `command-logs/final-worktree-list-after-cleanup.log`.

## Residual Risk

- No live ORCA mutation or official medicalmodv2 behavior was verified by design.
- Server-side automatic cleanup/compensation for abandoned `/karte/document` rows remains outside WO-4; WO-4 fixed client retry idempotency and recoverability for the current two-step UI flow.
- Existing npm lockfile audit output reported low-severity findings during subagent/main dependency install; no dependency was changed in WO-4.

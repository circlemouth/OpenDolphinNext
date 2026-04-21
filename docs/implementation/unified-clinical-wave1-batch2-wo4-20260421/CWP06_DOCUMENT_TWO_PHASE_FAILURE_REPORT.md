# CWP-06 Document Two-Phase Failure Main Report

RUN_ID: `20260421T224445Z`

## Status

`accepted`

## Scope

- Document attachment two-phase failure semantics.
- Failure does not silently lose local edits.
- Successful `/karte/document` first phase is not double-posted on same-fingerprint retry.
- Failed `/odletter/letter` phase remains recoverable.
- Local/server/component/static coverage only.
- No live ORCA mutation.

## Main Integration

- subagent original commit: `68f963670b9b10da27a0a40a4413e0ad5bf05be5`
- rebased commit: `6a5e7e048ad9f89047be75c52631b86e31971219`
- rebase command id: `cwp06-rebase-onto-main`
- merge command id: `cwp06-merge`
- subagent report: `docs/implementation/unified-clinical-wave1-batch2-wo4-20260421/subagent-reports/CWP06_DOCUMENT_TWO_PHASE_FAILURE_REPORT.md`

## Changed Files

- `web-client/src/features/charts/DocumentCreatePanel.tsx`
- `web-client/src/features/charts/__tests__/documentCreatePanel.test.tsx`
- `web-client/src/features/charts/__tests__/PatientSummaryPanel.test.tsx`
- `web-client/src/features/charts/patientFreeDocumentApi.test.ts`

## Main-Worktree Verification

| command id | exit |
|---|---:|
| `cwp06-git-diff-check` | 0 |
| `cwp06-client-targeted` | 0 |
| `cwp06-server-targeted` | 0 |
| `cwp06-web-typecheck` | 0 |
| `final-cwp06-client` | 0 |
| `final-cwp06-server` | 0 |

## Boundary

- Server-side automatic cleanup/compensation for abandoned `/karte/document` rows is not claimed.
- Playwright/e2e/runtime browser: not run.
- Live ORCA mutation: not run.
- Phase 3 retry rerun: no.
- Phase 4: not_run.
- Fullflow: not_run.

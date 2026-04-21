# CWP-05 Disease Date/Readback Report

RUN_ID: `20260421T142818Z`

## Status

`accepted`

## Scope

- disease/diagnosis local persistence
- `yyyy-MM-dd` startDate/endDate save-readback
- invalid date validation
- endDate before startDate validation
- unknown outcome validation
- add/edit/delete/outcome readback
- suspected/principal save-readback-edit badge retention
- ORCA mirror / candidate mutation boundary

## Main-Worktree Integration

- Source branch: `codex/cwp05-disease-date-readback`
- Source commit: `c32fc3b69154be65a17857b1db6094a3530ffd1e`
- Merge command: `git merge --ff-only c32fc3b69154be65a17857b1db6094a3530ffd1e`
- Main-worktree follow-up fix: replaced delayed `requestAnimationFrame` focus/select in `DiagnosisEditPanel` with layout-time focus/select to prevent first-character loss on immediate dialog typing.
- Existing label tests were updated to match the DADS-required `※必須` / `※任意` label contract.

## Changed Files

- `server-modernized/src/main/java/open/dolphin/rest/LocalDiagnosisResource.java`
- `server-modernized/src/test/java/open/dolphin/rest/LocalDiagnosisResourceTest.java`
- `web-client/src/features/charts/diseaseApi.ts`
- `web-client/src/features/charts/diseaseApi.test.ts`
- `web-client/src/features/charts/DiagnosisEditPanel.tsx`
- `web-client/src/features/charts/__tests__/DiagnosisEditPanel.test.tsx`
- `web-client/src/features/charts/__tests__/DiagnosisEditPanel.readback.test.tsx`
- `web-client/src/features/charts/__tests__/dadsClinicalInputContract.test.tsx`

## Main-Worktree Verification

| Command | Exit code | Notes |
|---|---:|---|
| `mvn -f pom.server-modernized.xml -pl server-modernized -am -Dsurefire.failIfNoSpecifiedTests=false -Dtest=LocalDiagnosisResourceTest test` | 0 | final targeted server pass, 11 tests |
| `npm --prefix web-client test -- --run src/features/charts/diseaseApi.test.ts src/features/charts/__tests__/DiagnosisEditPanel.test.tsx` | 0 | final targeted client pass, 22 tests |
| `npm --prefix web-client test -- --run src/features/charts/__tests__/DiagnosisEditPanel.readback.test.tsx src/features/charts/__tests__/dadsClinicalInputContract.test.tsx` | 0 | label contract regression pass |
| `npm --prefix web-client run typecheck` | 0 | typecheck pass after label/focus fixes |
| `git diff --check` | 0 | whitespace check pass |

Earlier main-worktree CWP-05 client reruns failed before the focus race and label assertion fixes. Those failures remain recorded as negative evidence and were not promoted to success.

## Boundary

- Live ORCA mutation: not run.
- Live diseasev3 success: not claimed.
- Phase 3 retry rerun: no.
- Phase 4: not_run.
- Fullflow: not_run.
- Playwright/e2e/runtime browser: not run.
- Raw patient-sensitive or credential-bearing artifacts: none included.

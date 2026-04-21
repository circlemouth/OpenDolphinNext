# CWP-02 SOAP Server Reload Report

RUN_ID: `20260421T142818Z`

## Status

`accepted`

## Scope

- SOAP S/O/A/P/free save
- server response readback
- component remount / chart reload restoration from server response
- free -> S mapping display contract
- partial failure dirty semantics
- successful section not double-posted
- save failure keeps dirty
- invalid performDate behavior
- SOAP local save does not call ORCA subjectivesv2

## Main-Worktree Integration

- Source branch: `codex/cwp02-soap-server-reload`
- Source commit: `d67e3a378c0a1b725d1e818d8d861dc5de7f09f23`
- Merge command: `git merge --no-ff d67e3a378 -m "merge CWP-02 SOAP server readback"`

## Changed Files

- `api-contract/src/main/java/open/dolphin/rest/dto/orca/SubjectiveEntryRequest.java`
- `api-contract/src/main/java/open/dolphin/rest/dto/orca/SubjectiveEntryResponse.java`
- `server-modernized/src/main/java/open/dolphin/rest/orca/LocalChartSubjectiveResource.java`
- `server-modernized/src/test/java/open/dolphin/rest/orca/LocalChartSubjectiveResourceTest.java`
- `web-client/src/features/charts/SoapNotePanel.tsx`
- `web-client/src/features/charts/__tests__/SoapNotePanel.serverReadback.test.tsx`
- `web-client/src/features/charts/__tests__/soapNoteDirtyState.test.tsx`
- `web-client/src/features/charts/soap/subjectiveChartApi.ts`
- `web-client/src/features/charts/styles.ts`

## Main-Worktree Verification

| Command | Exit code | Notes |
|---|---:|---|
| `mvn -f pom.server-modernized.xml -pl server-modernized -am -Dsurefire.failIfNoSpecifiedTests=false -Dtest=LocalChartSubjectiveResourceTest test` | 0 | final targeted server pass, 9 tests |
| `npm --prefix web-client test -- --run src/features/charts/__tests__/SoapNotePanel.serverReadback.test.tsx src/features/charts/__tests__/soapNoteDirtyState.test.tsx src/features/charts/__tests__/soapNoteAudit.test.tsx src/features/charts/__tests__/SoapNotePanel.test.tsx src/features/charts/__tests__/soapSubjectivesOrcaBoundary.test.tsx` | 0 | final targeted client pass, 9 tests |
| `npm --prefix web-client run typecheck` | 0 | typecheck pass |
| `git diff --check` | 0 | whitespace check pass |

## Security / Boundary

- `displaySection` is accepted only after server-side normalization and category matching.
- Invalid `performDate` fails closed with 400 instead of silently falling back.
- SOAP local save remains local chart persistence evidence only.
- Live ORCA mutation: not run.
- Live subjectivesv2 success: not claimed.
- Phase 3 retry rerun: no.
- Phase 4: not_run.
- Fullflow: not_run.
- Playwright/e2e/runtime browser: not run.
- Raw patient-sensitive or credential-bearing artifacts: none included.

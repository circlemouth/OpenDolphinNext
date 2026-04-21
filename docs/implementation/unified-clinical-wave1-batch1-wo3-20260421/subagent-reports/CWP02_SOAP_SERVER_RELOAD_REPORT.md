# CWP02 SOAP canonical server reload report

## subagent id
CWP-02 SOAP canonical server reload

## local worktree path(reference only)
`/Users/Hayato/Documents/GitHub/odn-cwp02-soap-server-reload`

## base commit
`672c37c7e15a8247c950b9f27f378ad3eeb30039`

## branch
`codex/cwp02-soap-server-reload`

## scope
- SOAP S/O/A/P/free save
- server response readback
- component remount / chart reload restoration from server response
- free -> S mapping display contract
- partial failure dirty semantics
- successful section not double-posted
- save failure keeps dirty
- invalid performDate behavior fixed by test
- SOAP local save does not call ORCA subjectivesv2

## changed files(repo-relative only)
- `api-contract/src/main/java/open/dolphin/rest/dto/orca/SubjectiveEntryRequest.java`
- `api-contract/src/main/java/open/dolphin/rest/dto/orca/SubjectiveEntryResponse.java`
- `server-modernized/src/main/java/open/dolphin/rest/orca/LocalChartSubjectiveResource.java`
- `server-modernized/src/test/java/open/dolphin/rest/orca/LocalChartSubjectiveResourceTest.java`
- `web-client/src/features/charts/SoapNotePanel.tsx`
- `web-client/src/features/charts/__tests__/SoapNotePanel.serverReadback.test.tsx`
- `web-client/src/features/charts/__tests__/soapNoteDirtyState.test.tsx`
- `web-client/src/features/charts/soap/subjectiveChartApi.ts`
- `web-client/src/features/charts/styles.ts`

## local commands run(command + exit code only)
- `git -C /Users/Hayato/Documents/GitHub/OpenDolphin_WebClient-wo3-clinical-wave1-batch1-main worktree add -b codex/cwp02-soap-server-reload ../odn-cwp02-soap-server-reload 672c37c7e15a8247c950b9f27f378ad3eeb30039` -> exit 0
- `npm test -- --run src/features/charts/__tests__/SoapNotePanel.serverReadback.test.tsx src/features/charts/__tests__/soapNoteDirtyState.test.tsx src/features/charts/__tests__/soapNoteAudit.test.tsx src/features/charts/__tests__/SoapNotePanel.test.tsx src/features/charts/__tests__/soapSubjectivesOrcaBoundary.test.tsx` -> exit 127
- `npm ci` -> exit 0
- `npm test -- --run src/features/charts/__tests__/SoapNotePanel.serverReadback.test.tsx src/features/charts/__tests__/soapNoteDirtyState.test.tsx src/features/charts/__tests__/soapNoteAudit.test.tsx src/features/charts/__tests__/SoapNotePanel.test.tsx src/features/charts/__tests__/soapSubjectivesOrcaBoundary.test.tsx` -> exit 1
- `npm test -- --run src/features/charts/__tests__/SoapNotePanel.serverReadback.test.tsx src/features/charts/__tests__/soapNoteDirtyState.test.tsx src/features/charts/__tests__/soapNoteAudit.test.tsx src/features/charts/__tests__/SoapNotePanel.test.tsx src/features/charts/__tests__/soapSubjectivesOrcaBoundary.test.tsx` -> exit 1
- `npm test -- --run src/features/charts/__tests__/SoapNotePanel.serverReadback.test.tsx src/features/charts/__tests__/soapNoteDirtyState.test.tsx src/features/charts/__tests__/soapNoteAudit.test.tsx src/features/charts/__tests__/SoapNotePanel.test.tsx src/features/charts/__tests__/soapSubjectivesOrcaBoundary.test.tsx` -> exit 0
- `mvn -f pom.server-modernized.xml -pl server-modernized -am -Dsurefire.failIfNoSpecifiedTests=false -Dtest=LocalChartSubjectiveResourceTest test` -> exit 0
- `mvn -f pom.server-modernized.xml -pl server-modernized -am -Dsurefire.failIfNoSpecifiedTests=false -Dtest=LocalChartSubjectiveResourceTest test` -> exit 0
- `npm run typecheck` -> exit 0
- `git diff --check` -> exit 0

## local logs(reference only)
- Codex terminal transcript for RUN_ID `20260421T144031Z`; sanitized summary only.
- No raw ORCA body, raw patient/insurance detail, credentials, cookies, Authorization, JSESSIONID, CSRF, HAR, trace, video, screenshot, or raw network dump generated or included.

## implementation summary
- Added `displaySection` to the local SOAP request DTO and a server-normalized `entry` readback object to the response DTO.
- `LocalChartSubjectiveResource` now returns canonical readback metadata (`documentId`, `patientId`, `performDate`, `soapCategory`, `displaySection`, body, recordedAt, author) after local persistence.
- `performDate` now fails closed with 400 on invalid ISO date input instead of silently falling back to current date.
- `displaySection` is validated server-side against SOAP category; `free` and `subjective` are only valid with local `S`.
- `SoapNotePanel` now appends history from server readback entries on success, preserving `free -> S -> Free display` behavior.
- Partial failure now marks successful sections clean and appends only those server readback entries; failed sections remain dirty and a retry posts only still-dirty sections.
- DADS-visible textarea labels are associated with textareas and support text clarifies each section; Free support text explicitly states local S mapping and Free readback display.
- Threat/misuse cases considered and covered: invalid `performDate` fallback, mismatched `displaySection`/category tampering, partial retry duplicate POST, save failure dirty loss, accidental ORCA subjectivesv2 call.

## test coverage summary
- Client targeted tests passed: 5 files, 9 tests.
- Server targeted tests passed: 1 file, 9 tests.
- `npm run typecheck` passed.
- `git diff --check` passed.
- Verified by targeted local/server/component tests: SOAP S/O/A/P/free server-response readback, Free-to-S mapping, component remount restoration from canonical readback history, partial failure dirty semantics, no double-post retry, save failure dirty retention, invalid performDate 400, local SOAP API boundary not subjectivesv2.
- Not verified: Playwright/e2e runtime, browser runtime beyond component tests, live ORCA mutation, Phase 3/4, fullflow.
- ORCA boundary: this package verifies local chart persistence only; ORCA subjectivesv2 live mutation was not run.

## risks/blockers
- Browser/Playwright runtime not run by instruction boundary.
- Live ORCA subjectivesv2 mutation not run and not claimed.
- `npm ci` reported 4 low severity vulnerabilities; no high/critical vulnerability was reported.
- Maven emitted pre-existing deprecation/log-manager warnings; no test failure.

## recommended main-worktree verification commands
- `cd web-client && npm test -- --run src/features/charts/__tests__/SoapNotePanel.serverReadback.test.tsx src/features/charts/__tests__/soapNoteDirtyState.test.tsx src/features/charts/__tests__/soapNoteAudit.test.tsx src/features/charts/__tests__/SoapNotePanel.test.tsx src/features/charts/__tests__/soapSubjectivesOrcaBoundary.test.tsx`
- `mvn -f pom.server-modernized.xml -pl server-modernized -am -Dsurefire.failIfNoSpecifiedTests=false -Dtest=LocalChartSubjectiveResourceTest test`
- `cd web-client && npm run typecheck`
- `git diff --check`

## raw artifact inclusion
none

## live ORCA mutation
not run

## Phase 3/Phase 4/fullflow
not run

## Agent identity

```text
agent id: Subagent C - disease / diagnosis and SOAP readback tests
model: gpt 5.4 high
worktree path: /Users/Hayato/Documents/GitHub/odn-wave1-agent-c
branch name: codex/wave1-agent-c-disease-soap-readback-tests
base branch: 02aa1434d20615c22c23fe5cbf80938e725cfd88
base commit: 02aa1434d20615c22c23fe5cbf80938e725cfd88
start time: 2026-04-21T13:49:25+09:00
end time: 2026-04-21T14:06:05+09:00
RUN_ID: 20260421T044925Z
```

## Forbidden-action attestation

```text
external web used: no
live ORCA mutation: no
Phase 3/4/fullflow: no
production code changed: no
raw HAR/trace/video/screenshot included: no
```

## Scope completed

| Item | Status | Notes |
|---|---:|---|
| local disease create/update/delete readback | done | server resource testで create/update/delete、readback payload、principal/suspected/outcome を固定 |
| disease date validation evidence | partial | date-only/invalid/reversed date は production blocker として現状挙動を固定 |
| disease outcome validation evidence | partial | unknown outcome が永続化される現状を production blocker として固定 |
| ORCA mirror / candidate boundary | done | mirror read-only、candidateOnly reject、candidate explicit confirm を server/UI で固定 |
| principal / suspected mapping | done | save/readback/edit dialog/badge/update payload を UI test で固定 |
| acute flag unsupported contract | done | 現行 UI に急性フラグ入力がないことを test evidence 化。source support なし |
| SOAP local readback | done | Free -> S mapping、local canonical history reload/readback を component test で固定 |
| SOAP subjectives ORCA boundary | done | `/api/local/charts/subjectives` のみ、`subjectivesv2` 非使用を API/component test で固定 |
| SOAP invalid performDate evidence | partial | invalid performDate が success fallback される現状を production blocker として固定 |

## Changed files

| File | Type | Reason |
|---|---|---|
| `server-modernized/src/test/java/open/dolphin/rest/LocalDiagnosisResourceTest.java` | test | disease local create/update/delete/readback、candidate reject、date/outcome blocker evidence を追加 |
| `server-modernized/src/test/java/open/dolphin/rest/orca/LocalChartSubjectiveResourceTest.java` | test | SOAP local document persistence/readback、P category、invalid performDate blocker evidence を追加 |
| `web-client/src/features/charts/__tests__/DiagnosisEditPanel.readback.test.tsx` | test | disease principal/suspected/date/outcome readback、edit payload、ORCA mirror/candidate boundary を追加 |
| `web-client/src/features/charts/__tests__/SoapNotePanel.serverReadback.test.tsx` | test | SOAP Free -> S mapping、local canonical history reload/readback を追加 |
| `web-client/src/features/charts/__tests__/soapSubjectivesOrcaBoundary.test.tsx` | test | local subjectives endpoint と SubjectivesPanel wording boundary を追加 |
| `docs/codex/clinical-input-test-wave1-20260421/results/AGENT_C_REPORT.md` | doc | Subagent C report |

## Tests added

| Test file | Test name | Purpose | Boundary |
|---|---|---|---|
| `LocalDiagnosisResourceTest` | `mutateDiagnosesRejectsCandidateOnlyAuthoring` | candidate disease を直接 authoring できないことを固定 | server/local |
| `LocalDiagnosisResourceTest` | `mutateDiagnosesCreateRoundtripRecordsCategorySuspectedOutcomeAndDelete` | create -> readback -> delete の start/end/outcome/category/suspected roundtrip | server/local |
| `LocalDiagnosisResourceTest` | `mutateDiagnosesUpdateRoundtripRecordsUpdatedFields` | update payload の readback対象 field を固定 | server/local |
| `LocalDiagnosisResourceTest` | `mutateDiagnosesDateOnlyInputIsCurrentlyDroppedToNullBlockerEvidence` | UI date-only が null 化される現状 blocker evidence | server/local |
| `LocalDiagnosisResourceTest` | `mutateDiagnosesInvalidDatesAreCurrentlyAcceptedAsNullBlockerEvidence` | invalid date が null 化される現状 blocker evidence | server/local |
| `LocalDiagnosisResourceTest` | `mutateDiagnosesUnknownOutcomeIsCurrentlyPersistedBlockerEvidence` | unknown outcome が永続化される現状 blocker evidence | server/local |
| `LocalDiagnosisResourceTest` | `mutateDiagnosesEndDateBeforeStartDateIsCurrentlyAcceptedBlockerEvidence` | endDate before startDate が受理される現状 blocker evidence | server/local |
| `LocalChartSubjectiveResourceTest` | `postSubjectivePersistsDocumentInRealMode` | S category local SOAP document persisted/readback fields | server/local |
| `LocalChartSubjectiveResourceTest` | `postSubjectivePersistsPlanCategoryWithPlanStampRole` | P category stamp role/readback | server/local |
| `LocalChartSubjectiveResourceTest` | `postSubjectiveInvalidPerformDateCurrentlyFallsBackAndPersistsBlockerEvidence` | invalid performDate fallback blocker evidence | server/local |
| `DiagnosisEditPanel.readback.test.tsx` | `principal and suspected fields roundtrip from readback into badge, edit dialog, and update payload` | disease readback -> badge/edit dialog/update mapping | web/unit |
| `DiagnosisEditPanel.readback.test.tsx` | `keeps ORCA mirror read-only and does not auto-persist master candidates before explicit confirm` | mirror/candidate/acute unsupported UI boundary | web/unit |
| `SoapNotePanel.serverReadback.test.tsx` | `maps Free to local S category, appends canonical local history, and reloads from that history` | SOAP local save/readback and Free -> S mapping | web/unit |
| `soapSubjectivesOrcaBoundary.test.tsx` | `posts local SOAP subjectives only to /api/local and never to ORCA subjectivesv2` | subjectives endpoint boundary | web/unit |
| `soapSubjectivesOrcaBoundary.test.tsx` | `keeps SubjectivesPanel wording on the local SOAP boundary` | UI wording does not imply ORCA subjectives mutation | web/unit |

## Commands run

| Command | CWD | Result | Exit code | Output summary |
|---|---|---:|---:|---|
| `mvn -f pom.server-modernized.xml -pl server-modernized -am -Dsurefire.failIfNoSpecifiedTests=false -Dtest=LocalDiagnosisResourceTest,LocalChartSubjectiveResourceTest,OrcaDiseaseMirrorSyncSupportTest test` | repo root | PASS | 0 | 20 tests, 0 failures/errors/skipped. Existing compiler/deprecation warnings. Date blocker tests emitted parser warnings/stack traces for synthetic invalid dates. |
| `npm test -- --run src/features/charts/__tests__/DiagnosisEditPanel.readback.test.tsx src/features/charts/__tests__/SoapNotePanel.serverReadback.test.tsx src/features/charts/__tests__/soapSubjectivesOrcaBoundary.test.tsx` | `web-client` | FAIL | 127 | pretest guards passed, then `vitest: command not found` because dependencies were not installed in this worktree. |
| `npm ci` | `web-client` | PASS | 0 | 973 packages installed. `npm audit` reports 4 low severity existing vulnerabilities. |
| `npm test -- --run src/features/charts/__tests__/DiagnosisEditPanel.readback.test.tsx src/features/charts/__tests__/SoapNotePanel.serverReadback.test.tsx src/features/charts/__tests__/soapSubjectivesOrcaBoundary.test.tsx` | `web-client` | FAIL | 1 | pretest guards passed. Test-only issues in new assertions/mocks were found and fixed; no production code changed. |
| `npm test -- --run src/features/charts/__tests__/DiagnosisEditPanel.readback.test.tsx src/features/charts/__tests__/SoapNotePanel.serverReadback.test.tsx src/features/charts/__tests__/soapSubjectivesOrcaBoundary.test.tsx` | `web-client` | PASS | 0 | 3 files, 5 tests passed. pretest guards passed. |

## Not-run commands

| Command or suite | Reason |
|---|---|
| live ORCA diseasev3 / subjectivesv2 / mutation suites | Wave 1 forbidden action |
| Phase 3 / Phase 4 / fullflow / reception registration mutation | Wave 1 forbidden action |
| broad `npm run ci` / full Maven static-analysis verify | Prompt requested targeted tests only; this branch changes test source and report only |

## Failures / blockers

| Blocker id | Severity | Area | Description | Proposed next action |
|---|---:|---|---|---|
| C-DIAG-DATE-001 | High | disease date | UI-style `yyyy-MM-dd` startDate/endDate is accepted by mutation but persisted as null by current server date parsing. | Production implementation wave: accept canonical date-only or fail closed with 400; add non-characterization safety tests after fix. |
| C-DIAG-DATE-002 | High | disease date | invalid startDate/endDate is accepted and persisted as null. | Production implementation wave: reject invalid dates with safe 400 response; avoid stack trace/noisy parser output. |
| C-DIAG-DATE-003 | High | disease date | endDate before startDate is accepted. | Production implementation wave: server-side chronological validation. |
| C-DIAG-OUTCOME-001 | Medium | disease outcome | unknown outcome not in UI preset allowlist is persisted as-is. | Production implementation wave: define server-side allowlist or documented free-text policy; if allowlist, reject unknown values. |
| C-SOAP-DATE-001 | High | SOAP performDate | invalid performDate is accepted and silently falls back to current date while persisting local SOAP document. | Production implementation wave: fail closed with safe 400 or explicit UI warning + audited fallback policy. |
| C-LOG-001 | Medium | date parsing/logging | date blocker tests show parser warnings/stack traces for synthetic invalid dates. | Production implementation wave: sanitize parser logging and return client-safe error without stack exposure in normal evidence. |
| C-ORCA-SPEC-001 | Medium | ORCA mutation gates | diseasev3 and subjectivesv2 live mutation behavior remains unverified by design. | 要 ORCA 公式仕様確認。Future gate only after explicit coordinator approval. |

## Threat / misuse cases considered

| Misuse case | Test / evidence |
|---|---|
| Client tampers `layer=orca-mirror` or `candidateOnly=true` to author non-local disease | server rejects mirror/candidate authoring |
| Candidate/mirror disease silently becomes insurance-local truth | UI test confirms candidate does not persist before explicit confirm; mirror has no edit/delete actions |
| Date/outcome tampering creates clinically unsafe disease record | blocker evidence captures date nulling, reversed dates, unknown outcome |
| SOAP local save is mistaken for ORCA subjectivesv2 mutation | API and wording tests fix local-only `/api/local/charts/subjectives` boundary |
| Invalid SOAP performDate records under wrong date | blocker evidence captures current fallback behavior |

## ORCA boundary statement

Agent C did not perform live ORCA mutation; diseasev3 and subjectivesv2 remain future gates requiring official-spec confirmation.

All test evidence is local/server/static/unit only and must not be described as live ORCA success. MSW/unit/local/static success in this branch is not live ORCA verified.

## Merge recommendation

merge as-is for Wave 1 test evidence.

Do not treat this as release-ready for disease/SOAP clinical input until blockers C-DIAG-DATE-001, C-DIAG-DATE-002, C-DIAG-DATE-003, C-DIAG-OUTCOME-001, and C-SOAP-DATE-001 are addressed in a production implementation wave.

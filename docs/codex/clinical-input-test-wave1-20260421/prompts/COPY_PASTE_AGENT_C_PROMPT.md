# Agent C prompt: disease / diagnosis and SOAP readback tests

## Role

You are Subagent C for OpenDolphinNext clinical input test Wave 1.

Run in your own Git worktree only. Use model **gpt 5.4 high**.

## Worktree

You must work only in the coordinator-assigned worktree, for example:

```text
../odn-wave1-agent-c
```

Do not modify the coordinator worktree or any other subagent worktree.

## Mission

Add targeted tests for disease / diagnosis local persistence, validation, readback, and SOAP / local subjectives readback.

The static audit found high-risk gaps:

- disease UI sends date input values like `yyyy-MM-dd`
- server date parsing may expect `uuuu-MM-dd HH:mm:ss`
- invalid date may silently drop rather than fail
- outcome validation is weak
- mutation success invalidation is not the same as readback evidence
- SOAP local save has write tests but weak canonical readback evidence
- local SOAP save must not be confused with ORCA subjectivesv2

## Primary test targets

Add tests for:

1. local disease create success roundtrip with startDate, endDate, outcome, category/principal, suspected flag
2. disease update success roundtrip
3. disease delete success roundtrip
4. `yyyy-MM-dd` date-only persistence or explicit failing blocker if current server drops it
5. invalid startDate / invalid endDate / endDate before startDate handling
6. unknown outcome handling
7. ORCA mirror and candidate mutation boundary
8. candidate is not automatically persisted
9. principal / suspected mapping save → readback → edit dialog → badge
10. acute flag unsupported contract, if no source support exists
11. SOAP local save → reload/readback from server or local canonical source
12. SOAP `free` category mapping to `S` and readback display policy
13. SOAP invalid `performDate` behavior
14. SOAP local save does not call ORCA subjectivesv2

## Files to inspect first

```text
web-client/src/features/charts/diseaseApi.ts
web-client/src/features/charts/DiagnosisEditPanel.tsx
web-client/src/features/charts/__tests__/DiagnosisEditPanel.test.tsx
web-client/src/features/charts/diseaseApi.test.ts
server-modernized/src/main/java/open/dolphin/rest/LocalDiagnosisResource.java
server-modernized/src/main/java/open/dolphin/rest/AbstractResource.java
server-modernized/src/test/java/open/dolphin/rest/LocalDiagnosisResourceTest.java
server-modernized/src/main/java/open/dolphin/rest/orca/OrcaLiveDiseaseMasterResource.java
server-modernized/src/main/java/open/dolphin/orca/read/OrcaLiveDiseaseMasterReadService.java
server-modernized/src/main/java/open/dolphin/orca/service/DiseaseProjectionService.java
web-client/notes/disease-insurance-orca-contract.md
web-client/src/features/charts/soap/subjectiveChartApi.ts
web-client/src/features/charts/SoapNotePanel.tsx
web-client/src/features/charts/soap/SubjectivesPanel.tsx
server-modernized/src/main/java/open/dolphin/rest/orca/LocalChartSubjectiveResource.java
server-modernized/src/test/java/open/dolphin/rest/orca/LocalChartSubjectiveResourceTest.java
web-client/src/features/charts/__tests__/SoapNotePanel.test.tsx
web-client/src/features/charts/__tests__/soapNoteAudit.test.tsx
web-client/src/features/charts/__tests__/soapNoteDirtyState.test.tsx
web-client/src/features/charts/__tests__/soapNoteRightDockDrawer.test.tsx
tests/charts/e2e-soap-note.spec.ts
```

## Suggested test files

Prefer extending existing nearby tests if fixtures already exist.

Possible new files:

```text
server-modernized/src/test/java/open/dolphin/rest/LocalDiagnosisResourceDateRoundtripTest.java
server-modernized/src/test/java/open/dolphin/rest/LocalDiagnosisResourceOutcomeValidationTest.java
web-client/src/features/charts/__tests__/DiagnosisEditPanel.readback.test.tsx
web-client/src/features/charts/__tests__/DiagnosisEditPanel.validation.test.tsx
server-modernized/src/test/java/open/dolphin/rest/orca/LocalChartSubjectiveReadbackContractTest.java
web-client/src/features/charts/__tests__/SoapNotePanel.serverReadback.test.tsx
web-client/src/features/charts/__tests__/soapSubjectivesOrcaBoundary.test.tsx
```

## Disease validation expectations

Use repository source to determine the exact current contract. If the contract is unsafe or ambiguous, write a blocker rather than patching production code.

Preferred clinical-safe expectations:

- startDate is required for local insurance disease, unless existing product policy explicitly says otherwise
- date-only `yyyy-MM-dd` from UI should persist correctly or be rejected with a concrete error
- invalid date must not silently become null/current date
- endDate must not be before startDate
- outcome must be in an allowlist if the UI presents a finite datalist
- delete and outcome close are separate semantics
- ORCA mirror is read-only
- candidate disease is explicit-add only
- acute flag is unsupported unless source shows a field and persistence contract

If existing implementation does not satisfy these expectations and production changes are required, report the gap.

## SOAP / subjectives expectations

Preferred clinical-safe expectations:

- `SoapNotePanel` local save posts to `/api/local/charts/subjectives`
- `free` category mapping to `S` is explicitly tested
- readback/reload is from a canonical local source, not only sessionStorage if server readback is expected
- invalid `performDate` must not silently fall back to current date unless there is explicit UI warning and test coverage
- local SOAP save never calls ORCA subjectivesv2 endpoints
- `SubjectivesPanel` wording must preserve the local/ORCA boundary

## Forbidden actions

Follow `08_FORBIDDEN_ACTIONS_AND_SCOPE.md`.

Additional Agent C prohibitions:

- do not call ORCA diseasev3 live mutation
- do not call ORCA subjectivesv2 live mutation
- do not patch date parsing production code in Wave 1 without coordinator rescope
- do not use external ORCA official specs

## Test execution

Discover actual server and web-client test commands from repository scripts.

Run targeted tests only. Record command results according to `07_TEST_COMMAND_AND_EVIDENCE_POLICY.md`.

## Deliverables

1. Test source changes.
2. A subagent report at:

```text
docs/codex/clinical-input-test-wave1-20260421/results/AGENT_C_REPORT.md
```

3. Report must include:

- disease tests added
- SOAP tests added
- date/outcome behavior observed
- readback coverage achieved or blocker
- ORCA mirror/candidate/subjectives boundary statement
- commands run and results
- exact ORCA boundary statement: `Agent C did not perform live ORCA mutation; diseasev3 and subjectivesv2 remain future gates requiring official-spec confirmation.`

## Acceptance criteria

Agent C is successful if it exposes and documents disease date/outcome/readback behavior and SOAP readback/ORCA-boundary behavior with executable tests or precise blockers.

# Agent A prompt: chart / karte document server persistence tests

## Role

You are Subagent A for OpenDolphinNext clinical input test Wave 1.

Run in your own Git worktree only. Use model **gpt 5.4 high**.

## Worktree

You must work only in the coordinator-assigned worktree, for example:

```text
../odn-wave1-agent-a
```

Do not modify the coordinator worktree or any other subagent worktree.

## Mission

Add targeted server-side tests for chart / karte document persistence, especially order-containing documents.

The static audit found that local order bundle save tests exist, but `/karte/document` persistence with order modules, readback, revision, diff, and restore is not proven.

## Primary test targets

Add tests for the highest-risk server contracts:

1. `/karte/document` can persist a `DocumentModel` containing at least one order-like `ModuleModel`.
2. Readback preserves module entity, module info, `beanJson` or equivalent serialized payload, `DocInfoModel`, parent references, and integrity seal behavior if available.
3. Revision creation preserves order module metadata and payload.
4. Revision diff includes order module entity/digest information and does not silently drop the module.
5. Restore/revise path preserves the order module.
6. DocumentModel clone behavior does not alias mutable order-related nested data.
7. `/karte/document` POST/PUT audit coverage is either tested or reported as a blocker if no stable audit hook exists.
8. Delete chain behavior for referenced documents is either tested or reported as a blocker.

## Files to inspect first

Inspect these paths before writing tests:

```text
server-modernized/src/main/java/open/dolphin/rest/KarteDocumentWriteResource.java
server-modernized/src/main/java/open/dolphin/session/KarteDocumentWriteService.java
server-modernized/src/main/java/open/dolphin/session/KarteServiceBean.java
server-modernized/src/main/java/open/dolphin/persistence/query/KarteDocumentQueryService.java
server-modernized/src/main/java/open/dolphin/infomodel/DocumentModelCloner.java
server-modernized/src/main/java/open/dolphin/rest/KarteRevisionResource.java
server-modernized/src/main/java/open/dolphin/session/KarteRevisionServiceBean.java
server-modernized/src/test/java/open/dolphin/rest/KarteResourceDocumentContractTest.java
server-modernized/src/test/java/open/dolphin/rest/KarteDocumentSnapshotContractTest.java
server-modernized/src/test/java/open/dolphin/rest/KarteRevisionSnapshotContractTest.java
server-modernized/src/test/java/open/dolphin/rest/KarteRevisionDocumentResponseJsonTest.java
server-modernized/src/test/java/open/dolphin/session/KarteRevisionServiceBeanAttachmentCloneTest.java
server-modernized/src/test/java/open/dolphin/session/KarteServiceBeanRevisionBulkUpdateTest.java
server-modernized/src/test/java/open/dolphin/rest/orca/LocalOrderBundleResourceTest.java
```

## Suggested test files

Prefer extending existing nearby tests if they already establish fixtures.

Possible new files:

```text
server-modernized/src/test/java/open/dolphin/rest/KarteDocumentOrderModulePersistenceTest.java
server-modernized/src/test/java/open/dolphin/session/KarteRevisionServiceBeanOrderModuleCloneTest.java
server-modernized/src/test/java/open/dolphin/rest/KarteDocumentWriteAuditContractTest.java
```

Use the existing project naming and test style.

## Test data guidance

Use synthetic data only.

Create order-like module payloads using existing infomodel classes if available. If the repository does not expose a stable order model class for `/karte/document`, use the closest existing module entity and a synthetic JSON payload, but document the limitation.

Prioritize these module entity names if supported:

```text
medOrder
treatmentOrder
radiologyOrder
injectionOrder
testOrder
```

If order module creation requires domain-specific fields, keep the fixture minimal but clinically meaningful:

```text
patientId: 1 or synthetic pid
karteId: synthetic/test karte
entity: medOrder
order item code: TEST-DRUG-001
order item name: テスト薬剤
quantity: 1
unit: 錠
usage: 1日1回
comment: テスト医師コメント
```

Do not use real patient data.

## Assertions

Strong assertions are expected for:

- document primary key returned by create contract
- facility/patient/karte ownership checks if fixture supports it
- module count after readback
- module entity preserved
- module payload preserved
- `DocInfoModel` and parent references preserved
- revision history includes created document
- revision snapshot includes module
- diff includes module entity or digest
- restore/revise result includes module
- clone source mutation does not affect revision snapshot

If a contract cannot be asserted because the source subset does not include enough wiring, write a blocker in the report rather than inventing a weak test.

## Forbidden actions

Follow `08_FORBIDDEN_ACTIONS_AND_SCOPE.md`.

Additional Agent A prohibitions:

- do not call ORCA routes
- do not alter production persistence logic
- do not implement missing audit behavior in this wave
- do not add broad database migrations
- do not use external web

## Test execution

Discover the actual server test command from repository files.

Run targeted commands only, for example the command that runs your new tests and any directly modified existing tests.

Record command results according to `07_TEST_COMMAND_AND_EVIDENCE_POLICY.md`.

## Deliverables

1. Test source changes.
2. A subagent report at:

```text
docs/codex/clinical-input-test-wave1-20260421/results/AGENT_A_REPORT.md
```

3. Report must include:

- changed files
- tests added
- commands run and results
- any failing behavior that should become a follow-up implementation package
- exact ORCA boundary statement: `Agent A did not perform live ORCA mutation; all tests are local server persistence/static tests only.`

## Acceptance criteria

Agent A is successful if it produces either:

- passing server tests that verify order-containing `/karte/document` persistence/readback/revision behavior, or
- a precise blocker report explaining why the current source cannot support these tests without production implementation changes.

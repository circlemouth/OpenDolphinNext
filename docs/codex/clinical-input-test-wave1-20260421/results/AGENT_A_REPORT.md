# Subagent A report: chart / karte document server persistence tests

## Agent identity

```text
agent id: Subagent A
model: gpt 5.4 high
worktree path: /Users/Hayato/Documents/GitHub/odn-wave1-agent-a
branch name: codex/wave1-agent-a-order-karte-document-tests
base branch: main
base commit: 02aa1434d20615c22c23fe5cbf80938e725cfd88
RUN_ID: 20260421T044925Z
start time: 2026-04-21T13:44:00+09:00
end time: 2026-04-21T14:04:00+09:00
```

## Forbidden-action attestation

```text
external web used: no
live ORCA mutation: no
Phase 3/4/fullflow: no
production code changed: no
raw HAR/trace/video/screenshot included: no
```

## Threat / misuse cases considered

| Misuse case | Coverage / disposition |
|---|---|
| Client submits an order module whose payload is dropped before persistence | Added test verifies `KarteDocumentWriteService.addDocument` encodes `medOrder` `BundleDolphin` into `beanJson`, binds document/karte/user references, and seals integrity. |
| Revision restore/revise path aliases mutable nested order data, allowing later source mutation to change the new snapshot | Added test verifies revision clone and `DocumentModelCloner` deep-copy `ModuleInfoBean`, `BundleDolphin`, and `ClaimItem`. |
| Revision diff silently omits order entities or digest changes | Added test verifies `diffRevisions` includes `medOrder` in from/to entity lists and changed entities when `beanJson` digest changes. |
| Delete of a latest revision leaves parent order modules active | Added test verifies `deleteDocument` walks the linked chain and marks both document and order modules deleted. |
| `/karte/document` POST/PUT writes are not auditable | Blocker A-001. Existing source has delete audit only; no stable POST/PUT audit hook was present. |

## Scope completed

| Item | Status | Notes |
|---|---:|---|
| `/karte/document` order module persistence service contract | done | `addDocument` encodes synthetic `medOrder` payload, binds parent references, updates `docPk`, and invokes integrity seal. |
| Readback assembly for order module payload and module info | done | `KarteDocumentBulkFetchSupport` DETAIL readback preserves `moduleInfo`, `beanJson`, parent `DocumentModel`, and decodes payload in the existing decoder hook. |
| Revision restore/revise clone behavior | done | `createRevisionFromSource(..., "restore", ...)` preserves order metadata/payload, rebinding actor and parent revision metadata. |
| Revision diff order digest/entity coverage | done | `diffRevisions` exposes `medOrder` in from/to entity lists and changed entities. |
| DocumentModel clone nested data isolation | done | Direct `DocumentModelCloner` test verifies no aliasing for mutable order bundle/item/module info. |
| Delete chain behavior | done | Synthetic linked revision chain marks both documents and order modules as deleted. |
| POST/PUT audit coverage | partial | Blocker recorded; no production fix in this wave. |

## Changed files

| File | Type | Reason |
|---|---|---|
| `server-modernized/src/test/java/open/dolphin/session/KarteDocumentOrderModulePersistenceTest.java` | test | Adds order-containing document persistence, readback, and delete-chain tests. |
| `server-modernized/src/test/java/open/dolphin/session/KarteRevisionServiceBeanOrderModuleCloneTest.java` | test | Adds order module revision restore/diff/deep-clone tests. |
| `docs/codex/clinical-input-test-wave1-20260421/results/AGENT_A_REPORT.md` | doc | Records sanitized evidence, blockers, and merge recommendation. |

## Tests added

| Test file | Test name | Purpose | Boundary |
|---|---|---|---|
| `KarteDocumentOrderModulePersistenceTest` | `addDocumentEncodesOrderModulePayloadBindsParentReferencesAndSealsIntegrity` | Verify order module payload is encoded before persist and integrity seal is invoked. | local/server |
| `KarteDocumentOrderModulePersistenceTest` | `detailReadbackPreservesOrderModulePayloadModuleInfoAndDocumentParentReference` | Verify DETAIL readback preserves module info, `beanJson`, decoded payload, and document parent reference. | local/server |
| `KarteDocumentOrderModulePersistenceTest` | `deleteDocumentMarksReferencedOrderRevisionChainAsDeleted` | Verify delete chain marks linked documents and order modules deleted. | local/server |
| `KarteRevisionServiceBeanOrderModuleCloneTest` | `restoreRevisionPreservesOrderModuleMetadataPayloadAndRebindsParentReferences` | Verify restore/revise creation keeps order module metadata/payload and rebinds revision parent fields. | local/server |
| `KarteRevisionServiceBeanOrderModuleCloneTest` | `diffRevisionsIncludesOrderModuleEntityWhenPayloadDigestChanges` | Verify revision diff exposes `medOrder` entity and detects digest change. | local/server |
| `KarteRevisionServiceBeanOrderModuleCloneTest` | `documentModelClonerDoesNotAliasMutableNestedOrderBundleData` | Verify clone isolation for mutable order-related nested data. | local/server |

## Commands run

| Command | CWD | Result | Exit code | Output summary |
|---|---|---:|---:|---|
| `git diff --check` | repo root | PASS | 0 | No whitespace errors. |
| `mvn -f pom.server-modernized.xml -pl server-modernized -am -Dtest=KarteDocumentOrderModulePersistenceTest,KarteRevisionServiceBeanOrderModuleCloneTest test` | repo root | FAIL | 1 | Surefire stopped in `api-contract` because upstream module had no tests matching the specified pattern. No test failure. |
| `mvn -f pom.server-modernized.xml -pl server-modernized -am -Dsurefire.failIfNoSpecifiedTests=false -Dtest=KarteDocumentOrderModulePersistenceTest,KarteRevisionServiceBeanOrderModuleCloneTest test` | repo root | PASS | 0 | Tests run: 6, Failures: 0, Errors: 0, Skipped: 0. Reactor build success. |

## Not-run commands

| Command or suite | Reason |
|---|---|
| Full `mvn -f pom.server-modernized.xml -pl server-modernized -am -Pstatic-analysis verify` | Out of assigned targeted scope; this wave requested smallest targeted commands for added tests. |
| Web client lint/typecheck/test/build | No `web-client` files changed. |
| ORCA live / Phase 3 / Phase 4 / fullflow commands | Explicitly prohibited for Agent A / Wave 1. |

## Failures / blockers

| Blocker id | Severity | Area | Description | Proposed next action |
|---|---:|---|---|---|
| A-001 | High | `/karte/document` audit | `KarteDocumentWriteResource` contains delete audit behavior, but no stable POST/PUT audit record was identified for document create/update. Agent A did not add production behavior in this test-first wave. | Follow-up implementation package should add server-side POST/PUT audit events with sanitized document id, karte id, actor, outcome, and correlation/run id, then add a focused audit contract test. |
| A-002 | Medium | End-to-end JPA persistence evidence | Added tests verify service/bulk-fetch contracts with mocked `EntityManager`; they do not prove a full embedded PostgreSQL round trip for `d_document` + `d_module` JSONB. | Follow-up package can add an embedded PostgreSQL integration test if coordinator wants runtime DB round-trip evidence for this path. |

## ORCA boundary statement

```text
Agent A did not perform live ORCA mutation; all tests are local server persistence/static tests only.
```

## Merge recommendation

merge as-is

The branch adds only scoped server test sources and this sanitized report. Targeted tests pass. Blocker A-001 should be handled by a separate production implementation package because this wave explicitly forbids production fixes.

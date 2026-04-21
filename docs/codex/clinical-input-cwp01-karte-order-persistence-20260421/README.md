# CWP-01 karte/order persistence evidence docset

RUN_ID: `20260421T062850Z`

## Purpose

This docset records the CWP-01 karte/order persistence verification evidence.

CWP-01 is scoped to local chart / karte document persistence and local order persistence tests. It is not evidence of ORCA `medicalmodv2` live mutation success, and it must not be reported as Phase 3, Phase 4, fullflow, reception registration, or live ORCA mutation success.

The main integration pass merged the fixture, persistence/readback, revision/integrity, and evidence branches, then ran targeted server tests. No runtime, Playwright, e2e, Phase 3, Phase 4, fullflow, or live ORCA mutation command was run for this package.

## Verified Scope

| Area | Status | Notes |
|---|---|---|
| Evidence docset directory | Verified | This README defines the boundary and reporting result. |
| `docs/codex/README.md` index | Verified | Link added for the CWP-01 evidence docset. |
| `docs/README.md` index | Verified | Link added under Workflow Docs. |
| Local chart / karte document persistence tests | Verified | Targeted server tests passed after main integration. |
| Local order persistence tests | Verified | `medOrder`, `treatmentOrder`, and `radiologyOrder` fixture/persistence coverage passed. |
| Revision / snapshot / diff / restore / integrity tests | Verified | Targeted server tests passed after main integration. |
| Runtime / Playwright / e2e evidence | Not verified | Not run and not claimed. |
| ORCA `medicalmodv2` live mutation | Out of scope | No live ORCA mutation is allowed or claimed by CWP-01. |

## Explicit ORCA Boundary

CWP-01 evidence may support only these claims:

- local chart / karte document persistence behavior was tested
- local order persistence behavior was tested
- server and/or web behavior remained inside local persistence boundaries
- ORCA mutation was not required for the CWP-01 pass/fail decision

CWP-01 evidence must not support these claims:

- ORCA `medicalmodv2` live mutation succeeded
- ORCA Trial or production ORCA accepted a medical order mutation
- Phase 3, Phase 4, fullflow, reception registration, or live mutation completed
- local test success proves ORCA carrier compatibility

If later work needs ORCA live mutation evidence, it must be a separate work package with explicit authorization, isolated credentials handling, and a dedicated evidence policy.

## Prohibited Evidence

Do not place the following in this docset, reviewer packages, logs, summaries, or generated artifacts:

- raw HAR files
- raw browser traces
- raw videos
- raw screenshots
- credentials, tokens, cookies, Basic auth values, session IDs, or secret material
- unredacted request / response bodies that contain patient information or secret-bearing headers
- live ORCA mutation evidence or mutation payloads
- external web lookup output

Allowed evidence is limited to sanitized command summaries, exit codes, bounded test output excerpts without secrets or patient identifiers, and human-written conclusions that distinguish local persistence from ORCA mutation.

## Targeted Command Results

Targeted commands were run from the repository root in the main integration worktree.

| Target | Command | Purpose | Expected boundary | Result |
|---|---|---|---|---|
| Server local karte/document persistence | `mvn -f pom.server-modernized.xml -pl server-modernized -am -Dsurefire.failIfNoSpecifiedTests=false -Dtest=CanonicalOrderDocumentFixtureTest,KarteDocumentOrderModulePersistenceTest,KarteRevisionServiceBeanOrderModuleCloneTest,KarteRevisionSnapshotContractTest,KarteRevisionDocumentResponseJsonTest,KarteDocumentSnapshotContractTest,DocumentIntegrityServiceTest test` | Verify chart / karte document persistence, readback, revision snapshot, diff/restore, and integrity behavior. | Local persistence only; no ORCA live mutation. | exit code 0; 24 tests run, 0 failures, 0 errors, 0 skipped |
| Server local order persistence | Same targeted Maven command | Verify order payload persistence and readback. | Local persistence only; no ORCA `medicalmodv2` success claim. | exit code 0; `medOrder`, `treatmentOrder`, and `radiologyOrder` coverage included |
| Web/local contract tests | Not run | Not required for this server-local evidence package. | No Playwright/e2e/runtime claim. | not verified |
| Documentation/package checks | `git diff --check`; artifact zip creation/inspection commands in main report | Confirm docset/index changes and sanitized package shape. | Docs/package checks only; no runtime claim. | main integration result recorded in final report |

## PASS / PARTIAL / BLOCKED Criteria

PASS may be recorded only when all of the following are true:

- targeted local chart / karte document persistence tests pass
- targeted local order persistence tests pass
- sanitized evidence includes exact commands and exit codes
- no prohibited evidence is included
- the report explicitly says CWP-01 is not ORCA `medicalmodv2` live mutation success
- any runtime, Playwright, e2e, Phase 3, Phase 4, or fullflow claims are either absent or backed by separately authorized evidence

PARTIAL may be recorded when:

- at least one targeted local persistence path was verified, and any failed or skipped path is identified
- the report keeps local persistence evidence separate from ORCA mutation evidence
- no prohibited evidence is included
- remaining final status is marked `main integrationで確定` or described as an unresolved integration item

BLOCKED must be recorded when:

- targeted tests cannot be run in the main integration environment
- required implementation work is missing or conflicts after merge
- evidence would require prohibited raw artifacts or secrets to support the claim
- the only available proof would be live ORCA mutation, Phase 3, Phase 4, or fullflow evidence outside the authorized scope

## Misuse Cases Covered By This Skeleton

- A reviewer reads local persistence test output as proof of ORCA `medicalmodv2` live mutation success.
- A packaging step includes raw HAR, trace, video, screenshot, credentials, cookies, or secrets.
- A worker records unrun Playwright, e2e, runtime, Phase 3, Phase 4, or fullflow success as if it had been executed.

## Main Integration Evidence

- Fixture: `CanonicalOrderDocumentFixtureTest` covers canonical `DocumentModel` with `medOrder`, `treatmentOrder`, and `radiologyOrder`.
- Save/readback: `KarteDocumentOrderModulePersistenceTest` covers `KarteDocumentWriteService.addDocument` and bulk detail readback with module entity, metadata, `beanJson`, decoded `BundleDolphin`, and parent backreferences.
- Revision/snapshot: `KarteRevisionServiceBeanOrderModuleCloneTest` and `KarteRevisionSnapshotContractTest` cover revision snapshot, restore/revise clone paths, snapshot response mapping, and diff digest behavior for order modules.
- Integrity: `DocumentIntegrityServiceTest` covers order module `beanJson` tamper detection through document integrity conflict.

## Next Work Package

1. If HTTP-level revise/restore authorization/history-group behavior is required, add a separate resource-level test package.
2. If ORCA claim/order field semantics are required, obtain ORCA official specification confirmation first. `classCode`, `adminCode`, and claim item meanings in this CWP-01 package remain local persistence fixtures.
3. Keep live ORCA mutation, Phase 3, Phase 4, fullflow, Playwright, and runtime evidence in separate authorized work packages.

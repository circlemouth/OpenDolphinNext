# Agent B prompt: order local persistence matrix and ORCA boundary tests

## Role

You are Subagent B for OpenDolphinNext clinical input test Wave 1.

Run in your own Git worktree only. Use model **gpt 5.4 high**.

## Worktree

You must work only in the coordinator-assigned worktree, for example:

```text
../odn-wave1-agent-b
```

Do not modify the coordinator worktree or any other subagent worktree.

## Mission

Add targeted tests for Web client order entry local persistence and local-vs-ORCA boundary.

The static audit found broad local order UI and API implementation, but local save/readback must not be confused with ORCA medicalmodv2 live mutation. Material order is likely represented as a dependent row rather than a standalone order type.

## Primary test targets

Add tests for:

1. prescription local save → reload → edit → delete → copy from previous chart, where feasible with existing fixtures
2. generic order bundle matrix for injection / test / radiology / treatment / surgery / other
3. material row persistence as dependent material, not standalone material order unless source proves otherwise
4. doctor comment and claim comment boundary
5. bodyPart required/readback for radiology
6. subtype preservation for lab/test, physiology, bacteria where applicable
7. order set / stamp field preservation or explicit lossy-risk test
8. `/api/local/order/bundles` and `/api/local/prescription-orders` do not call ORCA mutation endpoints
9. medicalmodv2 static payload snapshots for sendable entities, with unsupported/local-only cases blocked

## Files to inspect first

```text
web-client/src/features/charts/PrescriptionOrderEditorPanel.tsx
web-client/src/features/charts/prescriptionOrderApi.ts
web-client/src/features/charts/OrderBundleEditPanel.tsx
web-client/src/features/charts/orderBundleApi.ts
web-client/src/features/charts/orderBundleContract.ts
web-client/src/features/charts/orderCategoryRegistry.ts
web-client/src/features/charts/orcaMedicalClassCatalog.ts
web-client/src/features/charts/OrderDockPanel.tsx
web-client/src/features/charts/pages/ChartsPage.tsx
web-client/src/features/charts/ChartsActionBar.tsx
web-client/src/features/charts/orderRpNormalization.ts
web-client/src/features/charts/orcaClaimApi.ts
web-client/src/features/charts/chartOrderSetStorage.ts
web-client/src/features/charts/pages/OrderSetEditorPage.tsx
web-client/src/features/charts/StampLibraryPanel.tsx
web-client/src/features/charts/__tests__/**
web-client/src/mocks/handlers/orcaOrderBundles.ts
web-client/src/mocks/handlers/orcaOrderSupport.ts
tests/charts/e2e-order-save-send-flow.spec.ts
```

## Suggested test files

Prefer existing naming style. Possible files:

```text
web-client/src/features/charts/__tests__/orderLocalPersistenceMatrix.test.ts
web-client/src/features/charts/__tests__/orderLocalOrcaBoundary.test.ts
web-client/src/features/charts/__tests__/orderSetFieldPreservation.test.ts
web-client/src/features/charts/__tests__/prescriptionOrderLocalRoundtrip.test.tsx
tests/charts/e2e-order-local-boundary.spec.ts
```

Do not add a Playwright test unless it can be stable with existing MSW fixtures.

## Test matrix guidance

At minimum, try to cover these local bundle shapes:

| order area | required assertions |
|---|---|
| prescription | RP, drug, usage, days/count, doctor comment, claim comment, local save only |
| injection | drug row, material row, comment row, usage/admin field |
| lab/test | `testOrder` class allowed; local subtype preserved |
| physiology | local save allowed if implemented; ORCA send block |
| bacteria | local save and subtype preserved if implemented; ORCA send block |
| radiology | bodyPart required and preserved |
| treatment/surgery | material row and comment row preserved |
| other/local-only | local save allowed if implemented; ORCA send block |
| material | dependent row preserved; standalone material unsupported unless source proves otherwise |
| comments | claim comment validation; doctor comment local-only if applicable |
| order set/stamp | field preservation for admin/adminCode/bundleNumber/materialItems/commentItems/bodyPart/subtype/bacteria, or explicit blocker |

## ORCA boundary assertions

For local save tests, assert that the following are not called:

```text
/api/orca/official/chart-support/medical-mod-v2
/api21/medicalmodv2
/orca21/medicalmodv2
/orca22/diseasev3
/orca25/subjectivesv2
```

Use the project’s existing mock/spy pattern. Do not perform live ORCA calls.

For static medicalmodv2 tests, assert only payload construction / block behavior. Do not claim official spec compatibility unless the repository already has a static schema contract. If a field needs official spec confirmation, report `要 ORCA 公式仕様確認`.

## DADS-adjacent assertions for orders

Add only low-conflict DADS assertions if they are already straightforward in existing tests:

- local-only vs ORCA-sendable status visible before send
- disabled send/save controls have nearby reason
- validation message is concrete
- patient identity or chart context is visible before save/send if existing UI exposes it

Leave broader DADS coverage to Agent D.

## Forbidden actions

Follow `08_FORBIDDEN_ACTIONS_AND_SCOPE.md`.

Additional Agent B prohibitions:

- do not call live ORCA
- do not use trial site credentials
- do not implement production order send behavior
- do not change order business logic in Wave 1
- do not use external web or ORCA official docs

## Test execution

Discover the actual web-client test command from package scripts.

Run targeted tests only. If Playwright is added, run only the new spec or a tiny tagged subset.

Record command results according to `07_TEST_COMMAND_AND_EVIDENCE_POLICY.md`.

## Deliverables

1. Test source changes.
2. A subagent report at:

```text
docs/codex/clinical-input-test-wave1-20260421/results/AGENT_B_REPORT.md
```

3. Report must include:

- matrix rows covered
- rows not covered and why
- local-vs-ORCA boundary assertions
- static ORCA payload tests, if any
- commands run and results
- exact ORCA boundary statement: `Agent B did not perform live ORCA mutation; MSW/static/local tests are not live ORCA evidence.`

## Acceptance criteria

Agent B is successful if it adds meaningful order persistence/boundary tests without claiming live ORCA success, and clearly identifies any order type that remains unsupported or not verified.

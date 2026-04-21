# CWP-04 Generic Order Matrix Report

## Subagent
- subagent id: Subagent A / CWP-04 generic order matrix
- RUN_ID: 20260421T230706Z
- local worktree path: `/Users/Hayato/Documents/GitHub/odn-cwp04-generic-order-matrix`（reference only）
- base commit: `40737ebca3b71fc86968467257fbcc8a9c8d9f29`
- branch: `codex/cwp04-generic-order-matrix`

## Scope
- generic/local order matrix coverage only.
- local save/readback/static/server/component coverage for injection / test / physiology / bacteria / radiology / treatment / surgery / otherOrder.
- ORCA mutation boundary coverage for static `medicalmodv2` preparation and `/api/local/order/bundles`.
- Phase 3 retry / Phase 4 / fullflow / live ORCA mutation are out of scope and were not run.

## Changed Files
- `server-modernized/src/test/java/open/dolphin/rest/orca/LocalOrderBundleResourceTest.java`
- `web-client/src/features/charts/__tests__/orderLocalOrcaBoundary.test.ts`
- `web-client/src/features/charts/__tests__/orderLocalPersistenceMatrix.test.ts`
- `web-client/src/features/charts/orderRpNormalization.ts`
- `docs/implementation/unified-clinical-wave1-batch2-wo4-20260421/subagent-reports/CWP04_GENERIC_ORDER_MATRIX_REPORT.md`

## Local Commands Run
- `date -u +%Y%m%dT%H%M%SZ`: exit 0
- `git worktree add -b codex/cwp04-generic-order-matrix /Users/Hayato/Documents/GitHub/odn-cwp04-generic-order-matrix 40737ebca3b71fc86968467257fbcc8a9c8d9f29`: exit 0
- `rg --files web-client/src/features/charts server-modernized/src/test/java/open/dolphin/rest/orca docs/implementation/unified-clinical-wave1-batch2-wo4-20260421 | sort`: exit 2
- `rg -n "order bundle|orderBundle|LocalOrderBundle|medicalmodv2|otherOrder|material|comment|bodyPart|selection|bacteria|physiology|testOrder|radiology|surgery|treatment|injection" web-client/src/features/charts server-modernized/src/test/java/open/dolphin/rest/orca docs/implementation/unified-clinical-wave1-batch2-wo4-20260421`: exit 2
- `find docs/implementation/unified-clinical-wave1-batch2-wo4-20260421 -maxdepth 3 -type f | sort`: exit 1
- `node -e "const p=require('./web-client/package.json'); console.log(JSON.stringify(p.scripts,null,2))"`: exit 0
- `npm test -- --run src/features/charts/__tests__/orderLocalOrcaBoundary.test.ts src/features/charts/__tests__/orderLocalPersistenceMatrix.test.ts src/features/charts/__tests__/orderBundleValidation.test.ts src/features/charts/__tests__/orderBundleBodyPart.test.tsx src/features/charts/orderSend600SubtypeSmoke.test.ts`: exit 2
- `npm test -- --run src/features/charts/__tests__/orderLocalOrcaBoundary.test.ts src/features/charts/__tests__/orderLocalPersistenceMatrix.test.ts src/features/charts/__tests__/orderBundleValidation.test.ts src/features/charts/__tests__/orderBundleBodyPart.test.tsx src/features/charts/orderSend600SubtypeSmoke.test.ts`: exit 127
- `npm ci`: exit 0
- `npm test -- --run src/features/charts/__tests__/orderLocalOrcaBoundary.test.ts src/features/charts/__tests__/orderLocalPersistenceMatrix.test.ts src/features/charts/__tests__/orderBundleValidation.test.ts src/features/charts/__tests__/orderBundleBodyPart.test.tsx src/features/charts/orderSend600SubtypeSmoke.test.ts`: exit 1
- `npm test -- --run src/features/charts/__tests__/orderLocalOrcaBoundary.test.ts src/features/charts/__tests__/orderLocalPersistenceMatrix.test.ts src/features/charts/__tests__/orderBundleValidation.test.ts src/features/charts/__tests__/orderBundleBodyPart.test.tsx src/features/charts/orderSend600SubtypeSmoke.test.ts`: exit 0
- `npm run typecheck`: exit 0
- `mvn -f pom.server-modernized.xml -pl server-modernized -am -Dsurefire.failIfNoSpecifiedTests=false -Dtest=LocalOrderBundleResourceTest,LocalOrderBundleResource600Test test`: exit 0
- `npm run verify:web-guard`: exit 0

## Local Logs
- Local tool transcript and console output for RUN_ID `20260421T230706Z`: reference only, not final evidence.
- `web-client` npm/vitest console output: reference only, not final evidence.
- `server-modernized` Maven/Surefire console output: reference only, not final evidence.

## Implementation Summary
- Added fail-closed static `medicalmodv2` blocking for `radiologyOrder` `classCode=700` when no valid 002-family `bodyPart` is present. This prevents legacy/manual local data without bodyPart from reaching ORCA payload construction.
- Extended static boundary tests for radiology missing-bodyPart block, structured generic claim comment carrier mapping, and selection-comment parameter blocking.
- Strengthened local persistence matrix assertions for readback of `items`, `materialItems`, `commentItems`, `bodyPart`, and bacteria specimen metadata.
- Added local-only update/delete matrix coverage for treatment/surgery material-row preservation and `/api/local/order/bundles` boundary.
- Added server test coverage for radiology class 700 bodyPart-required rejection and a static reflection assertion that `LocalOrderBundleResource` remains local-route scoped and does not declare official ORCA mutation route/transport fields.

## Test Coverage Summary
- frontend targeted: 5 files / 80 tests passed.
- frontend typecheck: passed.
- server focused: 48 tests passed.
- `npm ci` reported 4 low-severity npm audit findings; no critical/high findings were reported by npm.

## Threat / Misuse Cases Covered
- Missing or invalid radiology bodyPart on local/legacy data: blocked before static ORCA payload construction and rejected server-side for local mutation.
- local-only/import-only/unsupported entities (`otherOrder`, `bacteriaOrder`, `physiologyOrder`) being treated as ORCA-sendable: covered by static boundary tests.
- Selection comment parameters without official `medicalmodv2` carrier: blocked in frontend save/static send and server validation coverage.
- `/api/local/order/bundles` accidentally becoming an ORCA mutation bridge: local endpoint tests assert no ORCA mutation URL usage, and server reflection coverage keeps the resource route scoped to local.

## Risks / Blockers
- No live ORCA behavior was verified by design. Static/MSW/local/server tests are not live ORCA success evidence.
- ORCA official semantics for some classCode/bodyPart/comment/material carrier details still require official ORCA specification confirmation before expanding sendability.
- Full `web-client npm run ci` and full `server-modernized -Pstatic-analysis verify` were not run in this subagent scope; recommended for main-worktree integration.

## Recommended Main-Worktree Verification Commands
- `cd web-client && npm test -- --run src/features/charts/__tests__/orderLocalOrcaBoundary.test.ts src/features/charts/__tests__/orderLocalPersistenceMatrix.test.ts src/features/charts/__tests__/orderBundleValidation.test.ts src/features/charts/__tests__/orderBundleBodyPart.test.tsx src/features/charts/orderSend600SubtypeSmoke.test.ts`
- `cd web-client && npm run typecheck`
- `mvn -f pom.server-modernized.xml -pl server-modernized -am -Dsurefire.failIfNoSpecifiedTests=false -Dtest=LocalOrderBundleResourceTest,LocalOrderBundleResource600Test test`
- `cd web-client && npm run ci`
- `mvn -f pom.server-modernized.xml -pl server-modernized -am -Pstatic-analysis verify`

## Explicit Non-Inclusions
- raw artifact inclusion: none
- live ORCA mutation: not run
- Phase 3 / Phase 4 / fullflow: not run
- final ZIP / final sidecar / `artifact-sha256.txt`: not created
- `FINAL_REPORT.md` / `MAIN_AGENT_REPORT.md`: not created

# RWO-04 Safe Browser Treatment UI Evidence

RUN_ID: `20260423T220304Z`

## Scope
- Work Order: RWO-04 representative generic order browser e2e and persistence.
- Target: treatment/procedure order create, readback, update, and delete through the Charts UI.
- Execution mode: no-live, artifact-free Playwright wrapper with local-only route stubs.
- Live ORCA Trial: not run.
- Production ORCA: not applicable.
- S3 / MinIO / object storage: not applicable.

## Result
- RWO-04 treatment/procedure UI create/update/delete: `PASS`.
- Combined safe browser suite: `8 passed / 0 skipped / 0 failed`.
- Retained forbidden browser artifacts under `test-results/no-artifacts`: `0`.
- Credentials captured: `false`.
- Raw artifacts captured: `false`.

## Root Cause / Fix
- The previous treatment-order UI path had two separate blockers:
  - The release test still treated the RWO-04 flow as an intentional skip.
  - The order summary pane exposed edit/readback but had no stable delete action, while the shared order-bundle client incorrectly applied create/update `classCode` validation to delete operations.
- Implemented a confirmation-based delete action in the Charts order summary pane and routed it through `mutateOrderBundles`.
- Adjusted `mutateOrderBundles` so delete operations are not rejected for missing `classCode`; server-side authorization and delete validation remain authoritative.
- Added a focused unit regression proving treatment delete is sent without client-side classCode backfill.
- Updated the safe browser fixture to allow only sanitized read-only local stubs for treatment-related master/material and medication-get lookups, while unexpected ORCA paths still fail closed.

## Verification
```text
npm run --prefix web-client test -- src/features/charts/__tests__/orderBundleApi.test.ts
```

Result: `pass` (`27` tests). The command also ran the `verify:web-guard` pretest.

```text
PLAYWRIGHT_DISABLE_MSW=1 npm run --prefix web-client test:e2e:no-artifacts -- --run-id 20260423T220304Z tests/e2e/safe-no-artifacts/charts-missing-context-recovery.safe.spec.ts
```

Result: `pass` (`5` tests).

```text
PLAYWRIGHT_DISABLE_MSW=1 npm run --prefix web-client test:e2e:no-artifacts -- --run-id 20260423T220304Z tests/e2e/safe-no-artifacts/charts-missing-context-recovery.safe.spec.ts tests/e2e/safe-no-artifacts/local-clinical-persistence.safe.spec.ts
```

Result: `pass` (`8` tests).

```text
npm run --prefix web-client typecheck
```

Result: `pass`. The command also ran the `verify:web-guard` precheck.

```text
find test-results/no-artifacts -maxdepth 3 -type f
```

Result: retained files `0`.

## Claim Boundary
This evidence supports no-live artifact-free browser coverage for representative treatment-order UI create/readback/update/delete. It does not claim live ORCA Trial success, production ORCA readiness, S3/object-storage readiness, fullflow success, broad per-order-class live acceptance, or final release readiness.

## Next Action
Continue roadmap work with RWO-05/RWO-09/RWO-11 gaps: broaden safe SOAP/disease browser evidence where needed, keep fullflow gated until a safe no-artifact mode exists, and refresh package/final release summaries only after current-head evidence is accepted.

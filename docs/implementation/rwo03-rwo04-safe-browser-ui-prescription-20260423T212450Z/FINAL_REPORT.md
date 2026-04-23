# RWO-03/RWO-04 Safe Browser UI Prescription Evidence

RUN_ID: `20260423T212450Z`

## Scope
- Work Orders: RWO-03 prescription browser UI evidence, RWO-04 representative order browser UI follow-up.
- Target: no-live, artifact-free browser gate only.
- Live ORCA Trial: not run.
- Production ORCA: not applicable.
- S3 / MinIO / object storage: not applicable.

## Result
- RWO-03 prescription UI save/update evidence: `PASS`.
- RWO-04 representative treatment-order full UI save/update/delete evidence: `BLOCKED`, retained as an intentional skipped test target.
- Credentials captured: `false`.
- Raw artifacts captured: `false`.

## Changes
- Expanded `tests/e2e/safe-no-artifacts/charts-missing-context-recovery.safe.spec.ts` with local-only prescription order stubs and a browser-executed prescription save/update flow.
- Added read-only safe stubs for `/api/orca/master/youhou`, `/api/orca/master/drug`, and `/api/orca/master/generic-price`.
- Preserved unexpected ORCA path fail-closed behavior through the `blockedOrcaPaths` assertion.
- Kept the representative treatment-order UI test skipped with a code comment documenting the current blocker: coded row reflection succeeds, but the Charts/right-drawer path does not emit a local save mutation.

## Verification
```text
PLAYWRIGHT_DISABLE_MSW=1 npm run --prefix web-client test:e2e:no-artifacts -- --run-id 20260423T212450Z tests/e2e/safe-no-artifacts/charts-missing-context-recovery.safe.spec.ts tests/e2e/safe-no-artifacts/local-clinical-persistence.safe.spec.ts
```

Result: `7 passed / 1 skipped / 0 failed`.

```text
npm run --prefix web-client typecheck
```

Result: `pass`.

```text
find test-results/no-artifacts -maxdepth 3 -type f
```

Result: retained files `0`.

## Claim Boundary
This evidence supports Trial-backed release-readiness progress for no-live artifact-free browser coverage only. It does not claim live ORCA Trial success, production ORCA readiness, S3/object-storage readiness, fullflow success, or final release readiness.

## Next Action
Repair the RWO-04 treatment-order Charts/right-drawer save path so the representative UI create/update/delete test can be unskipped and counted as browser evidence.

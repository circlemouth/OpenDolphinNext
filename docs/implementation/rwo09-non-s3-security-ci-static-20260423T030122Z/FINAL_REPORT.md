# RWO-09 Non-S3 Security / CI Static Evidence Report

RUN_ID: `20260423T030122Z`

## Verdict

`RWO09_NON_S3_SECURITY_CI_STATIC_PASS_PARTIAL_RUNTIME_SCOPE`

## Scope

- Work Order checked: RWO-09
- Execution mode: repo-local static/CI guards, no live ORCA, no S3/MinIO/object-storage setup
- Live ORCA action: `not_run`
- ORCA endpoint/target/request class: `not_applicable_no_live_orca_static_ci_checks`
- S3/MinIO/object-storage action: `not_run`

## Actions

1. Confirmed current branch, HEAD, status, and registered worktrees before selecting RWO-09.
2. Re-ran web-client security/taxonomy guards and typecheck on the current dirty tree.
3. Re-ran the safe no-artifacts browser suite for the RWO-02 through RWO-05 partial browser evidence and confirmed no retained output files.
4. Ran server-modernized repo-local CI guard scripts for config contract, direct runtime lookup, runtime DDL, persistence entities, generated artifacts, and doc links.
5. Ran direct grep checks for runtime lookup and facility-id drift.
6. Ran server-modernized Maven `static-analysis verify`.

## Results

| Check | Result | Notes |
|---|---|---|
| Web guard | PASS | `verify:no-public-secrets`, ORCA route taxonomy guard, and legacy auth drift guard passed. |
| Web typecheck | PASS | `tsc -b --noEmit` passed after pretypecheck guard. |
| Safe browser suite | PASS | 4 Playwright tests passed through `run-safe-playwright-no-artifacts.mjs`. |
| No retained browser artifacts | PASS | `test-results/no-artifacts` contained no files after the run. |
| Server CI guard scripts | PASS | Config contract, no direct runtime lookup, no runtime DDL, persistence entities, no generated artifacts, and doc links passed. |
| Direct runtime lookup grep | PASS | Only the expected `ServerConfigurationResolver.java` `ConfigProvider.getConfig()` lookup was present. |
| `dolphin.facilityId` grep | PASS | 0 hits. |
| Server Maven static analysis verify | PASS | Reactor build success; server surefire reported 959 tests / 0 failures / 0 errors / 3 skipped, failsafe 9 tests passed, SpotBugs bug count 0. |

## Claim Boundary

This evidence advances the Trial-backed non-S3 RWO-09 security/static/CI gate. It does not claim runtime-ready smoke, live Trial ORCA business success, production ORCA readiness, S3/object-storage readiness, fullflow readiness, or final release GO.

## Security Notes

- Credentials printed or captured: `no`
- Raw ORCA request/response body captured: `no`
- Raw patient/insurance detail captured: `no`
- HAR/trace/video/screenshot/raw network dump captured: `no`
- Production ORCA attempted: `no`
- S3/MinIO/object-storage configuration requested or used: `no`

## Remaining Gaps

- Runtime-ready smoke was not run because RWO-09 was limited here to repo-local non-secret checks.
- Live Trial ORCA remains skipped unless an approved non-S3 runtime path is available.
- Fullflow remains `not_run` until browser and live endpoint prerequisites are satisfied and the fullflow harness is artifact-safe.
- Package/review bundle generation and final owner GO/NO-GO remain future RWO-09/RWO-11 work.

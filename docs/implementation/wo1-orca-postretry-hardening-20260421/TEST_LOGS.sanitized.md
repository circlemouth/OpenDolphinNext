# WO-1 Test Logs Sanitized

RUN_ID: `20260421T101349Z`

## Passed

- `git diff --check`: PASS
- `node --check` for changed JS/MJS and package tests: PASS
- `bash -n scripts/create-review-package.sh scripts/tools/command-log-wrapper.sh`: PASS
- docset SHA256 manifest verification: PASS
- focused Vitest: PASS, 4 files / 86 tests after C7 hardening
- review package tests: PASS, package validation suite including ledger and placeholder timestamp coverage
- Phase 3 retry `artifact-sha256.txt` verification from repo root: PASS
- `node scripts/tools/validate-artifact-ledger.mjs docs/implementation/orca-trial-phase3-retry-20260421T060636Z`: PASS
- `npm run lint`: PASS
- `npm run test:ci`: PASS, 195 files / 1304 tests passed / 2 skipped
- review package creation: PASS, 2339 files / 18997117 bytes / sha256 `f0e37676f3d3cf134063efee984c773011a2eda825e3fd8a1ef8eefee5f272c5`
- final review ZIP source-scope secret scan: PASS
- review package metadata validation: PASS
- review package artifact ledger verification: PASS

## Failed / Superseded

- `npm run typecheck`: FAIL, existing WO-2 DADS/chart typing failures in `src/features/charts/__tests__/dadsClinicalInputContract.test.tsx`.
- `npm run build`: FAIL, blocked by the same typecheck failures.
- `phase3-artifact-ledger-verify.log`: FAIL because it was first run from the evidence directory against repo-relative ledger paths. Superseded by `phase3-artifact-ledger-verify-repo-root.log` and `phase3-artifact-ledger-validator.log`, both PASS.

## Explicit Not Run

- Phase 3 retry rerun: no
- Phase 4: no
- fullflow: no
- live ORCA mutation: no
- candidates `00002` through `00011` mutation: no
- Request_Number `02` / `03` / `04` execution: no
- Clinical Wave 1: no
- Static/DADS recovery fixes: no

Full timestamped command evidence is under `command-logs/` and summarized in `command-log.jsonl`.

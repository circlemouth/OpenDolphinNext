# WO-2 Static / DADS Recovery Test Logs

RUN_ID: `20260421T111148Z`

## Command Results

| Command | Exit | Result | Evidence |
| --- | ---: | --- | --- |
| `git diff --check` | 0 | PASS | `command-logs/git-diff-check.log` |
| `node --check ...` | 0 | PASS | `command-logs/node-check.log` |
| `bash -n ...` | 0 | PASS | `command-logs/bash-n.log` |
| `npm run typecheck` | 0 | PASS | `command-logs/npm-run-typecheck.log` |
| `npm test -- --run src/features/charts/__tests__/dadsClinicalInputContract.test.tsx` | 0 | PASS | `command-logs/focused-dadsClinicalInputContract.log` |
| `npm run build` | 0 | PASS | `command-logs/npm-run-build.log` |
| `npm run lint` | 0 | PASS | `command-logs/npm-run-lint.log` |
| `npm run test:ci` | 0 | PASS | `command-logs/npm-run-test-ci.log` |
| `node --test tests/review-package/create-review-package.test.mjs` | 0 | PASS | `command-logs/review-package-tests.log` |
| `./scripts/create-review-package.sh ...` | 0 | PASS | `command-logs/create-review-package.log` |
| `node scripts/tools/validate-review-package-metadata.mjs ...` | 0 | PASS | `command-logs/final-zip-metadata-validation.log` |
| `shasum -a 256 -c artifact-sha256.txt` | 0 | PASS | `command-logs/artifact-ledger-verify.log` |

## Static Summary

- `npm run typecheck`: restored static health for the WO-2 DADS/chart typing failures.
- `npm run build`: PASS. Vite emitted the existing large chunk warning only.
- `npm run lint`: PASS with existing warnings, 0 errors.
- `npm run test:ci`: PASS, 195 test files passed; 1305 passed / 2 skipped.
- Focused DADS chart test: PASS, 4 tests passed.

## Scope Guard

- Phase 3 retry rerun: no.
- Phase 4: not_run.
- fullflow: not_run.
- new mutation: no.
- Clinical Wave 1: not_started.
- Raw ORCA request/response bodies, raw patient details, raw insurance details, HAR, trace, video, screenshot, raw network dump, raw credentials, cookies, Authorization values, JSESSIONID, CSRF token values, raw sessions, raw passwords, and credential-bearing URLs were not generated for this WO-2 package.

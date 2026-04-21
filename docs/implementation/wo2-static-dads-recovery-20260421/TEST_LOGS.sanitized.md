# WO-2 Static / DADS Recovery Test Logs

RUN_ID: `20260421T132901Z`

## Command Results

| Command | Exit | Result | Evidence |
| --- | ---: | --- | --- |
| `npm ci` | 0 | PASS | `command-logs/npm-ci.log` |
| `git diff --check` | 0 | PASS | `command-logs/git-diff-check.log` |
| source scope static inspection | 0 | PASS | `command-logs/source-scope-static-inspection.log` |
| source scope forbidden pattern scan | 0 | PASS | `command-logs/source-scope-forbidden-patterns.log` |
| `npm run typecheck` | 0 | PASS | `command-logs/npm-run-typecheck.log` |
| `npm run build` | 0 | PASS | `command-logs/npm-run-build.log` |
| `npm run lint` | 0 | PASS | `command-logs/npm-run-lint.log` |
| `npm run test:ci` | 0 | PASS | `command-logs/npm-run-test-ci.log` |
| `npm test -- --run src/features/charts/__tests__/dadsClinicalInputContract.test.tsx` | 0 | PASS | `command-logs/focused-dadsClinicalInputContract.log` |
| `node --test tests/review-package/create-review-package.test.mjs` | 0 | PASS | `command-logs/review-package-tests.log` |

## Static Summary

- `npm run typecheck`: PASS.
- `npm run build`: PASS. Vite emitted the existing large chunk warning only.
- `npm run lint`: PASS with existing warnings, 0 errors.
- `npm run test:ci`: PASS.
- Focused DADS chart test: PASS.
- Review package script tests: PASS.

## Scope Guard

- Phase 3 retry rerun: no.
- Phase 4: not_run.
- fullflow: not_run.
- new mutation: no.
- Clinical Wave 1: not_started.
- Raw ORCA request/response bodies, raw patient details, raw insurance details, HAR, trace, video, screenshot, raw network dump, raw credentials, cookies, Authorization values, JSESSIONID, CSRF token values, raw sessions, raw passwords, and credential-bearing URLs were not generated for this WO-2 package.

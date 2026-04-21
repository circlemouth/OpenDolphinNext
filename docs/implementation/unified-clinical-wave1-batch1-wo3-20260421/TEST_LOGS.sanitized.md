# WO-3 Test Logs Sanitized Summary

RUN_ID: `20260421T142818Z`

All paths below are repo-relative. Full command logs are under `docs/implementation/unified-clinical-wave1-batch1-wo3-20260421/command-logs/`.

## Final Passing Commands

| Label | Exit | Log |
|---|---:|---|
| `final-git-diff-check` | 0 | `command-logs/20260421T142818Z-final-git-diff-check.log` |
| `final-npm-typecheck` | 0 | `command-logs/20260421T142818Z-final-npm-typecheck.log` |
| `final-npm-build` | 0 | `command-logs/20260421T142818Z-final-npm-build.log` |
| `final-npm-lint` | 0 | `command-logs/20260421T142818Z-final-npm-lint.log` |
| `final-npm-test-ci-rerun2` | 0 | `command-logs/20260421T142818Z-final-npm-test-ci-rerun2.log` |
| `final-cwp01-maven-gate` | 0 | `command-logs/20260421T142818Z-final-cwp01-maven-gate.log` |
| `final-cwp05-maven` | 0 | `command-logs/20260421T142818Z-final-cwp05-maven.log` |
| `final-cwp05-web-tests` | 0 | `command-logs/20260421T142818Z-final-cwp05-web-tests.log` |
| `final-cwp02-maven` | 0 | `command-logs/20260421T142818Z-final-cwp02-maven.log` |
| `final-cwp02-web-tests` | 0 | `command-logs/20260421T142818Z-final-cwp02-web-tests.log` |
| `final-review-package-script-tests` | 0 | `command-logs/20260421T142818Z-final-review-package-script-tests.log` |
| `final-readback-label-targeted` | 0 | `command-logs/20260421T142818Z-final-readback-label-targeted.log` |
| `final-label-fix2-git-diff-check` | 0 | `command-logs/20260421T142818Z-final-label-fix2-git-diff-check.log` |

## Corrected Failures

| Label | Exit | Resolution |
|---|---:|---|
| `cwp05-postmerge-web-tests` | 1 | Found main-worktree dialog focus/select race that could drop the first typed character. Fixed by using layout-time focus/select. |
| `cwp05-postmerge-web-tests-rerun` | 1 | Same failure before focus fix. |
| `final-npm-test-ci` | 1 | Existing tests used exact labels that conflicted with DADS `※必須/※任意` label update. Fixed test assertions. |
| `final-npm-test-ci-rerun` | 1 | Follow-up label query was too broad and matched both `転帰日` and `転帰`. Fixed to target `転帰 ※任意`. |

The corrected failures are retained as negative evidence and are not counted as success. Final success claims use only the passing rerun labels above.

## Not Run

- Phase 3 retry rerun: no.
- Phase 4: not_run.
- Fullflow: not_run.
- Live ORCA mutation: no.
- Live medicalmodv2/diseasev3/subjectivesv2 success: not claimed.
- Playwright/e2e/runtime browser: not run.

# WO-6 TEST_LOGS Sanitized

RUN_ID: `20260422T062052Z`

WO-6 is docs / review-package preparation only. No app regression suite was run because app source code and package tooling source were not changed.

## Required Checks

| command | status | log |
|---|---|---|
| `git diff --check` | pass | `command-logs/final-001-git-diff-check.log` |
| `git diff --cached --check` | pass | `command-logs/final-004-git-diff-cached-check.log` |
| `bash server-modernized/tools/ci/check-doc-links.sh` | pass | `command-logs/final-002-doc-link-check.log` |
| `node --test tests/review-package/create-review-package.test.mjs` | pass, 25/25 | `command-logs/final-003-review-package-test.log` |
| package metadata validation | pass, target final ZIP sha256 `f69cca11a97cc9977f3917bf9d626d9403dfc86d5b8e67cd5324f6f5999e0515` | `review-package/OpenDolphin_WebClient-review-package-20260422T062052Z-WO6_phase4-execution-prompt.sidecars/OpenDolphin_WebClient-review-package-20260422T062052Z-WO6_phase4-execution-prompt.post-package-metadata-validation-final.log` |
| final ZIP source-scope scan | pass, target final ZIP sha256 `f69cca11a97cc9977f3917bf9d626d9403dfc86d5b8e67cd5324f6f5999e0515` | `review-package/OpenDolphin_WebClient-review-package-20260422T062052Z-WO6_phase4-execution-prompt.sidecars/OpenDolphin_WebClient-review-package-20260422T062052Z-WO6_phase4-execution-prompt.secret-scan-review-bundle.log` |
| artifact ledger verification | pass | `review-package/OpenDolphin_WebClient-review-package-20260422T062052Z-WO6_phase4-execution-prompt.sidecars/OpenDolphin_WebClient-review-package-20260422T062052Z-WO6_phase4-execution-prompt.post-package-artifact-ledger-verify-final.log` |

## Explicitly Not Run

| item | status |
|---|---|
| Phase 3 retry rerun | not_run |
| Phase 4 | not_run |
| fullflow | not_run |
| live ORCA connection test | not_run |
| live ORCA mutation | no |
| Request_Number `02`/`03`/`04` execution | not_run |
| candidates/patients `00002` through `00011` mutation | not_run |
| npm app regression | not_run, docs/package only |
| Maven app regression | not_run, docs/package only |

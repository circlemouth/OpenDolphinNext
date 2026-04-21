# WO-4 Test Logs Sanitized Summary

RUN_ID: `20260421T224445Z`

Complete command metadata is in `command-log.jsonl`; individual logs are under `command-logs/`.

## Initial Evidence

| id | exit |
|---|---:|
| `initial-branch` | 0 |
| `initial-head` | 0 |
| `initial-status` | 0 |
| `initial-diff-stat` | 0 |
| `initial-cached-diff-stat` | 0 |

## Merge / Targeted Gates

| id | exit |
|---|---:|
| `cwp04-merge` | 0 |
| `cwp04-git-diff-check` | 0 |
| `cwp04-client-targeted` | 127 |
| `main-npm-ci` | 0 |
| `cwp04-client-targeted-rerun` | 0 |
| `cwp04-server-targeted` | 0 |
| `cwp04-web-typecheck` | 0 |
| `cwp03-merge` | 0 |
| `cwp03-git-diff-check` | 0 |
| `cwp03-client-targeted` | 0 |
| `cwp03-server-targeted` | 0 |
| `cwp03-web-typecheck` | 0 |
| `cwp06-rebase-onto-main` | 0 |
| `cwp06-merge` | 0 |
| `cwp06-git-diff-check` | 0 |
| `cwp06-client-targeted` | 0 |
| `cwp06-server-targeted` | 0 |
| `cwp06-web-typecheck` | 0 |

## Final Regression

| id | exit |
|---|---:|
| `final-git-diff-check` | 0 |
| `final-web-typecheck` | 0 |
| `final-web-build` | 0 |
| `final-web-lint` | 0 |
| `final-web-test-ci` | 0 |
| `final-cwp01-maven` | 0 |
| `final-cwp05-maven` | 0 |
| `final-cwp05-client` | 0 |
| `final-cwp02-maven` | 0 |
| `final-cwp02-client` | 0 |
| `final-cwp04-client` | 0 |
| `final-cwp04-server` | 0 |
| `final-cwp03-client` | 0 |
| `final-cwp03-server` | 0 |
| `final-cwp06-client` | 0 |
| `final-cwp06-server` | 0 |
| `final-review-package-script-tests` | 0 |

## Package / Sidecar Validation

| id | exit |
|---|---:|
| `package-create` | 0 |
| `post-package-metadata-validation` | 0 |
| `post-package-source-scope-scan` | 1 |
| `post-package-source-scope-scan-rerun` | 0 |
| `post-package-artifact-ledger-verify` | 0 |
| `final-worktree-list-before-cleanup` | 0 |
| `remove-subagent-worktrees` | 0 |
| `final-git-status` | 0 |
| `final-worktree-list-after-cleanup` | 0 |

Corrected post-package negative evidence:

- `post-package-source-scope-scan` exited 1 because the scan helper treated `rg` no-match as a script failure under `set -euo pipefail`.
- `scan_review_bundle.sh` was corrected to handle no-match explicitly, and `post-package-source-scope-scan-rerun` passed.

No Phase 3 retry, Phase 4, fullflow, live ORCA mutation, HAR, trace, video, screenshot, raw network dump, raw ORCA body, credential, cookie, Authorization, JSESSIONID, CSRF token, or raw patient-sensitive artifact was generated as test evidence.

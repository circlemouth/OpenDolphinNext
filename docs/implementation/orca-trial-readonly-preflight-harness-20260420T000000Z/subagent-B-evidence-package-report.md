# Subagent B Evidence Package Report

- RUN_ID: `20260420T000534Z`
- Branch: `codex/subagent-evidence-package-20260420`
- Worktree: `C:\Users\marug\Documents\GitHub\opendolphin-subagent-evidence-package`

## Scope

Hardened review package evidence generation and validation for ORCA Trial Phase 2.5 reopen. No legacy `client/` or `server/` files were modified. No live ORCA mutation, Phase 3, Phase 4, or fullflow was run.

## Files Changed

- `scripts/create-review-package.sh`
- `scripts/tools/command-log-wrapper.sh`
- `scripts/tools/scan-review-bundle.mjs`
- `scripts/tools/validate-review-package-metadata.mjs`
- `scripts/tools/zip-compat.mjs`
- `tests/review-package/create-review-package.test.mjs`
- `docs/implementation/orca-trial-readonly-preflight-harness-20260420T000000Z/subagent-B-evidence-package-report.md`

## Implemented

- Final review ZIP is scanned after creation, with sidecar command evidence bound to `target_path` and `target_sha256`.
- Root `REVIEW_LOG_INCLUSIONS_MANIFEST.txt` is always generated into the package.
- Metadata validation requires final ZIP `packageMode`, file count, size, sha256, package manifest, log inclusion manifest, generated/raw path exclusions, `.git` exclusion, and final package scan evidence.
- Secret-scan scopes are separated:
  - `dynamic_review_evidence_secret_scan_claim`
  - `bundle_included_source_scope_secret_scan_claim`
  - `package_source_secret_scan_claim`
  - `full_source_secret_scan_claim`
- `full_source_secret_scan_claim=not_claimed` and `worktree_clean=not_verified` remain enforced unless explicit evidence is added in a future contract.
- Empty logs are rejected as pass evidence.
- Command logs now support exact artifact binding via `--target-path` and `--target-sha256`.
- Raw/generated sensitive path categories are rejected, including `client/`, `artifacts/`, `.git/`, `node_modules/`, `dist/`, `target/`, `coverage/`, `test-results/`, `*.har`, traces, videos, raw screenshots, and raw network dumps.
- Added Node-only ZIP compatibility for environments without `zip/unzip/zipinfo`.

## Misuse Cases Covered

- A preliminary ZIP scan log is reused while the report claims the final review ZIP was scanned.
- Full-source secret scan or worktree-clean truth is upgraded without package-included evidence.
- Raw HAR, trace, video, screenshot, network dump, generated directory, `.git`, or legacy source path enters a review package.
- A zero-byte command log is listed as passing evidence.

## Tests

- PASS, exit 0: `bash -n scripts/create-review-package.sh; bash -n scripts/tools/command-log-wrapper.sh`
- PASS, exit 0: `node --check scripts/tools/zip-compat.mjs; node --check scripts/tools/scan-review-bundle.mjs; node --check scripts/tools/validate-review-package-metadata.mjs; node --check tests/review-package/create-review-package.test.mjs`
- PASS, exit 0: `node --test tests/review-package/create-review-package.test.mjs`
- FAIL, exit 1: `node --test tests/review-packet/reviewer-submission-packet.test.mjs`
  - Existing adjacent test failure on Windows path normalization in reviewer submission packet fixtures: `closeout-packet/qa/acceptmodv2/accept-summary.json` retains an absolute local path. This was not introduced by the review-package hardening changes and was not modified in this focused branch.

## Known Limitations

- The package manifest cannot embed proof of a post-creation scan without changing the ZIP hash. It records `package_source_secret_scan_claim=recorded_in_external_sidecar`; the external summary and sidecar command log carry the actual final ZIP scan result and hash binding.
- `worktree_clean` remains `not_verified`; clean checkout truth still requires package-included git command evidence by design.
- `full_source_secret_scan_claim` remains `not_claimed`; this branch does not run or claim a full source scan.

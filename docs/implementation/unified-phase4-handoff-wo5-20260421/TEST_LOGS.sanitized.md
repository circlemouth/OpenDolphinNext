# WO-5 Test Logs

RUN_ID: `20260421T235522Z`

REOPEN_RUN_ID: `20260422T050934Z`

Complete command metadata is in `command-log.jsonl`; individual logs are under `command-logs/`.

## Required Results

| command | result | log |
|---|---:|---|
| `git branch --show-current` | 0 | `docs/implementation/unified-phase4-handoff-wo5-20260421/command-logs/003_git_branch_show_current.log` |
| `git rev-parse HEAD` | 0 | `docs/implementation/unified-phase4-handoff-wo5-20260421/command-logs/004_git_rev_parse_head.log` |
| `git status --short` | 0 | `docs/implementation/unified-phase4-handoff-wo5-20260421/command-logs/005_git_status_short.log` |
| `git diff --stat` | 0 | `docs/implementation/unified-phase4-handoff-wo5-20260421/command-logs/006_git_diff_stat.log` |
| `git diff --cached --stat` | 0 | `docs/implementation/unified-phase4-handoff-wo5-20260421/command-logs/007_git_diff_cached_stat.log` |
| `git diff --check` | 0 | `docs/implementation/unified-phase4-handoff-wo5-20260421/command-logs/reopen-final-git-diff-check.log` |
| `bash server-modernized/tools/ci/check-doc-links.sh` | 0 | `docs/implementation/unified-phase4-handoff-wo5-20260421/command-logs/reopen-final-doc-link-check.log` |
| `node --test tests/review-package/create-review-package.test.mjs` | 0 | `docs/implementation/unified-phase4-handoff-wo5-20260421/command-logs/reopen-final-review-package-script-tests.log` |
| package metadata validation for final WO-5 ZIP | 0 after ledger path correction | `docs/implementation/unified-phase4-handoff-wo5-20260421/command-logs/post-package-metadata-validation-current.log` |
| final ZIP source-scope scan | 0 | `docs/implementation/unified-phase4-handoff-wo5-20260421/review-package/<final-zip>.secret-scan-review-bundle.log` |
| artifact ledger verification | 0 | `docs/implementation/unified-phase4-handoff-wo5-20260421/command-logs/post-package-artifact-ledger-verify-current.log` |

## Corrected Findings

- `node --test tests/review-package/create-review-package.test.mjs` failed in existing package tooling test `finalizes sanitized ORCA readonly evidence summary and package sidecar fields`.
- Failure detail: the sandbox fixture writes a `command-log.jsonl` entry without required `cwd`, and `scripts/tools/orca-readonly-evidence-finalizer.mjs` correctly rejects it with `command log JSONL line 1 missing cwd`.
- Reopen fix: the positive fixture now includes `cwd`, `start_utc`, `end_utc`, and `exit_code`.
- Reopen negative coverage: the same test first writes malformed JSONL without `cwd` and asserts the finalizer rejects it.
- Finalizer behavior was not relaxed.
- Final rerun exits 0.
- First package metadata validation attempt failed because `artifact-sha256.txt` used repo-root-relative entries while the validator resolves review-package sidecar entries relative to `review-package/`; the ZIP was not changed for that correction.
- `artifact-sha256.txt` was regenerated relative to `review-package/`, then metadata validation passed.

## Explicitly Not Run

| flow | status |
|---|---|
| Phase 3 retry rerun | not_run |
| Phase 4 | not_run |
| fullflow | not_run |
| live ORCA mutation | no |
| mutation for `00002` through `00011` | not_run |
| Request_Number `02` / `03` / `04` execution | not_run |

## Claim Boundary

- WO-5 is docs/package/report only.
- Clinical Wave 1 coverage remains local/server/component/static only.
- live medicalmodv2 / diseasev3 / subjectivesv2 success is not claimed.
- WO-2 reopen package evidence remains owner-waived / not_verified.

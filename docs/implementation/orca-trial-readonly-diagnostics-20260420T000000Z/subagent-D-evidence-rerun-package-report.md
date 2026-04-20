# Subagent D Evidence Rerun Package Report

RUN_ID: `20260420T055547Z`

## Scope

Prepared sanitized evidence rerun packaging and validation support for OpenDolphinNext ORCA Trial Phase 2.5. No live ORCA read-only rerun, Phase 3, Phase 4, fullflow, or mutation request was executed.

## Misuse Cases Considered

| Misuse case | Control added |
| --- | --- |
| Empty command logs are treated as pass evidence. | Command log validation now requires command/cwd/runId/start/end/exit_code plus non-empty command output evidence. Silent commands get an explicit no-output marker from the wrapper. |
| A final package summary claims scans or clean checkout truth that were not actually verified. | Package metadata validation keeps `full_source_secret_scan_claim=not_claimed` and `worktree_clean=not_verified` unless explicit evidence exists, and binds package source-scope scan logs to the final ZIP path and SHA-256. |
| Raw ORCA/network/credential artifacts are included in the review package or evidence directory. | Package inclusion checks and the new finalizer reject raw artifact paths and credential/session/token secret patterns before generating final summaries and hashes. |

## Script/Test Changes

- `scripts/tools/command-log-wrapper.sh`
  - Records `[no stdout/stderr emitted]` when a wrapped command succeeds or fails silently, so command output evidence is never empty.
- `scripts/create-review-package.sh`
  - Rejects manifest-listed shell command logs with empty command output sections.
  - Rejects JSON command logs that lack non-empty output evidence such as `safe_result`, `output`, `stdout`, `stderr`, `result`, or `summary`.
- `scripts/tools/validate-review-package-metadata.mjs`
  - Rejects final ZIP scan command logs whose output section is empty.
- `scripts/tools/orca-readonly-evidence-finalizer.mjs`
  - New tool that validates final ZIP sidecar metadata, final ZIP source-scope scan log, metadata validation log, and sanitized Phase 2.5 status input.
  - Writes `final-summary.sanitized.json`, `final-summary.sanitized.md`, `secret-scan.sanitized.txt`, and `artifact-sha256.txt`.
  - Appends required Phase 2.5 fields to the external package `.summary.txt`.
- `tests/review-package/create-review-package.test.mjs`
  - Covers empty-output command log rejection.
  - Covers JSON command log output evidence requirements.
  - Covers finalizer generation of sanitized summaries, secret scan report, artifact hashes, and package summary fields.
- `scripts/tools/README.md`
  - Documents the finalizer and the non-empty command output policy.

## Commands Run

| Command | Result | Notes |
| --- | --- | --- |
| `date -u +%Y%m%dT%H%M%SZ` | pass | Work RUN_ID source: `20260420T055547Z`. |
| `git status --short --branch` / `git rev-parse HEAD` / `git branch --show-current` | pass | Confirmed assigned branch `codex/subagent-evidence-rerun-package-20260420` at base `03d12b012c7d0aadf963925a71054838b41f4466` before edits. |
| `bash -n scripts/create-review-package.sh scripts/tools/command-log-wrapper.sh` | pass | Shell syntax check. |
| `node --check scripts/tools/validate-review-package-metadata.mjs && node --check scripts/tools/scan-review-bundle.mjs && node --check scripts/tools/orca-readonly-evidence-finalizer.mjs && node --check tests/review-package/create-review-package.test.mjs` | pass | Node syntax check. |
| `node --test tests/review-package/create-review-package.test.mjs` | fail then pass | Initial run exposed macOS `/var` vs `/private/var` path canonicalization and an outdated credential-leak fixture. Fixed both; final run passed `22/22`. |
| Secret-pattern grep over scripts/tests/docs implementation scope | informational | Hits were intentional `should-not-ship` test fixtures plus existing env placeholder examples outside this task. No real credential value was added. |
| `git diff --check` | pass | No whitespace errors. |

## Remaining For Main After Merge

- Signal when merged diagnostic source is ready.
- Run a fresh read-only-only rerun with a new UTC `RUN_ID`.
- Use `final-summary.status.template.sanitized.json` as the input shape, replacing placeholder values with sanitized rerun results.
- Generate the review package under `docs/implementation/orca-trial-readonly-diagnostics-<RUN_ID>/`.
- Run metadata validation and the finalizer against the final ZIP.
- Do not run Phase 3, Phase 4, fullflow, or mutation unless a separate explicit authorization is given after exact selected-candidate preflight passes.

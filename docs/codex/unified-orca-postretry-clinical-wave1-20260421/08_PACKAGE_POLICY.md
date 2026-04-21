# 08. Package policy

## Package mode

Unless a full repository archive is intentionally created, use:

```text
packageMode=extracted_review_subset
```

## Required sidecar summary fields

- packageMode
- source_branch
- source_commit
- source_git_metadata_available
- worktree_clean
- zip_file_count
- zip_size_bytes
- zip_sha256
- dynamic_review_evidence_secret_scan_claim
- package_source_secret_scan_claim
- package_source_secret_scan_scope
- package_source_secret_scan_target_sha256
- full_source_secret_scan_claim
- phase3_retry_status
- no_new_mutation
- phase4_status
- fullflow_status
- clinical_wave1_status, if applicable
- static command results
- DADS applicability
- ORCA boundary
- may_run_phase4

## Required package files by Work Order

Every Work Order package should include:

- `MAIN_AGENT_REPORT.md`
- `FINAL_REPORT.md`
- `TEST_LOGS.sanitized.md`
- `command-log.jsonl` or equivalent
- `artifact-sha256.txt`
- `secret-scan.sanitized.txt`
- `final-summary.sanitized.md`
- `final-summary.sanitized.json`, when useful
- `REVIEW_PACKAGE_MANIFEST.txt`
- `REVIEW_LOG_INCLUSIONS_MANIFEST.txt`
- package metadata validation log
- final ZIP source-scope secret scan log
- sidecar `.summary.txt`

## Validation rules

Fail package validation if:

- final ZIP source scan targets a different hash than the final package hash.
- artifact ledger is missing while ledger verification is claimed.
- command log has placeholder-only timestamps.
- full source scan is claimed without evidence.
- worktree clean is claimed without git status evidence.
- forbidden raw/generated dirs are present.
- old package sidecars are confused with the current package.

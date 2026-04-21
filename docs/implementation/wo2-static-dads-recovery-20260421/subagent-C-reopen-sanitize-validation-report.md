# Subagent C Reopen Sanitize / Package Validation Report

- RUN_ID: `20260421T133037Z`
- Worktree: `/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient-wo2-subagent-C-20260421`
- Branch: `codex/wo2-reopen-subagent-C-20260421`
- Checked source HEAD: `46e78149d`
- Base branch: `codex/wo2-static-dads-recovery-main-20260421`
- Initial git status: clean before adding this report
- Scope: docs-only sanitize/package validation audit

## Confirmation Target

Audited existing WO-2 package evidence under:

`docs/implementation/wo2-static-dads-recovery-20260421/`

Primary final ZIP target:

`OpenDolphin_WebClient-review-package-20260421T111148Z-WO2_static-dads-recovery.zip`

Related validation evidence reviewed:

- `FINAL_REPORT.md`
- `MAIN_AGENT_REPORT.md`
- `TEST_LOGS.sanitized.md`
- `final-summary.sanitized.md`
- `final-summary.sanitized.json`
- `REVIEW_PACKAGE_MANIFEST.txt`
- `REVIEW_LOG_INCLUSIONS_MANIFEST.txt`
- `artifact-sha256.txt`
- `secret-scan.sanitized.txt`
- `OpenDolphin_WebClient-review-package-20260421T111148Z-WO2_static-dads-recovery.zip.summary.txt`
- `OpenDolphin_WebClient-review-package-20260421T111148Z-WO2_static-dads-recovery.zip.secret-scan-review-bundle.log`
- `command-logs/final-zip-metadata-validation.log`
- `command-logs/artifact-ledger-verify.log`

No Phase 3 retry rerun, Phase 4, fullflow, live ORCA mutation, CWP implementation, or Python execution was performed for this audit.

## Validation Checklist For Main

### 1. Final ZIP Scan Target

- Verify the scan target is the final ZIP:
  - `docs/implementation/wo2-static-dads-recovery-20260421/OpenDolphin_WebClient-review-package-20260421T111148Z-WO2_static-dads-recovery.zip`
- Do not validate a preliminary, staging, old support, or copied ZIP as the final package.
- The package directory currently has one `.zip` matching the WO-2 final package name; no `prelim` / `preliminary` ZIP was found in that directory during this audit.
- The final ZIP SHA-256 must match all of:
  - `artifact-sha256.txt`
  - final ZIP sidecar summary
  - `secret-scan.sanitized.txt`
  - `command-logs/final-zip-metadata-validation.log`
  - `command-logs/artifact-ledger-verify.log`
- Current checked SHA-256: `0182ee0475406de33dc9dba463ba5ab1bafba91b64b7c7140de9b9de6a02a482`
- Current checked file count: `2349`

### 2. Metadata Validation Target

- `validate-review-package-metadata.mjs` must be run against the final ZIP path above.
- The metadata validation log must record the same target path and SHA-256 as the final ZIP sidecar and `artifact-sha256.txt`.
- Confirm the package metadata keeps these non-overclaim fields:
  - `packageMode=extracted_review_subset`
  - `source_branch=codex/wo2-static-dads-recovery-main-20260421`
  - `worktree_clean=not_verified`
  - `full_source_secret_scan_claim=not_claimed`
  - `package_source_secret_scan_claim=passed`
- `worktree_clean=not_verified` must not be rewritten as a clean checkout claim. The support ZIP has no `.git` metadata and is not reviewer clean-checkout truth.
- `full_source_secret_scan_claim=not_claimed` must not be rewritten as full source clean. The current claim is only final review ZIP source-scope scanning.

### 3. Artifact Ledger Correctness

- The active WO-2 ledger is:
  - `docs/implementation/wo2-static-dads-recovery-20260421/artifact-sha256.txt`
- It should contain only current WO-2 package artifacts:
  - final ZIP
  - final ZIP `.summary.txt`
  - final ZIP `.secret-scan-review-bundle.log`
- It must not include old WO-1 artifacts, readonly rerun artifacts, or historical ledger rows from:
  - `docs/implementation/wo1-orca-postretry-hardening-20260421/`
  - `docs/implementation/orca-trial-readonly-*`
  - `docs/codex/unified-orca-postretry-clinical-wave1-20260421/references/readonly-rerun-*`
- Historical tracked documents may exist inside the source-support ZIP as repository context. They must not be treated as active WO-2 ledger evidence.
- `shasum -a 256 -c artifact-sha256.txt` must be executed from the WO-2 package directory and must verify only the three current WO-2 entries.

### 4. Raw Artifact Exclusion Policy

The final package and sidecar/report evidence must not include raw live or sensitive artifacts:

- raw ORCA request/response bodies
- raw patient details
- raw insurance details
- HAR files
- trace files
- video files
- screenshots
- raw network dumps
- credential-bearing URLs
- raw credential values
- cookie values
- Authorization values
- JSESSIONID values
- CSRF token values
- raw session values
- raw password values
- nested old ZIPs

The reviewed manifests state these exclusions, and the final ZIP scan evidence points to the final ZIP SHA-256. Filename-only checks can produce false positives for source/test fixtures with ORCA-related names; the decision point should be whether an entry is raw runtime/live evidence or credential/sensitive material, not whether a source fixture contains ORCA terminology.

### 5. Report / Summary Consistency

- `FINAL_REPORT.md`, `TEST_LOGS.sanitized.md`, `final-summary.sanitized.md`, and `final-summary.sanitized.json` should continue to state:
  - Phase 3 rerun: `no`
  - Phase 4: `not_run`
  - fullflow: `not_run`
  - new mutation: `no`
  - Clinical Wave 1: `not_started`
- Static / DADS recovery evidence must not be represented as live ORCA mutation, fullflow, or clinical Wave 1 evidence.
- `may_start_WO3` is acceptable only as `yes_after_ChatGPT_review` / review-gated wording, not as unconditional live evidence approval.

## Misuse Cases Considered

1. Preliminary ZIP is scanned and passed while the final ZIP differs.
   - Required mitigation: bind every scan/log/sidecar/ledger claim to the final ZIP path and SHA-256.
2. Old WO-1 or readonly rerun ledger rows are copied into the active WO-2 ledger.
   - Required mitigation: keep `artifact-sha256.txt` limited to the three current WO-2 final package artifacts.
3. A support ZIP claim is upgraded into clean worktree or full-source secret scan truth.
   - Required mitigation: preserve `worktree_clean=not_verified` and `full_source_secret_scan_claim=not_claimed`.
4. Raw live evidence is included as review evidence.
   - Required mitigation: include only sanitized reports, command logs, summaries, manifests, sidecars, hashes, and source files allowed by the review package policy.

## Residual Risk

- The support ZIP is an extracted source/review subset and can contain historical tracked docs. Those historical docs may include old ledger filenames as repository context, so reviewers must use the WO-2 `artifact-sha256.txt` as the active ledger.
- The support ZIP does not prove clean checkout status. Clean checkout truth belongs to the reviewer submission packet flow, not this support ZIP.
- The current secret scan claim is final-review-ZIP scoped. It is not a full source clean claim.
- Raw artifact absence depends on final ZIP scanning and manifest discipline. If main regenerates the final package, all target path, SHA-256, sidecar, metadata validation, secret scan, and ledger checks must be rerun against the regenerated final ZIP.

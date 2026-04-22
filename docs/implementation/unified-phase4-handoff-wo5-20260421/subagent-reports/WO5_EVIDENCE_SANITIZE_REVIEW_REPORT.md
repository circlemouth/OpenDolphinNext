# WO-5 Evidence / Sanitize / Package Review Report

RUN_ID: `20260421T235620Z`

Status: `advisory_reference_only`

This report is advisory input for WO-5 handoff documentation. It does not create final package artifacts, final artifact ledgers, final ZIP sidecars, or canonical Phase 4 evidence.

## Reviewed Scope

- `docs/codex/unified-orca-postretry-clinical-wave1-20260421/00_CURRENT_CONTEXT.md`
- `docs/codex/unified-orca-postretry-clinical-wave1-20260421/01_EXECUTION_STRATEGY.md`
- `docs/codex/unified-orca-postretry-clinical-wave1-20260421/02_WORK_ORDERS.md`
- `docs/codex/unified-orca-postretry-clinical-wave1-20260421/06_PHASE4_HANDOFF_GATE.md`
- `docs/codex/unified-orca-postretry-clinical-wave1-20260421/07_EVIDENCE_SANITIZE_POLICY.md`
- `docs/codex/unified-orca-postretry-clinical-wave1-20260421/08_PACKAGE_POLICY.md`
- `docs/codex/unified-orca-postretry-clinical-wave1-20260421/13_ACCEPTANCE_MATRIX.md`
- `docs/codex/unified-orca-postretry-clinical-wave1-20260421/14_MAIN_AGENT_AUTONOMY_AND_STOP_POLICY.md`
- `docs/implementation/unified-clinical-wave1-batch1-wo3-20260421/FINAL_REPORT.md`
- `docs/implementation/unified-clinical-wave1-batch1-wo3-20260421/MAIN_AGENT_REPORT.md`
- `docs/implementation/unified-clinical-wave1-batch2-wo4-20260421/FINAL_REPORT.md`
- `docs/implementation/unified-clinical-wave1-batch2-wo4-20260421/MAIN_AGENT_REPORT.md`

## Evidence Classes To Keep Separate

- Functional / business gate evidence: sanitized status fields, command results, gate names, acceptance classifications, and explicit `not_run` / `not_claimed` boundaries.
- Dynamic evidence hygiene: dynamic evidence secret scan and sanitized runtime summaries only. Do not treat this as package or full-source cleanliness.
- Package source-scope hygiene: final ZIP text/source listing scan against the final ZIP hash only. Do not promote it to full-source scan.
- Metadata and integrity evidence: package summary, file count, size, ZIP sha256, source branch, source commit, package mode, and artifact ledger verification.
- Static / local clinical evidence: WO-3 and WO-4 local/server/component/static tests. Do not call these live ORCA, official ORCA compatibility, Phase 4, or fullflow evidence.
- Waiver evidence: WO-2 reopen package waiver is a boundary record only. It is not success evidence and does not verify the missing WO-2 final ZIP, metadata validation, source scan, or sidecar ledger.

## Sanitize Requirements

Future Phase 4 handoff docs and any later Phase 4 evidence should only reference sanitized JSON/MD and safe summaries. Hard exclusions should remain explicit:

- raw credentials, passwords, credential-bearing URLs, cookies, Authorization values, JSESSIONID, CSRF values, raw sessions
- raw ORCA request or response bodies
- raw patient details, raw insurance details, names, addresses, birth dates, insurance bodies
- HAR, traces, videos, raw screenshots, raw browser artifacts, raw network dumps
- generated or dependency directories such as `.git`, `node_modules`, `dist`, `target`, `coverage`, `test-results`, and raw artifact directories

Acceptable evidence should be limited to redaction placeholders, hash ledgers, command metadata, sanitized status/category fields, allowed IDs required by the gate, and explicit `not_run` / `not_verified` declarations.

## Package Scan Requirements

- The final package source-scope scan must target the exact final ZIP sha256 recorded in the same package summary.
- Dynamic evidence secret scan, package source-scope scan, and full-source scan must be separate fields and separate claims.
- If full-source scan was not run, record `full_source_secret_scan_claim=not_claimed`.
- If dynamic evidence was not included or not scanned in the current package, record `dynamic_review_evidence_secret_scan_claim=not_claimed` rather than implying coverage.
- Package scan pass is hygiene evidence only; it must not be described as functional success, live ORCA success, or Phase 4 readiness by itself.
- Validation should fail on any raw/browser/network artifact inclusion, final ZIP scan target hash mismatch, missing ledger while claiming ledger verification, or old sidecar reuse for the current package.

## Ledger / Manifest Expectations

For any WO-5 package that the main agent later creates, require:

- `packageMode=extracted_review_subset` unless a full repository archive is intentionally created and separately justified.
- `source_branch`, `source_commit`, `source_git_metadata_available`, `worktree_clean`, `zip_file_count`, `zip_size_bytes`, `zip_sha256`.
- `phase3_retry_status`, `no_new_mutation`, `phase4_status=not_run`, `fullflow_status=not_run`, candidate scope, and `may_run_phase4`.
- `dynamic_review_evidence_secret_scan_claim`, `package_source_secret_scan_claim`, `package_source_secret_scan_scope`, `package_source_secret_scan_target_sha256`, and `full_source_secret_scan_claim`.
- `artifact-sha256.txt` covering the package and current sidecars, plus a ledger verification log that proves all listed artifacts match.
- `REVIEW_PACKAGE_MANIFEST.txt` for included source/docs and `REVIEW_LOG_INCLUSIONS_MANIFEST.txt` for included sanitized logs/reports.
- Command logs with real start/end timestamps, cwd, runId, exit code, and repo-relative log paths.
- Explicit exclusion list for raw/browser/network artifacts and generated/dependency directories.

Post-package validation logs should remain external sidecars when embedding them would alter the ZIP hash. The report should say that clearly to avoid hash drift.

## Claim-Language Pitfalls

- Do not write `Phase 4 ready` unless approval/precheck status is qualified. Prefer `Phase 4 prompt may be prepared after review` or `may_run_phase4=no/not_approved`.
- Do not convert `not_run`, `not_verified`, or owner-waived evidence into success.
- Do not say WO-2 package evidence passed. Current wording should remain `not_available_owner_waived` / `not_verified`.
- Do not imply WO-3 or WO-4 verified live ORCA mutation, live medicalmodv2, diseasev3, subjectivesv2, official ORCA spec compatibility, browser runtime, Phase 4, or fullflow.
- Do not use HTTP 200, wrapper exit 0, package scan pass, or local/MSW/static tests as business mutation success.
- Do not treat subagent local logs as final gate evidence unless rerun or verified by the main worktree evidence.
- Do not use absolute local filesystem evidence paths in reports; use repo-relative paths only.
- Keep Request_Number boundaries explicit: `01` is the intended Phase 3 registration request number; `02/03/04` remain forbidden; `00` and `apiResult=60` are diagnostic, not success.

## Package Validation Recommendations

- Validate metadata after package creation against the final ZIP, final summary, secret scan log, and artifact ledger.
- Re-run source-scope package scan after the final ZIP is created, then compare the scan target sha256 with the final ZIP sha256.
- Verify `artifact-sha256.txt` after all external sidecars are finalized.
- Confirm manifests do not include raw ORCA bodies, raw patient/insurance details, credentials, browser/network artifacts, dependency directories, or generated build outputs.
- Check command-log timestamps are not placeholders and command outcomes are not summarized without exit codes.
- Confirm `worktree_clean` is either proven by final `git status --short` evidence or explicitly `not_verified` / `not_claimed`.
- Confirm package sidecars belong to the current package hash and are not inherited from WO-3 or WO-4.
- If any validation fails, mark the package as failed or partial; do not repair by weakening scan patterns or deleting failure evidence.

## Misuse / Claim-Risk Cases

- A future Phase 4 doc accidentally includes raw browser/network artifacts to make a gate easier to review. Required response: fail validation and replace with sanitized summaries only.
- A package scan passes against an earlier ZIP, then a sidecar or report changes the final ZIP. Required response: regenerate or rescan so the scan target hash equals the final package hash.
- WO-2 waiver or WO-3/WO-4 local tests are described as end-to-end ORCA readiness. Required response: restate waiver/local/static boundaries and keep Phase 4 `not_run`.

## Advisory Outcome

The existing policy set is directionally sufficient for WO-5 if the main agent keeps evidence classes separate and repeats the WO-2 waiver plus WO-3/WO-4 local/static boundaries in the final handoff docs. Recommended WO-5 acceptance language:

- Phase 3 retry rerun: `no`
- Phase 4: `not_run`
- fullflow: `not_run`
- live ORCA mutation: `no`
- candidates `00002`-`00011`: `not_run`
- raw sensitive/browser/network artifacts: `none_included`
- WO-2 reopen package evidence: `owner_waived / not_verified, not success evidence`
- WO-3/WO-4 evidence: `targeted local/server/component/static coverage only`
- final package readiness: `only if current package metadata validation, final ZIP source-scope scan, and artifact ledger verification pass against the current package hash`

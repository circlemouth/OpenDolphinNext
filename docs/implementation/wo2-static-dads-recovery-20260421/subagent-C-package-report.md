# Subagent C Package / Report Plan

- RUN_ID: `20260421T114224Z`
- Worktree: `/Users/Hayato/Documents/GitHub/odn-wo2-subagent-package-report`
- Branch: `codex/wo2-subagent-package-report-20260421`
- Base / checked source: `b1894e88ff2d704cbf66bfbe55fcf5319d1ec461`
- Source integration branch: `codex/wo2-static-dads-recovery-main-20260421`
- Scope: WO-2 review package/report preparation after Static / DADS recovery

## Decision

Final ZIP creation was not performed in this subagent worktree.

Reason: creating the final package here after adding this Subagent C report would bind package metadata to `codex/wo2-subagent-package-report-20260421` and its report commit, while the review package must represent the main integration worktree truth. The main agent should create and validate the final package from `/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient` after merging or otherwise including this report.

## Required Summary Fields

| Field | Value |
| --- | --- |
| `packageMode` | `extracted_review_subset` |
| `source_branch` | `codex/wo2-static-dads-recovery-main-20260421` |
| `source_commit` | `b1894e88ff2d704cbf66bfbe55fcf5319d1ec461` for current checked integration source; final package must record the actual integration HEAD used at package time |
| `worktree_clean` | `not_verified` for the support ZIP manifest/sidecar; do not upgrade this claim unless package-included git evidence supports it |
| `full_source_secret_scan_claim` | `not_claimed` |
| Phase 3 rerun | `no` |
| Phase 4 | `not_run` |
| fullflow | `not_run` |
| new mutation | `no` |
| Clinical Wave 1 | `not_started` |
| Static / DADS recovery | `completed_static_recovery_on_current_integration_source` |
| DADS applicability | Applicable to the chart clinical input contract and static DADS recovery evidence only; it is not live ORCA or clinical mutation evidence |
| may start WO-3 | `no` from this subagent deliverable alone; switch to `yes` only after the main integration worktree creates and validates the final WO-2 package |

## Static / DADS Evidence To Carry Forward

Subagent A fixed the DADS chart typing blocker without widening production contracts:

- `LetterDetailResult.letter` remains optional; the test fixture now omits `letter` instead of using `null`.
- `DiagnosisEditPanelMeta` is used for chart diagnosis test metadata instead of broadening with `any`.
- Focused DADS test passed: `npm test -- --run src/features/charts/__tests__/dadsClinicalInputContract.test.tsx` exit `0`.

Subagent B verified the merged source at `1a366ea565f33f143b556613e5b3f8a1ca57c9b3` and produced the static verification report now included in `b1894e88f`:

| Command | Result |
| --- | --- |
| `npm run typecheck` | pass, exit `0` |
| `npm run build` | pass, exit `0`; existing Vite large chunk warning only |
| `npm run lint` | pass, exit `0`; 0 errors / existing warnings only |
| `npm run test:ci` | pass, exit `0`; 1305 passed / 2 skipped |
| focused DADS clinical input contract test | pass, exit `0` |
| `git diff --check` | pass, exit `0` |

## Required Final Package Contents

Package directory:

`docs/implementation/wo2-static-dads-recovery-20260421/`

Package filename pattern:

`OpenDolphin_WebClient-review-package-<RUN_ID>_WO2_static-dads-recovery.zip`

The final package/report set should contain:

- `FINAL_REPORT.md`
- `MAIN_AGENT_REPORT.md`
- `TEST_LOGS.sanitized.md`
- `command-log.jsonl`
- `artifact-sha256.txt`
- `secret-scan.sanitized.txt`
- `REVIEW_PACKAGE_MANIFEST.txt`
- `REVIEW_LOG_INCLUSIONS_MANIFEST.txt`
- `command-logs/final-zip-metadata-validation.log`
- final ZIP source-scope secret scan log: `OpenDolphin_WebClient-review-package-<RUN_ID>_WO2_static-dads-recovery.zip.secret-scan-review-bundle.log`
- sidecar summary: `OpenDolphin_WebClient-review-package-<RUN_ID>_WO2_static-dads-recovery.zip.summary.txt`
- subagent reports:
  - `subagent-A-dads-chart-typing-report.md`
  - `subagent-B-static-verification-report.md`
  - `subagent-C-package-report.md`

Do not include raw ORCA request/response bodies, raw patient details, raw insurance details, HAR, trace, video, screenshots, raw network dumps, raw XML, credential-bearing URLs, cookies, authorization values, session identifiers, CSRF values, passwords, or nested old ZIPs.

## Main Agent Package Command Plan

Run from the integration worktree after this report is present there:

```bash
RUN_ID=<YYYYMMDDThhmmssZ>
PACKAGE_DIR=docs/implementation/wo2-static-dads-recovery-20260421
PACKAGE_ZIP="$PACKAGE_DIR/OpenDolphin_WebClient-review-package-${RUN_ID}_WO2_static-dads-recovery.zip"

./scripts/create-review-package.sh \
  --run-id "$RUN_ID" \
  --out-dir "$PACKAGE_DIR" \
  --name-suffix _WO2_static-dads-recovery \
  --include-review-log-manifest "$PACKAGE_DIR/REVIEW_LOG_INCLUSIONS_MANIFEST.txt"

node scripts/tools/zip-compat.mjs cat "$PACKAGE_ZIP" REVIEW_PACKAGE_MANIFEST.txt > "$PACKAGE_DIR/REVIEW_PACKAGE_MANIFEST.txt"
PACKAGE_SHA="$(shasum -a 256 "$PACKAGE_ZIP" | awk '{print $1}')"

./scripts/tools/command-log-wrapper.sh \
  --run-id "$RUN_ID" \
  --log "$PACKAGE_DIR/command-logs/final-zip-metadata-validation.log" \
  --cwd "$(pwd -P)" \
  --target-path "$PACKAGE_ZIP" \
  --target-sha256 "$PACKAGE_SHA" \
  -- node scripts/tools/validate-review-package-metadata.mjs "$PACKAGE_ZIP"

node scripts/tools/validate-artifact-ledger.mjs "$PACKAGE_DIR"
```

Important ordering note: compute `PACKAGE_SHA` after `create-review-package.sh` has created the ZIP.

## Subagent C Commands

| Command | Exit | Purpose |
| --- | ---: | --- |
| `git worktree add -b codex/wo2-subagent-package-report-20260421 /Users/Hayato/Documents/GitHub/odn-wo2-subagent-package-report b1894e88f` | 0 | Created assigned worktree from the requested integration commit. |
| `find docs/implementation/wo2-static-dads-recovery-20260421 -maxdepth 2 -type f \| sort` | 0 | Confirmed only Subagent A/B reports existed before this report. |
| `bash -n scripts/create-review-package.sh && node --check scripts/tools/validate-review-package-metadata.mjs && node --check scripts/tools/scan-review-bundle.mjs && node --check scripts/tools/validate-artifact-ledger.mjs` | 0 | Read-only syntax checks for package/validation tooling. |
| `git rev-parse --verify codex/wo2-static-dads-recovery-main-20260421 && git rev-parse --verify b1894e88f && git merge-base --is-ancestor 1a366ea565f33f143b556613e5b3f8a1ca57c9b3 b1894e88f` | 0 | Confirmed the requested integration branch/commit and that Subagent B's checked source is ancestor of `b1894e88f`. |
| `git diff --check` | 0 | No whitespace errors before adding this report. |

Commands intentionally not run by Subagent C:

- Phase 3
- Phase 4
- fullflow
- live ORCA mutation
- Python
- final ZIP generation

## Threat / Misuse Review

1. Package truth divergence: generating the ZIP from the subagent branch could make `source_branch` / `source_commit` describe C's report branch instead of the main integration source. Mitigation: final ZIP was not created here.
2. Overclaiming clean or full scan status: the support ZIP does not include `.git` and does not prove full-source secret scanning. Mitigation: required fields remain `worktree_clean=not_verified` and `full_source_secret_scan_claim=not_claimed`.
3. Raw artifact leakage: review evidence could accidentally include raw ORCA bodies, network captures, screenshots, or credentials. Mitigation: package plan limits inclusions to sanitized reports, command logs, manifests, sidecars, hashes, and subagent reports; final package validation must include source-scope scan and metadata validation logs.
4. Static recovery being mistaken for live clinical proof: Subagent B evidence proves web-client static/build/lint/test recovery, not Phase 3/4, fullflow, or mutation success. Mitigation: summary explicitly records Phase 3 rerun `no`, Phase 4 `not_run`, fullflow `not_run`, new mutation `no`, and Clinical Wave 1 `not_started`.

## Residual Work For Main Agent

1. Add or update `FINAL_REPORT.md`, `MAIN_AGENT_REPORT.md`, `TEST_LOGS.sanitized.md`, `command-log.jsonl`, `secret-scan.sanitized.txt`, and `REVIEW_LOG_INCLUSIONS_MANIFEST.txt` in the integration worktree.
2. Ensure `REVIEW_LOG_INCLUSIONS_MANIFEST.txt` lists only sanitized logs/reports with package-compatible paths.
3. Create the final ZIP in the integration worktree using the actual final `RUN_ID`.
4. Extract `REVIEW_PACKAGE_MANIFEST.txt` from the final ZIP, then validate package metadata and artifact ledger.
5. Record the final ZIP sha256, size, file count, metadata validation log, source-scope secret scan log, and sidecar summary.
6. Set `may start WO-3=yes` only if those package/report validations pass and the main agent accepts the WO-2 package truth.

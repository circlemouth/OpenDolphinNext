# WO-2 Static / DADS Recovery Main Agent Report

RUN_ID: `20260421T111148Z`

## Source

- branch: `codex/wo2-static-dads-recovery-main-20260421`
- source_commit: `b3766a65e62410095bfdb1544f1dd0731e61cd78`
- packageMode: `extracted_review_subset`
- worktree_clean: `not_verified`
- full_source_secret_scan_claim: `not_claimed`

## WO-1 Preservation

Step 0 was run before WO-2 edits:

- initial branch: `codex/wo1-orca-postretry-hardening-20260421`
- initial HEAD: `289bea44dd157fb0ec815f94715cba8c6d3d23c0`
- initial `git status --short`: empty
- initial `git diff --stat`: empty
- initial `git diff --cached --stat`: empty

No WO-1 staged, unstaged, or untracked changes were present to commit or stash. The reported WO-1 package directory existed and 28 files were already tracked. The WO-2 integration branch was created from that preserved HEAD.

## Changes

- `web-client/src/features/charts/__tests__/dadsClinicalInputContract.test.tsx`
  - Imported `DiagnosisEditPanelMeta`.
  - Annotated `baseDiagnosisMeta` and `renderDiagnosisPanel` with the production meta type.
  - Replaced the invalid `fetchLetterDetail` mock `letter: null` with omitted `letter`.
- `docs/implementation/wo2-static-dads-recovery-20260421/`
  - Added subagent reports, command logs, package metadata, final reports, and sanitized package evidence.

## Root Cause

1. `LetterDetailResult.letter` is optional and uses omission / `undefined` for absent details. The test fixture used `null`, which widened the API shape beyond the production contract.
2. `readOnly` / `readOnlyReason` already exist on `DiagnosisEditPanelMeta`. The test helper inferred the narrower literal type from `baseDiagnosisMeta`, so spreading in `readOnly` was rejected even though the component contract supports it.

No production contract was weakened and no broad `any` cast was introduced.

## DADS Applicability

DADS applies here only to static chart clinical input contract tests:

- Important clinical diagnosis state remains visible.
- Form labels are asserted for document creation.
- Support/error text remains concrete and does not rely on placeholders.
- Disabled/read-only chart states must show a visible reason and enablement direction nearby.

The fix preserves those assertions. It does not add new DADS rules beyond `docs/web-client/ux/dads_app_ui_design_rules_20260411.md`.

## Verification

All required WO-2 static/package commands passed. Detailed logs are in `TEST_LOGS.sanitized.md` and `command-logs/`.

## Package

- package: `docs/implementation/wo2-static-dads-recovery-20260421/OpenDolphin_WebClient-review-package-20260421T111148Z-WO2_static-dads-recovery.zip`
- sha256: `0182ee0475406de33dc9dba463ba5ab1bafba91b64b7c7140de9b9de6a02a482`
- size/count: `19,014,740 bytes / 2,349 files`
- metadata validation: PASS, `command-logs/final-zip-metadata-validation.log`
- final ZIP source-scope scan: PASS, `OpenDolphin_WebClient-review-package-20260421T111148Z-WO2_static-dads-recovery.zip.secret-scan-review-bundle.log`
- artifact ledger verification: PASS, `command-logs/artifact-ledger-verify.log`

## Stop / Scope Confirmation

- Phase 3 rerun: no.
- Phase 4: not_run.
- fullflow: not_run.
- new mutation: no.
- Clinical Wave 1: not_started.
- WO-3 / WO-4 / WO-5: not_started.
- `00002`-`00011` mutation: not_run.
- old mutation artifact replay: not_run.

## Decision

- static/DADS recovery status: PASS.
- may_start_WO3: yes, after ChatGPT review gate accepts this WO-2 package.

# WO-5 Test Logs

RUN_ID: `20260421T235522Z`

REOPEN_RUN_ID: `20260422T050934Z`

FINAL_CLEANUP_RUN_ID: `20260422T054647Z`

Complete command metadata is in `command-log.jsonl`; final cleanup logs are under `command-logs/`.

## Required Results

| command | result | log |
|---|---:|---|
| `git checkout master` | 0 | `docs/implementation/unified-phase4-handoff-wo5-20260421/command-logs/final-cleanup-001-git-checkout-master.log` |
| `git branch --show-current` | 0 | `docs/implementation/unified-phase4-handoff-wo5-20260421/command-logs/final-cleanup-002-git-branch.log` |
| `git rev-parse HEAD` | 0 | `docs/implementation/unified-phase4-handoff-wo5-20260421/command-logs/final-cleanup-003-git-head.log` |
| `git status --short` | 0 | `docs/implementation/unified-phase4-handoff-wo5-20260421/command-logs/final-cleanup-004-git-status.log` |
| `git diff --stat` | 0 | `docs/implementation/unified-phase4-handoff-wo5-20260421/command-logs/final-cleanup-005-git-diff-stat.log` |
| `git diff --cached --stat` | 0 | `docs/implementation/unified-phase4-handoff-wo5-20260421/command-logs/final-cleanup-006-git-diff-cached-stat.log` |
| `git cat-file -t 2961b7eb6613e3340d14e1b2fe870f7bac8ced81` | 0 | `docs/implementation/unified-phase4-handoff-wo5-20260421/command-logs/final-cleanup-007-git-cat-file-package-source.log` |
| `git cat-file -t 46075a9d7d4205a2beab3b5750bb515bd1d803d8` | 0 | `docs/implementation/unified-phase4-handoff-wo5-20260421/command-logs/final-cleanup-008-git-cat-file-final-evidence.log` |
| `git diff --check` | 0 | `docs/implementation/unified-phase4-handoff-wo5-20260421/command-logs/final-cleanup-020-git-diff-check-final-docs.log` |
| `bash server-modernized/tools/ci/check-doc-links.sh` | 0 | `docs/implementation/unified-phase4-handoff-wo5-20260421/command-logs/final-cleanup-021-doc-link-check-final-docs.log` |
| `node --test tests/review-package/create-review-package.test.mjs` | 0 | `docs/implementation/unified-phase4-handoff-wo5-20260421/command-logs/final-cleanup-022-review-package-test-final-docs.log` |
| package metadata validation for final WO-5 ZIP | 0 by final external sidecar | `docs/implementation/unified-phase4-handoff-wo5-20260421/review-package/post-package-metadata-validation-final.log` |
| final ZIP source-scope scan | 0 by final external sidecar | `docs/implementation/unified-phase4-handoff-wo5-20260421/review-package/<final-zip>.secret-scan-review-bundle.log` |
| artifact ledger verification | 0 by final external sidecar | `docs/implementation/unified-phase4-handoff-wo5-20260421/review-package/post-package-artifact-ledger-verify-final.log` |

## Corrected Findings

- Reopen blocker fixed: missing `cwd` in a package tooling fixture was corrected; finalizer still rejects malformed command logs without `cwd`.
- Final cleanup blocker fixed: root `.DS_Store` was initially still packaged by git pathspec; the pathspec now excludes root `.DS_Store` and package tooling test passes 25/25.
- `scripts/tools/orca-readonly-evidence-finalizer.mjs` remains unchanged.
- Old/preliminary post-package logs for previous ZIPs are not final evidence for the regenerated final ZIP.

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

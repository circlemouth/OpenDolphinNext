# Subagent B Reopen Package Evidence Audit Report

- RUN_ID: `20260421T133016Z`
- Worktree: `/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient-wo2-subagent-B-20260421`
- Branch: `codex/wo2-reopen-subagent-B-20260421`
- Base branch: `codex/wo2-static-dads-recovery-main-20260421`
- Audit start HEAD: `46e78149d85b54f289f544ded18d3f71a1be915b`
- Audit start status: clean
- Scope: docs-only package evidence audit. No `client/`, `server/`, production source, test source, Phase 3 retry rerun, Phase 4, fullflow, live ORCA mutation, CWP implementation, or Python execution.

## Checked Targets

- `docs/implementation/wo2-static-dads-recovery-20260421/`
- `scripts/create-review-package.sh`
- `scripts/tools/README.md`
- `scripts/tools/validate-review-package-metadata.mjs`
- `scripts/tools/validate-artifact-ledger.mjs`
- `tests/review-package/create-review-package.test.mjs`
- Existing final package: `docs/implementation/wo2-static-dads-recovery-20260421/OpenDolphin_WebClient-review-package-20260421T111148Z-WO2_static-dads-recovery.zip`

## Current Evidence State

The evidence directory currently has 28 tracked files before this auditor report. The expected report/log/sidecar files exist in the evidence directory, including:

- `FINAL_REPORT.md`
- `MAIN_AGENT_REPORT.md`
- `artifact-sha256.txt`
- `final-summary.sanitized.json`
- `final-summary.sanitized.md`
- final ZIP sidecar: `OpenDolphin_WebClient-review-package-20260421T111148Z-WO2_static-dads-recovery.zip.summary.txt`
- final ZIP source-scope scan log: `OpenDolphin_WebClient-review-package-20260421T111148Z-WO2_static-dads-recovery.zip.secret-scan-review-bundle.log`
- `command-logs/final-zip-metadata-validation.log`
- `command-logs/artifact-ledger-verify.log`

However, the current ZIP source commit is `b3766a65e62410095bfdb1544f1dd0731e61cd78`, while the branch HEAD containing the final package/report artifacts is `46e78149d85b54f289f544ded18d3f71a1be915b`. The current ZIP was generated before the final package/report artifact commit, so it is not a complete self-contained WO-2 final evidence ZIP.

## Verification Results

| Check | Result | Notes |
| --- | --- | --- |
| `shasum -a 256 -c artifact-sha256.txt` from evidence dir | PASS | Validates only the ZIP, ZIP summary sidecar, and ZIP source-scope scan log listed in `artifact-sha256.txt`. |
| `node scripts/tools/validate-review-package-metadata.mjs <zip>` from this auditor worktree | FAIL | The sidecar is bound to the main worktree absolute path `/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient/...`, so validation from the sibling worktree reports a final ZIP target path mismatch. The stored main-worktree log records PASS. |
| `node scripts/tools/validate-artifact-ledger.mjs docs/implementation/wo2-static-dads-recovery-20260421` | FAIL | The validator expects every evidence-dir file except the ledger itself. Current `artifact-sha256.txt` lists only 3 final package artifacts and omits reports/logs/manifests. |
| ZIP forbidden path scan with `unzip -Z1 ... | rg ...` | PASS by absence | No entries matching raw/network/HAR/trace/video/screenshot/env/nested ZIP/legacy `client/` or `server/` package paths were found. |
| ZIP WO-2 evidence entry scan | PARTIAL | The ZIP contains 14 WO-2 evidence entries: subagent A/B/C reports, `REVIEW_LOG_INCLUSIONS_MANIFEST.txt`, `command-log.jsonl`, and the static/package test logs listed by the review-log manifest. |

## Missing Or Required Evidence

These blocker items exist externally in the evidence directory but are not inside the current ZIP:

- `FINAL_REPORT.md`
- `MAIN_AGENT_REPORT.md`
- `artifact-sha256.txt`
- `final-summary.sanitized.json`
- `final-summary.sanitized.md`
- final ZIP summary sidecar
- final ZIP source-scope scan log
- `command-logs/final-zip-metadata-validation.log`
- `command-logs/artifact-ledger-verify.log`
- `command-logs/create-review-package.log`

These blocker items are not present as package-included final-state evidence:

- final commit evidence
- final clean worktree evidence
- final changed-files evidence

`command-log.jsonl` records initial and post-preservation clean status before WO-2 edits, but current reports keep `worktree_clean=not_verified`. There is no package-included final `git status --short`, final `git rev-parse HEAD`, or final changed-files command log proving the final artifact commit state.

This new auditor report is also necessarily missing from the already-generated ZIP and current `artifact-sha256.txt`. After this file is added, the existing final package must be treated as superseded unless main intentionally publishes it as a pre-audit support ZIP.

## Inclusion Policy

Recommended policy for the next main package attempt:

- Treat `create-review-package.sh` output as a support ZIP, not a self-contained canonical submission packet.
- Put pre-existing sanitized reports and command logs into the ZIP through tracked files and `REVIEW_LOG_INCLUSIONS_MANIFEST.txt`.
- Keep raw ORCA request/response bodies, raw patient/insurance detail, HAR, trace, video, screenshots, raw network dumps, credential-bearing URLs, Cookie, Authorization, JSESSIONID, CSRF values, passwords, nested ZIPs, and legacy `client/` / `server/` out of package source and review-log manifests.
- Do not claim `worktree_clean=clean` or `full_source_secret_scan_claim=passed` unless package-included git/scan evidence supports those claims. Current safe values are `worktree_clean=not_verified` and `full_source_secret_scan_claim=not_claimed`.
- Do not require the support ZIP to contain its own final ZIP sidecar, final ZIP scan log, final metadata-validation log, or artifact ledger. Those are generated after the ZIP and are self-referential if forced inside the same ZIP.
- If the review gate requires those generated-after-ZIP files, include them as external evidence alongside the ZIP, or use a higher-level reviewer submission packet that contains the support ZIP plus sidecars/logs/ledger.
- Clarify `artifact-sha256.txt` scope before final reporting:
  - If it is a package-artifact ledger, verify with `shasum -a 256 -c artifact-sha256.txt` and state that it covers only the ZIP, sidecar, and ZIP scan log.
  - If it is an evidence-directory ledger, regenerate it to include every evidence-dir file and use `validate-artifact-ledger.mjs`. The verification log must live outside that ledger scope or the process must avoid a self-referential log/hash loop.

## Misuse Cases Reviewed

1. Stale package truth: a ZIP generated before final reports can be mistaken for complete final evidence. Mitigation: regenerate or publish as superseded; bind final reports to the actual final package.
2. Overclaiming clean/full scan status: package metadata may imply source cleanliness or full-source scanning without `.git` or full scan evidence. Mitigation: keep `not_verified` / `not_claimed` unless evidence exists.
3. Raw evidence leakage: review manifests could accidentally include raw network, ORCA, screenshot, HAR, trace, or credential artifacts. Mitigation: keep manifest paths limited to sanitized reports/logs and rely on package script rejection rules.
4. Absolute path drift: final ZIP scan sidecar binds to a worktree absolute path and fails validation from a sibling worktree. Mitigation: validate in the package-generation worktree, or adjust policy/tooling to avoid absolute-path portability claims.
5. Self-referential artifact evidence: requiring a ZIP to contain its own final hash sidecar/log, or requiring a ledger to include its own validation log, can make reproducible validation impossible. Mitigation: separate ZIP-internal evidence from external final artifact evidence.

## Main Checklist Before Final Package

- Confirm intended final branch and HEAD, then record them in `MAIN_AGENT_REPORT.md` / `FINAL_REPORT.md`.
- Add this auditor report to `docs/implementation/wo2-static-dads-recovery-20260421/`.
- Decide whether `artifact-sha256.txt` is package-artifact scoped or full evidence-dir scoped.
- Update `REVIEW_LOG_INCLUSIONS_MANIFEST.txt` so all intended ZIP-internal sanitized logs/reports are listed and no raw/forbidden artifacts are listed.
- Add sanitized final changed-files and final clean evidence only if the claim will be used; otherwise keep `worktree_clean=not_verified`.
- Keep Phase 3 retry rerun, Phase 4, fullflow, live ORCA mutation, and CWP start out of scope.

## Main Checklist After Final Package

- Regenerate the final support ZIP from the actual final integration state if the current ZIP is not intentionally accepted as pre-audit.
- Extract/update `REVIEW_PACKAGE_MANIFEST.txt` from the final ZIP.
- Generate/update the final ZIP summary sidecar and final ZIP source-scope scan log bound to the exact final ZIP path and SHA-256.
- Run metadata validation from the same worktree path used to generate the package, or update validation policy so absolute path drift is not treated as evidence failure.
- Verify `artifact-sha256.txt` with the verifier that matches its declared scope.
- Store `command-logs/final-zip-metadata-validation.log`, package source-scope scan log, ledger verification log, final commit evidence, final clean/status evidence, and changed-files evidence as external final evidence if they cannot be inside the support ZIP.
- Ensure final reports state exactly which files are ZIP-internal versus external sidecar evidence.
- Re-run a forbidden path/source-scope scan and confirm no raw ORCA data, raw patient/insurance detail, HAR, trace, video, screenshot, raw network dump, credentials, cookies, Authorization, JSESSIONID, CSRF, or password values are present.


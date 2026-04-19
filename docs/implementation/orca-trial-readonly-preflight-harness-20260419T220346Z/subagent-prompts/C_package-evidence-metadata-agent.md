# package-evidence-metadata-agent prompt

RUN_ID: 20260419T220346Z

You are subagent C for OpenDolphinNext ORCA Trial Phase 2.5 review package metadata hardening.

Create and work only in your own worktree/branch, for example:
- branch: `codex/orca-package-evidence-metadata-20260419T220346Z`
- worktree: `/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient.worktrees/orca-package-evidence-metadata-20260419T220346Z`

Do not edit `client/` or `server/`. Do not run Python. Do not run Phase 3, Phase 4, fullflow, or any mutation path. Do not include raw ORCA response bodies, raw credentials, cookies, Authorization, JSESSIONID, CSRF, raw session data, raw password, credential-bearing URL, screenshots, HAR, traces, videos, or patient-sensitive details in artifacts.

Task:
Align review bundle metadata, sidecar summary, and worker report claims so source-scope scan, dynamic scan, full-source claim, and git truth are not conflated.

Required:
1. Preserve `packageMode=extracted_review_subset`.
2. Sidecar / `REVIEW_PACKAGE_MANIFEST` / `REVIEW_LOG_INCLUSIONS_MANIFEST` must correctly emit: `packageMode`, `run_id`, zip file count/size/hash, `secret_scan_scope`, dynamic secret scan claim, bundle-included source-scope scan claim, full source secret scan claim, `worktree_clean`, source commit/branch, git claim evidence policy.
3. If a package source-scope scan is run, sidecar must emit `package_source_secret_scan_claim=passed` or equivalent.
4. If not a full repo source scan, `full_source_secret_scan_claim=not_claimed`.
5. Do not call dynamic-only clean full clean.
6. Do not conflate package source-scope clean and full repo source clean.
7. Sidecar zip size/hash/count must match actual generated zip.
8. If `.git` is excluded, package-alone worktree clean is `not_verified`.
9. Git command logs are required before commit/branch/worktree clean can be accepted evidence inside the package.
10. Exclude raw artifacts, artifacts raw dirs, `node_modules`, `dist`, `target`, `coverage`, `test-results`, raw screenshots, raw network dumps.

Tests to add/update:
- source-scope scan passed log exists but sidecar says `not_claimed` drift is detected.
- dynamic-only scan claimed as full clean fails.
- `package_source_secret_scan_claim` and `secret-scan-review-bundle.log` result mismatch fails.
- sidecar hash/size/file count drift fails.
- raw artifacts and credential-bearing URL/raw password/cookie/Authorization/JSESSIONID/CSRF patterns fail.

Report:
Return a concise Japanese worker report with changed files, test commands, exit codes, and any blocker. List the branch and worktree.

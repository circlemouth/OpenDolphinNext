# C. package-sanitize-evidence-agent prompt

RUN_ID: 20260419T131740Z

You are the package-sanitize-evidence-agent for OpenDolphinNext ORCA Trial Phase 2.5 evidence package hygiene.

Create and work only in your own worktree:

```bash
git worktree add -b codex/package-sanitize-evidence-20260419T131740Z ../OpenDolphin_WebClient-package-sanitize-evidence-20260419T131740Z HEAD
cd ../OpenDolphin_WebClient-package-sanitize-evidence-20260419T131740Z
```

Do not edit `client/` or `server/`. Do not run Phase 3, Phase 4, fullflow, live mutation, or mutation scripts. Do not run Python. Do not include raw credentials, cookies, Authorization, JSESSIONID, CSRF, raw password, credential-bearing URLs, or patient-sensitive details in artifacts.

Primary files:
- `scripts/create-review-package.sh`
- `scripts/create-review-package-curated.sh` if needed
- `scripts/reviewer-submission-packet.mjs` only if directly relevant to validation semantics
- `tests/review-package/create-review-package.test.mjs`
- `tests/review-packet/reviewer-submission-packet.test.mjs` only if relevant
- `scripts/tools/README.md`
- package/evidence docs under `docs/runbooks/` and `docs/releases/` only as needed

Required hardening:
1. If a review ZIP is an extracted subset, it must have machine-readable metadata such as `packageMode=extracted_review_subset`.
2. Manifest must state guarantee scope and non-guarantee scope. The package must not imply full repository completeness when it is a subset.
3. If `.git` is not included, commit/branch/worktree clean must be `not_verified` in the package itself.
4. If commit/branch/worktree clean is claimed, the package must include git command logs with `command`, `cwd`, `runId`, `start`, `end`, and `exit_code`.
5. Full source clean may only be claimed after full ZIP/source secret scan. Dynamic-only clean must be labeled dynamic-only and never full clean.
6. Raw artifacts must not be included. Only sanitized summaries/logs may be included.
7. Manifest / sidecar / log inclusion / secret scan scope must be internally consistent and mechanically testable.
8. Evidence/package wording must not turn acceptedCandidateCount=0 into "official initial patients do not exist". Use `PARTIAL / TEST-DATA OR HARNESS READINESS BLOCKER` and describe it as insufficient mutation-ready read-only evidence across harness/API/auth/parser/readiness/exact-preflight criteria.
9. Secret scan must reject obvious credential literals, cookies, Authorization, JSESSIONID, CSRF, raw session, raw password, credential-bearing URLs. Avoid false claims in manifest.
10. Build artifacts, node_modules, dist, target, coverage, test-results, raw screenshots, raw network dumps, and raw artifacts dirs must not be included in review bundle ZIPs.

Add or update package tests. Keep implementation shell-compatible and avoid brittle absolute paths.

Verification you should run in your worktree:
- `node --test tests/review-package/create-review-package.test.mjs`
- `bash -n scripts/create-review-package.sh`
- `bash -n scripts/create-review-package-curated.sh` if edited
- Create at least one sample package in a temp test context via the test. Do not package live ORCA artifacts.

Write your report to:
`docs/implementation/orca-trial-phase2_5-gate-hardening-20260419T131740Z/subagent-reports/C_package-sanitize-evidence-agent.md`

Report changed files, tests run with exit codes, security considerations, and residual risks. Commit your branch when finished.

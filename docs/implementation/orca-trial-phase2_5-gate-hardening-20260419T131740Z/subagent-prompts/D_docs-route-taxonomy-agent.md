# D. docs-route-taxonomy-agent prompt

RUN_ID: 20260419T131740Z

You are the docs-route-taxonomy-agent for OpenDolphinNext ORCA Trial Phase 2.5 docs and route taxonomy hardening.

Create and work only in your own worktree:

```bash
git worktree add -b codex/docs-route-taxonomy-20260419T131740Z ../OpenDolphin_WebClient-docs-route-taxonomy-20260419T131740Z HEAD
cd ../OpenDolphin_WebClient-docs-route-taxonomy-20260419T131740Z
```

Do not edit `client/` or `server/`. Do not run Phase 3, Phase 4, fullflow, live mutation, or mutation scripts. Do not run Python. Do not expose credentials, cookies, Authorization, JSESSIONID, CSRF, raw password, credential-bearing URLs, or patient-sensitive details.

Primary files:
- `web-client/scripts/lib/orca-route-taxonomy-guard.mjs`
- `web-client/scripts/__tests__/orcaRouteTaxonomyGuard.test.ts`
- `docs/contracts/orca-route-taxonomy.md`
- `docs/runbooks/release-validation.md`
- `docs/releases/orca-remediation-cutover.md`
- `docs/runbooks/reviewer-submission-packet.md`
- `scripts/tools/README.md` if package wording must align

Required hardening:
1. Route taxonomy:
   - public route means official/master only.
   - mock/test/detector/docs reference is not public route.
   - runtime-ready-smoke blocked-route detector is a detector, not a success route.
   - category names must match guard, docs, and report language.
2. Docs must not imply:
   - candidate discovery alone authorizes Phase 3
   - live ORCA success can be inferred
   - HTTP 200 is business success
   - not run / not verified is success
   - `00001` to `00011` are mutation-ready
   - `0000001` is reusable WebORCA candidate
   - local selectable patient substitutes for official ORCA patient existence
   - HTTP 403 means insurance or appointment missing
   - diagnostic-only states (`apiResult=10`, `apiResult=60`, or `apiResult=00` with `Request_Number=00`) are mutation success
   - K1/K2/K3 are success without acceptance evidence
   Also do not imply `acceptedCandidateCount=0` means official Trial initial patients are absent. `00001` to `00011` exist as official initial data; zero accepted candidates means read-only mutation-readiness evidence is incomplete across current harness / endpoint / auth / parser / insurance / appointment / selector / local selectable / exact preflight criteria.
3. Docs must describe exact selected-candidate preflight as the only Phase 3 handoff artifact.
4. Docs must describe review package extracted subset metadata, guarantee scope, non-guarantee scope, clean-claim limits, and sanitized evidence policy.
5. Keep Japanese docs UTF-8 without BOM and avoid duplicating long source-of-truth sections unnecessarily.

Add or update route taxonomy tests if needed.

Verification you should run in your worktree:
- `cd web-client && npx vitest run scripts/__tests__/orcaRouteTaxonomyGuard.test.ts`
- `cd web-client && node scripts/verify-no-blocked-orca-route-strings.mjs`
- `cd web-client && node --check scripts/lib/orca-route-taxonomy-guard.mjs scripts/verify-no-blocked-orca-route-strings.mjs`

Write your report to:
`docs/implementation/orca-trial-phase2_5-gate-hardening-20260419T131740Z/subagent-reports/D_docs-route-taxonomy-agent.md`

Report changed files, tests run with exit codes, security considerations, and residual risks. Commit your branch when finished.

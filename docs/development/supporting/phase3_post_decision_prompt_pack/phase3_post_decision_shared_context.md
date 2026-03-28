# Phase3+ post-decision shared context

Use this context together with the current repository snapshot and `phase3_necessity_review_brief.md`.
Do not rely on earlier chat history beyond what is restated here.

## Review / implementation rules
- Current repo is the source of truth.
- Mark unknown as `unknown`; do not guess.
- Backward compatibility is not a goal.
- Prefer deletion, simplification, and narrowing public surface.
- Do not reopen closed Phase2 topics unless current repo shows active dependency, tests/scripts asserting old behavior, config/docs contradiction, or incomplete release confidence.
- Ignore build artifacts if they are present in any zip or worktree.

## Current known state to assume
- Wave 1 through Wave 4 cleanup / hardening work has already been applied to the repo you are editing.
- Repo-local server static-analysis is now green.
- Parent/static-analysis policy is unchanged:
  - SpotBugs / FindSecBugs remain fail-on-error.
  - Checkstyle / PMD remain skipped.
- Static-analysis GitHub Actions had previously been moved away from the default PR green path while baseline burn-down was in progress.
- Branch protection / required checks are repo-external and therefore `unknown` unless visible in repo docs.

## Decision outcome 1: static-analysis workflow repromotion
The repo-only decision was:
- Classification: `rewrite then restore`
- Not `restore now`

Reasoning to honor during implementation:
- The repo should have one canonical static-analysis execution contract.
- A dedicated static-analysis PR workflow is preferable to mixing static-analysis with runtime smoke / release-critical checks.
- Repo-external branch protection remains `unknown`; do not guess or encode assumptions about it.

## Decision outcome 2: minimal release gate
The repo-only minimum release gate was normalized to three entry points:
1. `cd web-client && npm run ci`
2. `mvn -f pom.server-modernized.xml -pl server-modernized -am -Pstatic-analysis verify`
3. `cd web-client && node scripts/runtime-ready-smoke.mjs`

This is the minimum mandatory set.
Other entry points may remain as recommended / optional / unknown, but should not be promoted as mandatory unless the repo clearly requires it.

## What implementation should accomplish now
Reflect those decisions in repo-local truth:
- Canonicalize the static-analysis entry point and remove contradictory or ambiguous semantics where practical.
- Restore a dedicated static-analysis PR workflow using the canonical entry point.
- Update repo-visible docs / verification guidance so the minimal release gate is explicit and does not drift from actual commands.

## Useful repo areas likely relevant
- `.github/workflows/**`
- `pom.server-modernized.xml`
- `server-modernized/pom.xml`
- `scripts/server-modernized/verify-static-analysis.sh`
- `scripts/server-modernized/verify-release-critical.sh`
- `scripts/reporting/verify.sh`
- `scripts/ci/verify-phase3-surface-guards.sh`
- `web-client/package.json`
- `web-client/scripts/runtime-ready-smoke.mjs`
- `docs/server-modernization/**`
- `phase3_necessity_review_brief.md`

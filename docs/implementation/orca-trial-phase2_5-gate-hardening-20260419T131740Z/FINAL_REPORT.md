# ORCA Trial Phase 2.5 gate hardening final report

- RUN_ID: `20260419T131740Z`
- Branch: `codex/orca-trial-preflight-evidence`
- Scope: Phase 2.5 gate hardening / evidence package hygiene
- Not run: Phase 3, Phase 4, fullflow, mutation

## Change Summary

- Candidate discovery is proposal-only and emits `candidateDiscoveryAloneAuthorizesPhase3=false`.
- Candidate discovery never authorizes Phase 3; exact selected-candidate read-only preflight is the only Phase 3 handoff artifact.
- `acceptedCandidateCount=0` means the current harness/API/auth/parser/readiness/exact-preflight criteria did not produce mutation-ready read-only evidence for official Trial initial patients `00001` to `00011`. It does not claim those official initial patients are absent.
- Official patient existence now requires parsed ORCA body, all-zero apiResult, `Patient_Information`, exact normalized `Patient_ID`, and no patient-not-found wording.
- Insurance and appointment readiness distinguish ambiguous transport/auth/parser failures from business rejections.
- `apiResult=10` is patient-not-found rejection. `apiResult=60` is no-existing-acceptance diagnostic, not mutation success.
- Phase 3 not-run and C7 not-verified summaries cannot be read as success.
- K1/K2/K3 only become warning success with registration evidence and C7/preflight evidence.
- Route taxonomy wording and guard tests now distinguish public official/master routes from docs/mock/test/detector references.
- Review package metadata now declares `packageMode=extracted_review_subset`, guarantee scope, non-guarantee scope, `.git` absence, clean-claim limits, and dynamic-only secret scan scope.
- Committed Trial endpoint/password literals and credential-bearing URL literals were removed from package-included docs/tests/config where they would otherwise enter review artifacts; runtime values now come from environment variables or local secret stores.

## Verification

| Command | CWD | Start UTC | End UTC | Exit |
| --- | --- | --- | --- | --- |
| `bash -n setup-modernized-env.sh && bash -n server-modernized/tools/flyway/scripts/export-schema.sh` | repo root | 2026-04-19T14:30:24Z | 2026-04-19T14:30:24Z | 0 |
| `node --check` changed `.mjs` scripts | repo root | 2026-04-19T14:56:39Z | 2026-04-19T14:56:39Z | 0 |
| `node --test tests/review-package/create-review-package.test.mjs` | repo root | 2026-04-19T15:00:41Z | 2026-04-19T15:00:45Z | 0 |
| `bash -n scripts/create-review-package.sh` | repo root | 2026-04-19T15:00:41Z | 2026-04-19T15:00:41Z | 0 |
| `bash -n scripts/create-review-package-curated.sh` | repo root | 2026-04-19T15:00:41Z | 2026-04-19T15:00:41Z | 0 |
| `git diff --check` | repo root | 2026-04-19T15:00:41Z | 2026-04-19T15:00:41Z | 0 |
| `npm run verify:web-guard` | `web-client` | 2026-04-19T14:30:33Z | 2026-04-19T14:30:34Z | 0 |
| focused Vitest gate tests plus audit telemetry redaction test | `web-client` | 2026-04-19T14:17:54Z | 2026-04-19T14:17:55Z | 0 |
| `npm run typecheck` | `web-client` | 2026-04-19T14:30:33Z | 2026-04-19T14:30:45Z | 0 |
| dynamic evidence secret scan | repo root | 2026-04-19T14:57:24Z | 2026-04-19T14:57:24Z | 0 |

Focused Vitest result: 6 files passed, 82 tests passed.

## Readiness

- Phase 2.5 readiness: repo-local gate hardening is ready after static and focused unit verification.
- Phase 3 readiness: not executable from candidate discovery alone. It requires exact selected-candidate read-only preflight with accepted boolean `true`, matching artifact path/hash/runId/candidateId/input identity, and complete patient/insurance/local/selector/appointment/diagnostic evidence.
- Phase 4 readiness: not executable until Phase 3 has business-accepted mutation evidence.

## Package

- Package mode: `extracted_review_subset`
- Package path: `artifacts/review-bundles/OpenDolphin_WebClient-review-package-20260419T131740Z-phase2_5-gate-hardening.zip`
- Package size/sha256: recorded in `command-logs/create-review-bundle.log` and the generated `.summary.txt` sidecar.
- Raw artifacts excluded: yes
- `.git` included: no
- Clean checkout claim in support package: `not_verified`
- Full source secret scan claim: `not_claimed`
- Dynamic evidence secret scan: passed for `docs/implementation/orca-trial-phase2_5-gate-hardening-20260419T131740Z`
- Package source-scope secret scan claim: `passed` via `command-logs/secret-scan-review-bundle.log`
- Generated review bundle scan: passed for raw/generated path exclusion and included source-scope secret literals.

## Residual Blockers

- Live ORCA Phase 3 mutation is still blocked until exact selected-candidate preflight produces accepted evidence.
- Phase 4 remains blocked because Phase 3 was intentionally not run.
- Full source clean / clean checkout truth is not claimed by the support review package.

## Next Owner

ORCA read-only investigation should run candidate discovery and exact selected-candidate read-only preflight only. Codex can then evaluate those sanitized artifacts before any separate Phase 3 decision.

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

## Verification

| Command | CWD | Start UTC | End UTC | Exit |
| --- | --- | --- | --- | --- |
| `bash -n setup-modernized-env.sh` | repo root | 2026-04-19T13:47:26Z | 2026-04-19T13:47:26Z | 0 |
| `node --check` changed `.mjs` scripts | `web-client` | 2026-04-19T13:50:28Z | 2026-04-19T13:50:29Z | 0 |
| `node --test tests/review-package/create-review-package.test.mjs` | repo root | 2026-04-19T13:52:46Z | 2026-04-19T13:52:50Z | 0 |
| `bash -n scripts/create-review-package.sh` | repo root | 2026-04-19T13:52:24Z | 2026-04-19T13:52:24Z | 0 |
| `bash -n scripts/create-review-package-curated.sh` | repo root | 2026-04-19T13:48:24Z | 2026-04-19T13:48:24Z | 0 |
| `git diff --check` | repo root | 2026-04-19T13:52:24Z | 2026-04-19T13:52:24Z | 0 |
| `npm run verify:web-guard` | `web-client` | 2026-04-19T13:47:43Z | 2026-04-19T13:47:45Z | 0 |
| focused Vitest gate tests | `web-client` | 2026-04-19T13:50:28Z | 2026-04-19T13:50:30Z | 0 |
| `npm run typecheck` | `web-client` | 2026-04-19T13:47:43Z | 2026-04-19T13:47:55Z | 0 |
| dynamic evidence secret scan | repo root | 2026-04-19T13:54:09Z | 2026-04-19T13:54:09Z | 0 |

Focused Vitest result: 5 files passed, 79 tests passed.

## Readiness

- Phase 2.5 readiness: repo-local gate hardening is ready after static and focused unit verification.
- Phase 3 readiness: not executable from candidate discovery alone. It requires exact selected-candidate read-only preflight with accepted boolean `true`, matching artifact path/hash/runId/candidateId/input identity, and complete patient/insurance/local/selector/appointment/diagnostic evidence.
- Phase 4 readiness: not executable until Phase 3 has business-accepted mutation evidence.

## Package

- Package mode: `extracted_review_subset`
- Raw artifacts excluded: yes
- `.git` included: no
- Clean checkout claim in support package: `not_verified`
- Full source secret scan claim: `not_claimed`
- Dynamic evidence secret scan: passed for `docs/implementation/orca-trial-phase2_5-gate-hardening-20260419T131740Z`

## Residual Blockers

- Live ORCA Phase 3 mutation is still blocked until exact selected-candidate preflight produces accepted evidence.
- Phase 4 remains blocked because Phase 3 was intentionally not run.
- Full source clean / clean checkout truth is not claimed by the support review package.

## Next Owner

ORCA read-only investigation should run candidate discovery and exact selected-candidate read-only preflight only. Codex can then evaluate those sanitized artifacts before any separate Phase 3 decision.

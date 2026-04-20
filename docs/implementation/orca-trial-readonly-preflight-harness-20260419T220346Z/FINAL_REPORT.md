# ORCA Trial read-only preflight harness hardening final report

RUN_ID: `20260419T220346Z`

## Scope
- Phase 2.5 exact selected-candidate preflight harness hardening。
- acceptmodv2 Request_Number=00 diagnostic hardening。
- review package metadata / evidence claim hardening。
- read-only candidate discovery investigation for official Trial initial patients `00001`〜`00011`.

## Code Changes
- `web-client/scripts/qa-lib/orca-trial-preflight.mjs`
  - official patient existence gate requires parsed ORCA body with all-zero `Api_Result`, `Patient_Information`, exact `Patient_ID`, and no patient-not-found wording.
  - `apiResult=60` diagnostic now requires executed, HTTP 2xx, parsed body, and no wrapper/upstream/error fields before `acceptedForPhase3Attempt=true`.
- `web-client/scripts/qa-weborca-readonly-preflight.mjs`
  - exact preflight official patient evidence now uses patientgetv2-style exact probes instead of batch DTO evidence.
  - official patient evidence and readiness axes are sanitized allowlist fields only.
- `web-client/scripts/qa-lib/acceptmodv2-identity-gate.mjs`
  - candidate discovery is rejected by `source`, not merely by `candidateDiscoveryAloneAuthorizesPhase3=false`, so exact summaries may carry the safe metadata without false rejection.
- `scripts/create-review-package.sh`
  - dynamic evidence scan, package source-scope scan, and full source scan claims are separated.
- `scripts/tools/validate-review-package-metadata.mjs`
  - package sidecar drift, raw artifact inclusion, and secret-pattern claim mismatches are validated.

## Tests Added / Updated
- `web-client/scripts/__tests__/orcaTrialPreflight.test.ts`
  - batch DTO without `Patient_Information` rejection.
  - patientgetv2 parsed body acceptance and rejection cases.
  - acceptmodv2 `apiResult=60` transport/wrapper/parser fail-closed cases.
- `web-client/scripts/__tests__/acceptmodv2IdentityGate.test.ts`
  - exact preflight summary with `candidateDiscoveryAloneAuthorizesPhase3=false` remains acceptable when exact source/flow and all required evidence are valid.
- `tests/review-package/create-review-package.test.mjs`
  - source-scope scan claim drift, dynamic/full-source claim confusion, sidecar integrity drift, raw artifacts, and credential patterns are rejected.

## Read-only Investigation
- Command: `RUN_ID=20260419T220346Z QA_BASE_URL=https://localhost:5173 QA_WEBORCA_CANDIDATES=00001,00002,00003,00004,00005,00006,00007,00008,00009,00010,00011 node scripts/qa-weborca-candidate-discovery.mjs`
- CWD: `/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient.worktrees/orca-readonly-investigation-20260419T220346Z/web-client`
- Start: `2026-04-19T22:26:15.029Z`
- End: `2026-04-19T22:28:19.104Z`
- Exit code: `1` (`acceptedCandidateCount=0` read-only stop)
- acceptedCandidateCount: `0 / 11`
- acceptedCandidateCount meaning: ORCA Trial official initial patients `00001`〜`00011` exist as official initial data, but currently lack mutation-ready read-only evidence across harness / endpoint / auth / parser / insurance / appointment / selector / local selectable / exact preflight criteria.
- candidate discovery: proposal-only; not a Phase 3 handoff artifact
- exact selected-candidate preflight: not run
- exact preflight `acceptedForPhase3Attempt`: not boolean true because exact preflight was not run
- Phase 3: not run
- Phase 4: not run
- fullflow: not run
- mutation: not run

## Failure Dimensions
- `00001`, `00005`: official patientget accepted (`200/apiResult=00/exact match`); insurance `403/blank/ambiguous_readiness_failure`; appointment `403/blank/ambiguous_readiness_failure`; local selectable accepted; selector rejected.
- `00002`, `00003`, `00004`, `00006`, `00007`, `00008`, `00009`, `00010`, `00011`: official patientget accepted; insurance/appointment `403/blank/ambiguous_readiness_failure`; local `local_exact_match_missing`; selector not verified.

## Security / Sanitization
- ORCA Trial official initial patients `00001`〜`00011` exist as official initial data, but are not mutation-ready in current evidence.
- `acceptedCandidateCount=0` means current read-only mutation-ready evidence is insufficient across harness / endpoint / auth / parser / insurance / appointment / selector / local selectable / exact preflight criteria; it does not mean official initial patients are absent.
- HTTP 403 for insurance or appointment is `ambiguous_readiness_failure`, not insurance missing / appointment missing.
- `apiResult=10` is `patient_not_found` rejection. `apiResult=60` is no-existing-acceptance diagnostic, not mutation success. `apiResult=00` with `Request_Number=00` is existing-acceptance diagnostic, not mutation success.
- C7 dynamic evidence is not verified unless target mutation request capture exists. `targetMutationRequestCount=0` / `checkedRequests=0` must not be accepted.
- MSW/local/static tests are not live ORCA fullflow success and must not be mixed with live ORCA fullflow claims.
- Dynamic evidence secret scan: passed, findings `0`, `rawSensitiveFieldsExcluded=true`.
- Review package raw artifact policy: raw ORCA bodies, raw network dumps, HAR, screenshots, traces, videos, credentials, cookies, sessions excluded.
- `packageMode=extracted_review_subset`.
- `package_source_secret_scan_claim` is package-source-scope only when backed by `secret-scan-review-bundle.log`; `full_source_secret_scan_claim=not_claimed` unless a full repo source scan is actually performed.
- `full_source_secret_scan_claim=not_claimed` is not a full clean claim. `worktree_clean=not_verified` is not clean checkout truth.

## Final Static Verification
- Command log: `docs/implementation/orca-trial-readonly-preflight-harness-20260419T220346Z/test-logs/final-static-verification.log`
- CWD: `/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient`
- RUN_ID: `20260419T220346Z`
- Start: `2026-04-19T22:41:05Z`
- End: `2026-04-19T22:41:40Z`
- Exit code: `0`
- Covered commands: `bash -n setup-modernized-env.sh`, `bash -n scripts/create-review-package.sh`, `node --check` for changed package/preflight scripts, `node --test tests/review-package/create-review-package.test.mjs`, `npm run verify:web-guard`, focused Vitest, `npm run typecheck`, `npm run build`.
- Separate lint run: `npm run lint` exit `0` with existing warnings only.
- Separate package verification: `node scripts/tools/scan-review-bundle.mjs ...` exit `0`; `node scripts/tools/validate-review-package-metadata.mjs ...` exit `0`.

## DADS/UI
- UI changes were not made; DADS/UI is not materially applicable.

## Residual Blocker
- `PARTIAL / TEST-DATA OR HARNESS READINESS BLOCKER`: read-only evidence still lacks mutation-ready insurance/appointment readiness, local selectable readiness for most candidates, and selector readiness for the locally selectable candidates.

## Next Owner
- Codex / ORCA read-only.

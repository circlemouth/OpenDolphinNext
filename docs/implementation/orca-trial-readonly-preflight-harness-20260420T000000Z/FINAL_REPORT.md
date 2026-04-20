# ORCA Trial Phase 2.5 Reopen Final Report

RUN_ID: `20260420T000000Z`

## Verdict

- Overall: `PARTIAL / NEEDS REOPEN`, with harness/package/docs blockers addressed.
- Phase readiness: `BLOCKED / EXACT SELECTED-CANDIDATE PREFLIGHT REQUIRED`.
- acceptedCandidateCount: `0 / 11` from the reviewed `20260419T220346Z` read-only evidence. The `20260420T000000Z` Subagent D probe did not recalculate it because local authenticated context bootstrap was blocked before safe read-only discovery could run.
- exact selected-candidate preflight: not run.
- Phase 3: not run.
- Phase 4: not run.
- fullflow / mutation: not run.

## Changes

- Phase 3 handoff gate now rejects discovery-only artifacts by source/flow/kind/artifact contract and accepts only current exact selected-candidate preflight summaries with strict sanitized evidence.
- `acceptedForPhase3Attempt` must be boolean `true`; strings, numbers, objects, null, and other truthy values are rejected.
- Stale `officialPatientExistence.candidates[patientId]` gating is no longer required for current exact preflight artifacts.
- `HTTP 200`, wrapper success, and message-only success are not treated as business success.
- `apiResult=60` is accepted only as a no-existing-acceptance diagnostic under strict 2xx/no-wrapper-error/parsed-body/mutationSuccess=false conditions.
- `apiResult=10` remains `patient_not_found` rejection.
- Insurance/appointment `HTTP 403` remains `ambiguous_readiness_failure`.
- Review package validation now binds final ZIP metadata and package source-scope scan evidence to the final ZIP path and SHA-256.
- Full source secret scan and clean worktree are not claimed without explicit package-included evidence.

## Read-only Actions

- Live ORCA mutation, Phase 3, Phase 4, and fullflow were not run.
- Subagent D prepared the read-only probe and ran static checks only.
- Subagent D stopped before live read-only discovery because the local harness could not safely create an authenticated context:
  - Flyway baseline failed against legacy audit schema.
  - Session login remained blocked by missing authoritative audit chain storage.
- Sanitized Subagent D evidence contains no raw request/response body, HAR, screenshot, cookie, Authorization header, session, CSRF token, password, credential-bearing URL, raw patient detail, or raw insurance detail.

## Verification

All accepted static verification commands exited `0`.

- `bash -n` shell syntax checks: pass.
- `node --check` for changed package/preflight scripts: pass.
- `npm run verify:web-guard`: pass.
- Focused Vitest for acceptmodv2 identity/business, ORCA trial preflight, and route taxonomy guard: pass.
- `npm run typecheck`: pass.
- `npm run build`: pass, with existing Vite chunk-size warning.
- `npm run lint`: pass, with existing warnings and no errors.
- `npm run ci`: pass.
- `node --test tests/review-package/create-review-package.test.mjs`: pass.
- Dynamic evidence secret scan for this `20260420T000000Z` evidence directory: pass.

## Package Evidence

The final package ZIP and sidecars are generated under this directory. The ZIP SHA-256, byte size, and file count are recorded in the external `.summary.txt` sidecar to avoid self-referential package hash drift.

Required claims:

- `packageMode=extracted_review_subset`
- `worktree_clean=not_verified`
- `full_source_secret_scan_claim=not_claimed`
- `package_source_secret_scan_claim=passed` only in the external summary after final ZIP post-creation scan
- `dynamic_secret_scan_claim=passed`
- `C7 dynamic evidence verified=not_verified` because no target mutation request capture exists

## Remaining Blockers

- No exact selected-candidate preflight artifact exists for a candidate with `acceptedForPhase3Attempt === true`.
- `acceptedCandidateCount=0 / 11` remains the latest accepted read-only evidence result.
- Local read-only harness startup/authentication must be repaired before a new safe live read-only discovery can be accepted.
- Phase 3 and Phase 4 remain blocked until a later task explicitly authorizes them after exact selected-candidate preflight passes.

## DADS/UI

No UI changes were included; DADS/UI is not materially applicable.

# Subagent A Phase 3 Preflight Handoff Report

- RUN_ID: 20260420T000523Z
- Worktree: `C:\Users\marug\Documents\GitHub\opendolphin-subagent-phase3-handoff`
- Branch: `codex/subagent-phase3-handoff-20260420`
- Scope: Phase 3 preflight handoff shape drift only. No live ORCA mutation, Phase 3, Phase 4, or fullflow was executed.

## Summary

Fixed the Phase 3 acceptmodv2 gate so it no longer requires the stale `officialPatientExistence.candidates[patientId]` discovery-era shape. The gate now accepts only the exact selected-candidate read-only preflight contract emitted by `qa-weborca-readonly-preflight.mjs` and rejects discovery-only or forged handoff artifacts before any browser mutation attempt.

## Files Changed

- `web-client/scripts/qa-lib/acceptmodv2-identity-gate.mjs`
- `web-client/scripts/qa-acceptmodv2-weborca.mjs`
- `web-client/scripts/qa-weborca-readonly-preflight.mjs`
- `web-client/scripts/qa-lib/orca-trial-preflight.mjs`
- `web-client/scripts/__tests__/acceptmodv2IdentityGate.test.ts`
- `web-client/scripts/__tests__/orcaTrialPreflight.test.ts`
- `web-client/scripts/verify-no-target-blank-unsafe.mjs`

## Implementation Details

- Added `EXACT_PREFLIGHT_KIND=exact-selected-candidate-preflight` and made the exact preflight emitter include it.
- Moved Phase 3 readiness validation into `acceptmodv2-identity-gate.mjs` so `qa-acceptmodv2-weborca.mjs` uses one contract check instead of stale local checks.
- Replaced stale `officialPatientExistence.candidates[...]` validation with selected-candidate sanitized evidence validation:
  - 2xx official patientget transport
  - parsed ORCA body
  - all-zero official patient apiResult
  - `Patient_Information` present
  - exact `Patient_ID` match
  - `rawSensitiveFieldsExcluded=true`
- Kept candidate discovery proposal-only. Discovery source artifacts are rejected even if `acceptedForPhase3Attempt=true` is forged.
- Enforced strict boolean `acceptedForPhase3Attempt === true`; truthy strings, numbers, objects, and null are rejected.
- Added optional pinned artifact hash validation via `QA_READONLY_PREFLIGHT_SHA256`; the gate always requires actual artifact path and computed SHA-256 metadata.
- Kept input identity mismatch fail-closed before readiness checks for runId, candidateId, patientId, department, physician, payment, visitKind, and medicalInformation omitted/selected state.
- Tightened `apiResult=60` read-only diagnostic so it requires 2xx transport, no wrapper/upstream error, and a parsed ORCA body object. It remains diagnostic no-existing-acceptance only, never mutation success.
- Fixed the Windows path resolution bug in `verify-no-target-blank-unsafe.mjs` that prevented `npm run lint` from running in this worktree.

## Misuse Cases Covered

- Forged discovery-only summary claims `acceptedForPhase3Attempt=true`: rejected by source/flow/kind contract.
- Exact preflight carries `candidateDiscoveryAloneAuthorizesPhase3=false`: not rejected solely for that discovery safety field.
- Stale `officialPatientExistence.candidates[patientId]` map is absent: current selected-candidate evidence still passes when hard conditions are met.
- Artifact hash pin does not match actual preflight summary hash: rejected before mutation.
- `apiResult=60` appears with non-2xx HTTP, wrapper/upstream error, or no parsed ORCA body object: rejected.
- HTTP 403 insurance/appointment readiness remains `ambiguous_readiness_failure`, not `missing`.

## Tests Run

| Command | Exit | Result |
| --- | ---: | --- |
| `npm ci` | 0 | Passed dependency restore. Reported existing audit findings from the lockfile: 4 low, 4 moderate, 7 high, 1 critical. No dependency files were changed. |
| `npm test -- scripts/__tests__/acceptmodv2IdentityGate.test.ts scripts/__tests__/orcaTrialPreflight.test.ts scripts/__tests__/acceptmodv2BusinessEvidence.test.ts` | 1 | Failed during development because patient mismatch was classified as readiness failure before identity mismatch. Fixed ordering. |
| `npm test -- scripts/__tests__/acceptmodv2IdentityGate.test.ts scripts/__tests__/orcaTrialPreflight.test.ts scripts/__tests__/acceptmodv2BusinessEvidence.test.ts` | 0 | Passed: 3 files, 77 tests. |
| `npm run ci` | 0 | Passed: web guard, typecheck, full Vitest CI, production build. Final Vitest summary: 185 files passed, 1201 tests passed, 2 skipped. |
| `npm run lint` | 1 | Failed before the guard fix because `verify-no-target-blank-unsafe.mjs` resolved `C:\C:\...` on Windows. Fixed. |
| `npm run lint` | 0 | Passed after the guard fix. ESLint reported existing warnings only: 0 errors, 492 warnings. |

## Known Limitations

- Live WebORCA, Phase 3 mutation, Phase 4, and fullflow were intentionally not run per worker instruction.
- Server Maven verification was not run because this change is limited to web-client QA harness scripts/tests and does not modify `server-modernized`.
- `npm run ci` emitted existing jsdom stderr from an intentional render-exception test and a Vite large chunk warning, but the command exited 0.
- `npm ci` reported existing dependency audit findings from the current lockfile. This task did not add or update dependencies, so no lockfile change was made.

## Result

PASS. Phase 3 handoff now fail-closes on discovery-only artifacts, forged accepted flags, hash/run/candidate/input drift, stale readiness shapes, and diagnostic-only ORCA responses while accepting the current exact selected-candidate read-only preflight artifact shape when all hard conditions are satisfied.

# Subagent C selector / local selectable / medical_information diagnostics report

- RUN_ID: `20260420T000000Z`
- Worktree: `/Users/Hayato/Documents/GitHub/opendolphin-subagent-selector-local-medinfo`
- Branch: `codex/subagent-selector-local-medinfo-20260420`
- Scope: WebORCA Trial Phase 2.5 read-only diagnostics only
- Phase 3 / Phase 4 / mutation requests: not run
- UI change: not materially applicable

## Summary

Selector, local selectable, and medical-information readiness diagnostics now emit actionable sanitized dimensions while keeping the strict acceptance gate unchanged.

Candidate discovery remains proposal-only and always reports `acceptedForPhase3Attempt=false`. Exact selected-candidate preflight still requires strict boolean `acceptedForPhase3Attempt === true`, matching source/flow/kind, artifact metadata, input identity, sanitized official patient evidence, insurance, local selectable, selector, appointment, medical-information readiness, and read-only acceptmodv2 diagnostic evidence.

## Files Changed

- `web-client/scripts/qa-lib/orca-trial-preflight.mjs`
- `web-client/scripts/qa-lib/acceptmodv2-identity-gate.mjs`
- `web-client/scripts/qa-weborca-candidate-discovery.mjs`
- `web-client/scripts/qa-weborca-readonly-preflight.mjs`
- `web-client/scripts/__tests__/orcaTrialPreflight.test.ts`
- `web-client/scripts/__tests__/acceptmodv2IdentityGate.test.ts`
- `web-client/package-lock.json`
- `docs/implementation/orca-trial-readonly-diagnostics-20260420T000000Z/subagent-C-selector-local-medinfo-report.md`

## Readiness Dimensions Added

- Local selectable diagnostic:
  - `status`: `accepted` / `rejected` / `not_verified`
  - `reason`: sanitized reason such as `local_exact_match_missing`
  - `normalizedTargetPatientId`
  - `localCandidateCount`
  - `exactMatchCount`
  - `exactMatch`
  - `rawSensitiveFieldsExcluded=true`

- Selector diagnostic:
  - `status`: `accepted` / `rejected` / `not_verified`
  - `reason`: `selector_option_missing`, `selector_exact_match_missing`, `selector_disabled`, `selector_unavailable`, `local_exact_match_missing`, or `unknown`
  - per-field sanitized `optionCount`, `targetMatch`, `disabled`, `exists`
  - local exact-match absence makes selector `not_verified`, not accepted

- Medical-information readiness:
  - `department_ready`
  - `physician_ready`
  - `payment_ready`
  - `visitKind_ready`
  - `medicalInformation_input_ready`
  - `medicalInformation_omitted_state_matches`
  - `required_identity_fields_match`
  - `failedSubdimensions`

## Security / Gate Behavior

- Local selectable success is not used as a substitute for official ORCA patient existence.
- `selector not_verified` is not accepted.
- `local_exact_match_missing` is treated as local sync / local selection readiness failure, not official patient absence.
- Candidate discovery summary cannot authorize Phase 3, even if candidate rows look good.
- Exact preflight now requires `medicalInformationReadiness` and rejects it through `preflight_phase3_not_accepted` if any subdimension is not accepted.
- Patient / department / physician / payment / visitKind / medicalInformation omitted-state identity mismatches still fail closed before mutation.
- Diagnostics expose counts, booleans, hashes, statuses, and sanitized reasons only; no raw ORCA body, raw patient detail, raw insurance detail, credentials, cookies, Authorization, JSESSIONID, CSRF token values, HAR/trace/video/raw screenshots/raw network dumps were added.

## Evidence Cases

- `00001` and `00005`:
  - Previously: local selectable accepted, selector rejected, final rejection collapsed to `medical_information_not_ready`.
  - Now: rows and readiness axes include local accepted status plus selector `status/reason`, per-selector `optionCount` and `targetMatch`, and medical-information `failedSubdimensions`.
  - Result: selector rejection cause is actionable without marking the candidates mutation-ready.

- `00002`-`00004` and `00006`-`00011`:
  - Previously: local selectable rejected with `local_exact_match_missing`, selector `not_verified`, final rejection collapsed to `medical_information_not_ready`.
  - Now: local diagnostic carries `normalizedTargetPatientId`, local candidate count, exact-match count, and sanitized `local_exact_match_missing`; selector diagnostic reports `not_verified/local_exact_match_missing`.
  - Result: local exact-match cause is actionable and is not reported as official ORCA patient absence.

## Threat Model / Misuse Cases Checked

- Misuse case 1: A discovery-only summary is forged or reused to authorize Phase 3.
  - Control: `candidate_discovery_only` remains rejected; exact preflight source/flow/kind and strict boolean `acceptedForPhase3Attempt === true` are required.

- Misuse case 2: A locally selectable patient is treated as official ORCA existence evidence.
  - Control: official patient evidence remains separate and must pass exact `patientgetv2` sanitized evidence checks.

- Misuse case 3: Selector or medical-information missing options are hidden behind a generic final blocker.
  - Control: selector and medical-information subdimensions are reported separately with sanitized counts and match booleans.

- Misuse case 4: Local exact-match absence is interpreted as Trial patient nonexistence.
  - Control: diagnostic wording and axes keep `local_exact_match_missing` separate from official patient evidence.

## Tests Run

- `npm test -- --run scripts/__tests__/orcaTrialPreflight.test.ts scripts/__tests__/acceptmodv2IdentityGate.test.ts`
  - Result: passed, 77 tests

- `npm run lint`
  - Result: passed with existing warnings, 0 errors

- `npm run typecheck`
  - Result: passed

- `npm run ci`
  - Result: passed
  - Full Vitest: 185 files passed, 1210 tests passed, 2 skipped
  - Build: passed

- `npm audit --omit=dev --audit-level=critical`
  - Before lockfile update: prod audit found axios/follow-redirects/yaml moderate and protobufjs critical.
  - Action: ran non-force `npm audit fix`.
  - After lockfile update: `found 0 vulnerabilities`.
  - `npm audit --audit-level=moderate` exits 0; remaining output is low severity only.
  - Remaining non-prod audit issue: non-force `npm audit fix` reports only low severity `tmp` via `@lhci/cli`; fixing it requires `npm audit fix --force` and a breaking downgrade, so it was not applied in this focused task.

## Residual Risk

- Live WebORCA Trial behavior was not executed in this subagent task because Phase 3/Phase 4/mutation and raw live artifacts are out of scope.
- The remaining dev-only low severity `tmp` audit issue should be handled in a separate dependency maintenance task that can evaluate the `@lhci/cli` breaking-change path.

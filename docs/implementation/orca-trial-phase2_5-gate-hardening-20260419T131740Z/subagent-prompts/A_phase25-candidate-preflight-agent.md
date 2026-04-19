# A. phase25-candidate-preflight-agent prompt

RUN_ID: 20260419T131740Z

You are the phase25-candidate-preflight-agent for OpenDolphinNext ORCA Trial Phase 2.5 gate hardening.

Create and work only in your own worktree:

```bash
git worktree add -b codex/phase25-candidate-preflight-20260419T131740Z ../OpenDolphin_WebClient-phase25-candidate-preflight-20260419T131740Z HEAD
cd ../OpenDolphin_WebClient-phase25-candidate-preflight-20260419T131740Z
```

Do not edit `client/` or `server/`. Do not run Phase 3, Phase 4, fullflow, live mutation, or any command that posts a mutation except static/unit tests. Do not run Python. Do not expose ORCA endpoint credentials, cookies, Authorization, JSESSIONID, CSRF, raw password, credential-bearing URLs, or patient-sensitive details in logs/docs/artifacts.

Primary files:
- `web-client/scripts/qa-weborca-candidate-discovery.mjs`
- `web-client/scripts/qa-weborca-readonly-preflight.mjs`
- `web-client/scripts/qa-lib/orca-trial-preflight.mjs`
- `web-client/scripts/qa-lib/acceptmodv2-identity-gate.mjs`
- `web-client/scripts/__tests__/orcaTrialPreflight.test.ts`
- `web-client/scripts/__tests__/acceptmodv2IdentityGate.test.ts`

Required hardening:
1. Candidate discovery is proposal-only and must never authorize Phase 3. It must emit `candidateDiscoveryAloneAuthorizesPhase3=false`.
2. If accepted candidate count is zero, discovery and generated preflight handoff must clearly emit:
   - `mutationPolicy.prohibited=true`
   - `blockedRequestCount=0`
   - exact selected-candidate preflight not run
   - Phase 3 not run
   - Phase 4 not run
   - verdict `PARTIAL / TEST-DATA OR HARNESS READINESS BLOCKER`
   Do not conclude that official initial patients do not exist. ORCA Trial official initial patients `00001` to `00011` are treated as registered seed data; zero accepted candidates only means the current harness/API/auth/ID-normalization/response-parser/insurance-readiness/appointment-dependency/exact-preflight criteria did not produce mutation-ready read-only evidence.
3. Official patient existence accepted requires all of:
   - HTTP 2xx
   - parsed ORCA body
   - apiResult all-zero
   - `Patient_Information` present
   - exact `Patient_ID` match after normalization
   - patient-not-found wording absent
   - response category not empty / not_found
4. apiResult non-zero / missing / blank means accepted=false. Patient-like body or exact-ID-looking value is not enough without all-zero apiResult.
5. `patientlst2v2` "患者番号がありません" equivalent is rejection.
6. `0000001` is rejected legacy seed. `00001` to `00011` are probe candidates only, not mutation-ready.
   For every rejected `00001` to `00011` row, keep read-only failure dimensions separate: patient existence HTTP status, parsed ORCA body presence, apiResult all-zero, `Patient_Information`, exact `Patient_ID`, patient-not-found wording, usable insurance evidence, selector/payment/visitKind readiness, and appointmentDependency/flowMode.
7. Insurance/appointment readiness:
   - HTTP 401/403/404/5xx, blank apiResult, or wrapper error => `ambiguous_readiness_failure`
   - insurance accepted only with HTTP 200 + all-zero apiResult + usable insurance/combination evidence
   - apiResult=21/23 => `business_rejected_insurance`
   - `appointmentDependency.flowMode` is `direct_acceptance`, `appointment_row`, or `unknown`
   - direct_acceptance does not block only because appointment row is absent
   - appointment_row requires exact row evidence
8. Exact selected-candidate preflight artifact is the only Phase 3 handoff artifact. Discovery-only summary must be rejected by `qa-acceptmodv2-weborca`.
9. Exact preflight artifact must contain at least:
   `runId`, `patientId`, `phase3AttemptPatientId`, `inputIdentity`, `departmentCode`, `physicianCode`, `paymentMode`, `visitKind`, `medicalInformationState`, `officialPatientEvidenceRef/hash`, `insuranceEvidenceRef/hash`, `localSelectableEvidenceRef/hash`, `selectorEvidenceRef/hash`, `acceptmodv2ReadOnlyDiagnostic`, `flowMode`, `rawSensitiveFieldsExcluded=true`.
10. Request_Number=00 diagnostic is read-only diagnostic only:
   - apiResult=10 => rejected / patient_not_found
   - apiResult=60 => no-existing-acceptance diagnostic, not success
   - apiResult=00 => existing-acceptance diagnostic, not mutation success
   It must not by itself authorize Phase 3 if the diagnostic is not actual exact preflight evidence.

Add or update focused Vitest coverage. Avoid broad refactors.

Verification you should run in your worktree:
- `cd web-client && npx vitest run scripts/__tests__/orcaTrialPreflight.test.ts scripts/__tests__/acceptmodv2IdentityGate.test.ts`
- `cd web-client && node --check scripts/qa-weborca-candidate-discovery.mjs scripts/qa-weborca-readonly-preflight.mjs scripts/qa-lib/orca-trial-preflight.mjs scripts/qa-lib/acceptmodv2-identity-gate.mjs`

Write your report to:
`docs/implementation/orca-trial-phase2_5-gate-hardening-20260419T131740Z/subagent-reports/A_phase25-candidate-preflight-agent.md`

Report changed files, tests run with exit codes, security considerations, and residual risks. Commit your branch when finished.

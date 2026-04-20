# B. phase3-c7-notrun-agent prompt

RUN_ID: 20260419T131740Z

You are the phase3-c7-notrun-agent for OpenDolphinNext ORCA Trial Phase 2.5 gate hardening.

Create and work only in your own worktree:

```bash
git worktree add -b codex/phase3-c7-notrun-20260419T131740Z ../OpenDolphin_WebClient-phase3-c7-notrun-20260419T131740Z HEAD
cd ../OpenDolphin_WebClient-phase3-c7-notrun-20260419T131740Z
```

Do not edit `client/` or `server/`. Do not run Phase 3, Phase 4, fullflow, live mutation, or mutation scripts. Do not run Python. Do not expose credentials, cookies, Authorization, JSESSIONID, CSRF, raw password, credential-bearing URLs, or patient-sensitive details.

Primary files:
- `web-client/scripts/qa-acceptmodv2-weborca.mjs`
- `web-client/scripts/qa-lib/medical-information-gate.mjs`
- `web-client/scripts/qa-lib/acceptmodv2-business-evidence.mjs`
- `web-client/scripts/qa-lib/acceptmodv2-identity-gate.mjs`
- `web-client/scripts/__tests__/medicalInformationGate.test.ts`
- `web-client/scripts/__tests__/acceptmodv2BusinessEvidence.test.ts`
- `web-client/scripts/__tests__/acceptmodv2IdentityGate.test.ts`

Required hardening:
1. `qa-acceptmodv2-weborca` must require exact preflight path, hash, runId, and candidateId.
2. Discovery-only summary must be rejected.
3. `acceptedForPhase3Attempt` must be boolean true only. Objects/null/truthy non-booleans must not pass.
4. Patient, department, physician, payment, visitKind, and medicalInformation omitted/selected state mismatch must reject before mutation.
5. Phase 3 not-run summary must never be readable as success:
   - `ran=false`
   - `mutationSuccess=false`
   - `businessAccepted=false` or `notRunBusinessEvidenceAbsent=true`
   - `businessAcceptedWithWarnings=false` or `notRunBusinessEvidenceAbsent=true`
   If the upstream reason is zero accepted candidates from `00001` to `00011`, the wording is `PARTIAL / TEST-DATA OR HARNESS READINESS BLOCKER`; do not claim official initial patients are absent. State that ORCA Trial official initial patients `00001` to `00011` exist as official initial data but currently lack mutation-ready read-only evidence across harness / endpoint / auth / parser / insurance / appointment / selector / local selectable / exact preflight criteria.
6. C7 dynamic gate:
   - If Phase 3 is not run, C7 is `not_verified`, not accepted.
   - `targetMutationRequestCount=0` and `checkedRequests=0` must not be accepted.
   - Future dynamic accepted condition must require `targetMutationRequestCount>0`, `checkedRequests>0`, `violationCount=0`, and summary artifact included.
7. C7 static helper treats key presence as violation: empty string, null, and key-only presence do not false-pass. Include `Medical_Information` / `medicalInformation` variants in coverage.
8. Request_Number=00 diagnostic in exact preflight remains diagnostic only:
   - apiResult=10 rejected
   - apiResult=60 no-existing-acceptance diagnostic, not mutation success
   - apiResult=00 with Request_Number=00 existing-acceptance diagnostic, not mutation success
   - apiResult=00 existing-acceptance diagnostic, not mutation success
9. K1/K2/K3 must not be business success unless registration/acceptance evidence exists.

Add or update focused tests. Keep edits small.

Verification you should run in your worktree:
- `cd web-client && npx vitest run scripts/__tests__/medicalInformationGate.test.ts scripts/__tests__/acceptmodv2BusinessEvidence.test.ts scripts/__tests__/acceptmodv2IdentityGate.test.ts`
- `cd web-client && node --check scripts/qa-acceptmodv2-weborca.mjs scripts/qa-lib/medical-information-gate.mjs scripts/qa-lib/acceptmodv2-business-evidence.mjs scripts/qa-lib/acceptmodv2-identity-gate.mjs`

Write your report to:
`docs/implementation/orca-trial-phase2_5-gate-hardening-20260419T131740Z/subagent-reports/B_phase3-c7-notrun-agent.md`

Report changed files, tests run with exit codes, security considerations, and residual risks. Commit your branch when finished.

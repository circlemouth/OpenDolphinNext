# WO-1 Subagent B Report: C7/business hardening

- RUN_ID: `20260421T101541Z`
- Worktree: `../odn-wo1-subagent-c7-business-hardening`
- Branch: `codex/wo1-subagent-c7-business-hardening-20260421`
- Scope: C7/business hardening only

## Summary

C7 dynamic evidence now fails closed unless the acceptmodv2 browser mutation evidence contains exactly one parsed `/api/orca/official/visits/mutation` request for candidate/patient `00001` with `Request_Number=01`.

Business success classification now requires C7 accepted evidence plus registration evidence. HTTP 200, wrapper exit 0, `apiResult=60`, `Request_Number=00`, or warning code alone are not treated as Phase 3 mutation success.

## Threat / misuse cases checked

1. A diagnostic/inquiry request (`Request_Number=00`) or non-registration request (`02/03/04`) is replayed as mutation success.
2. A wrong candidate/patient or multiple captured mutation requests are used to claim C7 success.
3. HTTP 200, wrapper exit 0, `apiResult=60`, or K3 warning text is used without registration evidence and C7 accepted evidence.
4. Malformed/raw request bodies require raw body inspection to decide pass/fail.

## Changes

- Hardened `web-client/scripts/qa-lib/medical-information-gate.mjs`
  - requires exactly one target mutation request capture.
  - verifies `requestNumberKeyPresent`, `requestNumber01ValueVerified`, `requestNumber02_03_04Absent`.
  - rejects `00/02/03/04`, blank, null, object, array, missing, and wrong values.
  - verifies target patient `00001` and target candidate `00001`.
  - rejects malformed JSON as `rawBodyDecisionRequired`.
- Hardened `web-client/scripts/qa-lib/acceptmodv2-business-evidence.mjs`
  - C7 accepted now requires all sanitized C7 booleans plus one capture and preflight artifact evidence.
  - emits the required sanitized booleans in `summary.c7`.
- Hardened `web-client/scripts/qa-acceptmodv2-weborca.mjs`
  - passes the candidate ID into C7 evaluation.
  - rejects observed non-`01` response request numbers in the script-level classifier.
- Hardened `web-client/scripts/qa-lib/acceptmodv2-business.mjs`
  - treats observed non-`01` request numbers as not verified.
- Added/updated focused tests:
  - `web-client/scripts/__tests__/medicalInformationGate.test.ts`
  - `web-client/scripts/__tests__/acceptmodv2BusinessEvidence.test.ts`

## Verification

Passed:

```text
cd web-client
npm test -- --run scripts/__tests__/medicalInformationGate.test.ts scripts/__tests__/acceptmodv2BusinessEvidence.test.ts
```

Result: 2 files passed, 37 tests passed.

Also executed as part of `npm test` pretest:

```text
npm run verify:no-public-secrets
npm run verify:no-blocked-orca-route-strings
npm run verify:no-legacy-auth-drift
```

All passed.

Attempted:

```text
cd web-client
npm run typecheck
```

Result: failed in existing/out-of-scope DADS test typing:

- `src/features/charts/__tests__/dadsClinicalInputContract.test.tsx(181,62): Type 'null' is not assignable to type 'LetterModulePayload | undefined'.`
- `src/features/charts/__tests__/dadsClinicalInputContract.test.tsx(243,7): 'readOnly' does not exist in the expected type.`

These files were not changed by this C7 work.

## Explicit not run

- Phase 3 rerun: no
- Phase 4: no
- fullflow: no
- live ORCA mutation: no
- mutation tests against candidates `00002`-`00011`: no
- Python: no

## Residual risk / handoff

- Full `web-client` typecheck is blocked by unrelated DADS test type errors listed above.
- `npm ci` was required in the new worktree to install missing local dependencies; npm reported 4 low-severity audit findings in existing dependency tree. No dependency files were changed.
- This report does not claim package scan, full source scan, worktree clean verification, or WO-1 package acceptance. Those remain main-agent/evidence-hygiene responsibilities.

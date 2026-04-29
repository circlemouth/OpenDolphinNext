# RWO-08B existing acceptance handoff repair

RUN_ID: `20260429T104910Z`

## Result

Partial repo-local fix completed; diagnostic Fullflow still blocks before order send.

The previous ORCA-side identifier blocker remains cleared for target `00002`, but the Web patient-search handoff still does not hydrate the existing server-derived acceptance row into an active charts handoff. The blocker is now narrower: sanitized `visits/list` evidence has exactly one complete target row with official visit identifiers, while the patient-search `カルテを開く` action still reports `no_active_entry` and falls back to duplicate accept mutation.

## Changes

- `web-client/src/features/reception/receptionHandoff.ts`
  - Added fail-closed selection of exactly one complete server-derived official visit row when multiple active keyed entries exist.
- `web-client/scripts/qa-fullflow-weborca.mjs`
  - Added an existing-acceptance handoff check before accept mutation.
  - If ready, the harness can proceed without rerunning accept mutation.
  - Added sanitized candidate-state logging.
- `web-client/scripts/qa-lib/medical-information-gate.mjs`
  - Added explicit no-mutation gate mode for existing-acceptance handoff runs.
- `web-client/src/features/reception/__tests__/receptionHandoff.test.ts`
  - Added pass/fail coverage for unique complete official visit row selection.

## Verification

- `node --check scripts/qa-fullflow-weborca.mjs`
- `node --check scripts/qa-lib/medical-information-gate.mjs`
- `cd web-client && npm test -- --run src/features/reception/__tests__/receptionHandoff.test.ts scripts/__tests__/medicalInformationGate.test.ts`
  - Result: 38 tests passed, including web guard pretest.
- `OPENDOLPHIN_RUNTIME_PROFILE=orca-trial-no-object-storage WEB_CLIENT_MODE=npm ./setup-modernized-env.sh`
  - Result: local Trial/no-object-storage runtime restarted and web dev server responded at `https://localhost:5173/`.

## Diagnostic retry result

- Retry RUN_ID `20260429T104910Z`: blocked before order send; accept mutation still observed with sanitized `apiResult=90`.
- Retry RUN_ID `20260429T110100Z` after runtime restart: blocked before order send; existing handoff candidate remained disabled with sanitized `no_active_entry`.
- Sanitized shape check from retry `20260429T110100Z`: `visits/list` returned 3 rows, target `00002` matched 2 rows, exactly 1 target row had complete official identifiers and a canonical handoff key.

## Next action

Bridge that complete server-derived `visits/list` row into the patient-search handoff candidate, or add a QA-only server-derived handoff hydration path that does not trust patientId alone. Then rerun exactly one diagnostic Fullflow attempt under local-only artifact containment.

## Non-claims

This is not diagnostic Fullflow success, Trial order-send business acceptance, production ORCA readiness, S3/object-storage readiness, rollback rehearsal, owner final GO/NO-GO/PENDING, or final release readiness.

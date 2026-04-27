# RWO-06H medicationgetv2 contract repair

RUN_ID: `20260427T055015Z`

## Summary

Investigated the `medicationgetv2 Request_Number=02` row-proof wrapper after repeated `2xx/other_present/masterFound=false` results.

Official ORCA documentation confirmed that `medicationgetv2` is a read-only master lookup endpoint under `/api01rv2/medicationgetv2`, that official samples append `?class=01`, and that `Base_Date` examples use dashed `YYYY-MM-DD` format. The previous wrapper omitted `class=01` and normalized `Base_Date` to compact `YYYYMMDD`, so prior `other_present/masterFound=false` results were not strong candidate rejection evidence.

## Changes

- Repaired `web-client/scripts/qa-lib/phase4-master-validity-evidence.mjs`.
  - `medicationgetv2` URL now includes `?class=01`.
  - `Base_Date` is normalized to `YYYY-MM-DD`.
  - request XML emits `type="string"` for `Request_Number`, `Request_Code`, and `Base_Date`.
  - official `E##` and `W##` results are classified as `official_error` / `official_warning`.
  - `Request_Number=02` now records `request02ResultClass` and requires `success_zero` plus matching `Medication_Code` before `masterFound=true`.
- Added focused Vitest coverage in `web-client/scripts/__tests__/phase4MasterValidityEvidence.test.ts`.

## Sanitized read-only results

| Code | Scope | Sanitized result | Evidence |
|---|---|---|---|
| `641210099` | official ORCA class-310 sample-derived injection candidate | `2xx/official_error/official_error_no_row_proof/masterFound=false` | `read-only-641210099/master-validity-readonly-summary.sanitized.json` |
| `114030710` | official `medicationgetv2 Request_Number=02` sample control, not an injection candidate | `2xx/success_zero/row_found_with_selection_comments/masterFound=true` | `read-only-official-sample-114030710/master-validity-readonly-summary.sanitized.json` |

## Verification

- `node --check web-client/scripts/qa-lib/phase4-master-validity-evidence.mjs`
- `node --check web-client/scripts/qa-phase4-injection-master-validity.mjs`
- `npm run --prefix web-client test -- scripts/__tests__/phase4MasterValidityEvidence.test.ts`
- Repaired-wrapper dry-run for `641210099`
- Repaired-wrapper read-only Trial check for `641210099`
- Repaired-wrapper read-only Trial control check for official sample `114030710`

The first attempted focused test command included unsupported Vitest option `--runInBand`; it was rerun with the correct Vitest path/arguments and passed.

## Security and claim boundary

No live Trial mutation was executed. No raw ORCA request/response body, credential, patient detail, insurance detail, screenshot, HAR, trace, video, raw network artifact, production ORCA action, or S3/object-storage setup was captured, committed, or packaged.

This is wrapper/parser repair and read-only validation only. It does not claim injection Trial business acceptance, fullflow success, production ORCA readiness, storage readiness, rollback rehearsal, owner final GO/NO-GO, or final release readiness.

Next: rerun any remaining source-backed injectable candidates with the repaired wrapper before using `masterFound=false` as a stop reason or assembling any RWO-06H endpoint packet.

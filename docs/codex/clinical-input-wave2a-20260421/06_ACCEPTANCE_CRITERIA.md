# Wave 2A acceptance criteria

## Required
- diagnosis invalid dates do not persist silently as null
- diagnosis chronology validation exists
- diagnosis outcome is not silently free-pass if outside supported set
- SOAP invalid performDate does not silently fallback to current date
- ordinary invalid-input parser path does not emit stack trace spam
- `/karte/document` POST/PUT create/update audit is implemented and tested
- SOAP/Disease/Document DADS-critical gaps are reduced with visible label/support/concrete static error and disabled reason where applicable
- targeted server/web/package tests pass
- `git diff --check` passes

## Must remain true
- no live ORCA mutation
- no Phase 3/4/fullflow/reception mutation
- no claim that local/unit/MSW/static success equals live ORCA success
- no external web lookup

## Explicit non-goals for acceptance
- full Playwright runtime proof
- ORCA official compatibility proof
- order set extended field preservation fix
- full app-wide DADS compliance

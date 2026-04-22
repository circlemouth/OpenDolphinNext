# Phase 4 Safe Wrapper Test Logs Sanitized

RUN_ID: `20260422T145704Z`

| Check | Result | Sanitized summary |
|---|---|---|
| `node --check web-client/scripts/qa-lib/phase4-medicalmodv2-safe-evidence.mjs` | PASS | Syntax check passed; no stdout/stderr. |
| `node --check web-client/scripts/qa-phase4-safe-medicalmodv2.mjs` | PASS | Syntax check passed; no stdout/stderr. |
| `npm test -- --run scripts/__tests__/phase4Medicalmodv2SafeEvidence.test.ts` | PASS | Web guard passed, then 1 Vitest file / 6 tests passed. |
| wrapper dry-run | PASS | `phase4-safe-medicalmodv2-sanitized-only`; live Trial action `not_run`; response classification `notObserved`. |
| wrapper mock | PASS | `phase4-safe-medicalmodv2-sanitized-only`; live Trial action `not_run`; mock response classification `businessAccepted`. |
| targeted secret scan | PASS | No secret-shaped matches. |
| forbidden artifact scan | PASS | No HAR, trace, video, screenshot, raw network dump, request XML, XML, zip, or screenshot artifacts under this run directory. |

## Not Run

- live ORCA Trial
- production ORCA
- Phase 3 retry
- fullflow
- Request_Number `02` / `03` / `04`
- mutation for `00002` through `00011`

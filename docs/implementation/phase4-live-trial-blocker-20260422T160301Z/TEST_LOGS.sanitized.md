# Phase 4 Live Trial Blocker Test Logs

RUN_ID: `20260422T160301Z`

## Local Checks

| Check | Result | Sanitized notes |
|---|---|---|
| `node --check web-client/scripts/qa-lib/phase4-medicalmodv2-safe-evidence.mjs` | PASS | Syntax check produced no output. |
| `node --check web-client/scripts/qa-phase4-safe-medicalmodv2.mjs` | PASS | Syntax check produced no output. |
| `cd web-client && npm test -- --run scripts/__tests__/phase4Medicalmodv2SafeEvidence.test.ts` | PASS | Web guard passed; Vitest passed 1 file / 6 tests. |
| wrapper dry-run | PASS | `liveTrialAction=not_run`; sanitized summary only. |
| wrapper mock | PASS | `liveTrialAction=not_run`; mocked response classified `businessAccepted`; sanitized summary only. |
| current-run secret-shaped scan | PASS | No credential/token-shaped matches in this run's evidence directory. |
| current-run forbidden artifact scan | PASS | No HAR, trace, video, screenshot, XML, raw network, or raw body artifacts in this run's evidence directory. |
| `git diff --check` | PASS | No whitespace or conflict-marker findings. |

## Live Trial Status

Live ORCA Trial was not executed. The approved runtime payload path plus sha256 were absent, so the live step stopped as `blocked_missing_runtime_secret_or_config`.

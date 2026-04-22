# Phase 4 Live Trial Blocker Test Logs

RUN_ID: `20260422T170230Z`

## Runtime Input Precheck

Checked without printing values:

- `PHASE4_MEDICALMODV2_PAYLOAD_PATH` + `PHASE4_MEDICALMODV2_PAYLOAD_SHA256`: missing
- `QA_PHASE4_MEDICALMODV2_PAYLOAD` + `QA_PHASE4_MEDICALMODV2_PAYLOAD_SHA256`: missing
- `ORCA_PHASE4_PAYLOAD_PATH` + `ORCA_PHASE4_PAYLOAD_SHA256`: missing
- `/Users/Hayato/.codex/automations/orca/phase4-medicalmodv2-live-inputs.local.json`: missing
- `$CODEX_HOME/automations/orca/phase4-medicalmodv2-live-inputs.local.json`: missing

No payload path, sha256 value, credential, cookie, token, session, or raw ORCA content was printed.

## Local Checks

- `node --check web-client/scripts/qa-lib/phase4-medicalmodv2-safe-evidence.mjs`: PASS
- `node --check web-client/scripts/qa-phase4-safe-medicalmodv2.mjs`: PASS
- `cd web-client && npm test -- --run scripts/__tests__/phase4Medicalmodv2SafeEvidence.test.ts`: PASS, 6 tests
  - pretest `npm run verify:web-guard`: PASS
  - `verify:no-public-secrets`: PASS
  - `verify:no-blocked-orca-route-strings`: PASS
  - `verify:no-legacy-auth-drift`: PASS

## Wrapper Evidence

- dry-run: PASS, live Trial action `not_run`
- mock: PASS, live Trial action `not_run`
- dry-run summary: [phase4-medicalmodv2-summary.sanitized.json](/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient/docs/implementation/phase4-live-trial-blocker-20260422T170230Z/wrapper-dry-run/phase4-medicalmodv2-summary.sanitized.json)
- mock summary: [phase4-medicalmodv2-summary.sanitized.json](/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient/docs/implementation/phase4-live-trial-blocker-20260422T170230Z/wrapper-mock/phase4-medicalmodv2-summary.sanitized.json)

## Scans

- secret-shaped scan: PASS
- forbidden artifact scan: PASS
- `git diff --check`: PASS

## Live Trial Status

- live Trial ORCA traffic: not sent
- blocker: `blocked_missing_runtime_secret_or_config`
- credentials captured: no
- raw artifacts captured: no

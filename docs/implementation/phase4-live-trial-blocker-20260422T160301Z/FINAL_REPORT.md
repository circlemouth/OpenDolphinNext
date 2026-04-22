# Phase 4 Live Trial Blocker Final Report

RUN_ID: `20260422T160301Z`

## Verdict

`PHASE4_LIVE_TRIAL_BLOCKED_MISSING_RUNTIME_SECRET_OR_CONFIG`

The active WO-8 Phase 4 `medicalmodv2` handoff was followed. Live ORCA Trial traffic was not executed because the approved external payload path plus sha256 were not available through the checked runtime variable pairs or documented local handoff files.

## Scope

- wrapper/action: `web-client/scripts/qa-phase4-safe-medicalmodv2.mjs`
- contract: `phase4-safe-medicalmodv2-sanitized-only`
- endpoint: `POST /api/orca/official/chart-support/medical-mod-v2`
- request class: `medicalmodv2`
- target patient/candidate scope: `00001 / 00001`
- live action: `not_run`

## Runtime Input Precheck

Checked without printing values:

- `QA_PHASE4_MEDICALMODV2_PAYLOAD` + `QA_PHASE4_MEDICALMODV2_PAYLOAD_SHA256`: missing
- `PHASE4_MEDICALMODV2_PAYLOAD_PATH` + `PHASE4_MEDICALMODV2_PAYLOAD_SHA256`: missing
- `ORCA_PHASE4_PAYLOAD_PATH` + `ORCA_PHASE4_PAYLOAD_SHA256`: missing
- `docs/implementation/automation-handoff/phase4-medicalmodv2-live-inputs.local.json`: missing
- `/Users/Hayato/.codex/automations/orca/phase4-medicalmodv2-live-inputs.local.json`: missing

`orca.env.local` exists, but values were not read or printed. `/Users/Hayato/.config/opendolphin/orca.env` was not present.

## Evidence

- command log: [command-log.jsonl](/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient/docs/implementation/phase4-live-trial-blocker-20260422T160301Z/command-log.jsonl)
- test log: [TEST_LOGS.sanitized.md](/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient/docs/implementation/phase4-live-trial-blocker-20260422T160301Z/TEST_LOGS.sanitized.md)
- dry-run summary: [phase4-medicalmodv2-summary.sanitized.json](/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient/docs/implementation/phase4-live-trial-blocker-20260422T160301Z/wrapper-dry-run/phase4-medicalmodv2-summary.sanitized.json)
- mock summary: [phase4-medicalmodv2-summary.sanitized.json](/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient/docs/implementation/phase4-live-trial-blocker-20260422T160301Z/wrapper-mock/phase4-medicalmodv2-summary.sanitized.json)
- secret/raw-artifact scan: [secret-scan.sanitized.txt](/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient/docs/implementation/phase4-live-trial-blocker-20260422T160301Z/secret-scan.sanitized.txt)

## Validation

- `node --check web-client/scripts/qa-lib/phase4-medicalmodv2-safe-evidence.mjs`: PASS
- `node --check web-client/scripts/qa-phase4-safe-medicalmodv2.mjs`: PASS
- `cd web-client && npm test -- --run scripts/__tests__/phase4Medicalmodv2SafeEvidence.test.ts`: PASS, 6 tests
- wrapper dry-run: PASS, no live ORCA
- wrapper mock: PASS, no live ORCA
- current-run secret-shaped scan: PASS
- current-run forbidden artifact scan: PASS
- `git diff --check`: PASS

## Sanitized Result

- business-success classification: `blocked_missing_runtime_secret_or_config`
- live Trial business success: not claimed
- credentials printed or captured: no
- raw payload captured: no
- raw ORCA request/response body captured: no
- raw patient/insurance detail captured: no
- HAR/trace/video/screenshot/raw network/XML captured: no

## Notes

An initial dry-run/mock artifact command used a repo-root-relative path with a leading `../`, which wrote sanitized summaries outside the repository. This was this run's own generated sanitized evidence only; it was removed and regenerated under the correct in-repo evidence directory before reporting.

## Next Step

The next worker should run the same exact wrapper only when the approved payload path and sha256 are available through the documented runtime variables or local handoff file. If they remain absent, stop again without reading or printing secret/config values.

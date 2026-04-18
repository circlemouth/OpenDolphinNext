# OpenDolphin WebClient follow-up release gate package 2026-04-17

## Historical status

This directory is a historical planning package from 2026-04-17. Its prompt/checklist files may contain stale `PASS`, `already closed`, `READY`, or completion language from worker reports available at that time.

Do not use this package as current release truth.

## Current source of truth

Use these current documents instead:

1. `docs/implementation/opendolphin-postfix-static-remediation-20260418/08_static_exit_report.md`
2. `docs/contracts/orca-route-taxonomy.md`
3. `docs/contracts/orca-connection.md`
4. `docs/runbooks/release-validation.md`
5. `docs/releases/orca-remediation-cutover.md`

Accepted static evidence for the 2026-04-18 closure is in:

```text
docs/implementation/opendolphin-postfix-static-remediation-20260418/test-logs/
```

`runtime-ready-smoke` is not a PASS in this historical package. The current accepted static report records it as an environment blocker when the paired backend on `127.0.0.1:9080` was not running. `qa-acceptmodv2-weborca.mjs` and `qa-fullflow-weborca.mjs` were not run in the static remediation, and live ORCA success is not claimed.

## Included historical files

- `00_MANAGER_PROMPT.md`
- `01_WORKPLAN.md`
- `10_WEBCLIENT_CI_RECOVERY_PROMPT.md`
- `20_RUNTIME_READY_SMOKE_PRECONDITION_RUNBOOK.md`
- `30_SETTING_NOTE_VERIFICATION_RUNBOOK.md`
- `40_MANUAL_QA_CHECKLIST.md`
- `41_ORCA_LIVE_QA_CHECKLIST.md`
- `50_RELEASE_GATE_CHECKLIST.md`
- `*_DOCSET.yaml`

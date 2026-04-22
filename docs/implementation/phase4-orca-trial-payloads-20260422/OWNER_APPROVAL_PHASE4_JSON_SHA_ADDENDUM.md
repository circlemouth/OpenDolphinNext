# Owner Approval Addendum: Phase4 JSON Payload SHA

RUN_ID: `20260422T224559Z`

## Approval

The owner approved the current-wrapper JSON payload SHA-256 for one-time Live ORCA Trial Phase4 `medicalmodv2` dummy execution.

Approval token:

```text
OWNER_APPROVAL_PHASE4_EXECUTE_00001_ONLY_ONE_TIME_NO_FULLFLOW_NO_PHASE3_RERUN_NO_RN02_03_04_JSON_SHA_E0F34FA28177155BF19CC0476863BF540F8B1FF4D844DDF189B88AB327645618
```

## Approved Payload

- payload: [medicalmodv2_phase4_dummy_current_wrapper_v1.json](/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient/web-client/qa/payloads/phase4/medicalmodv2_phase4_dummy_current_wrapper_v1.json)
- JSON SHA-256: `e0f34fa28177155bf19cc0476863bf540f8b1ff4d844ddf189b88ab327645618`
- endpoint wrapper: `web-client/scripts/qa-phase4-safe-medicalmodv2.mjs`
- server route: `POST /api/orca/official/chart-support/medical-mod-v2`
- native target class: `/api21/medicalmodv2?class=01`
- patient/candidate: `00001 / 00001`
- department: `11`
- physician: `0005`
- execution limit: one live Trial action only

## Explicit Non-Scope

- production ORCA
- fullflow
- Phase3 retry
- acceptmodv2 mutation
- Request_Number `02` / `03` / `04`
- diseasev3 live execution
- subjectivesv2 live execution
- patients/candidates `00002` through `00011`

## Evidence Restrictions

Allowed evidence is limited to sanitized summary, allowlisted parsed fields, payload SHA-256, endpoint/class metadata, response classification, Api_Result, classified Api_Result_Message, RUN_ID, and final verdict.

Forbidden evidence remains raw ORCA request/response bodies, raw patient or insurance details, HAR, trace, video, screenshot, raw network dump, credentials, cookies, tokens, session IDs, and CSRF values.

## Current Runtime Status

This approval addendum records owner approval only. RUN_ID `20260422T224559Z` did not execute live ORCA because the local backend was unavailable and the documented setup stopped on missing local runtime configuration:

- `http://127.0.0.1:9080/openDolphin/api/health`: not reachable
- Docker daemon: became reachable after Docker Desktop start
- `WEB_CLIENT_MODE=npm ./setup-modernized-env.sh`: stopped before backend start because `MODERNIZED_POSTGRES_PASSWORD` was missing
- live Trial ORCA action: `not_run`

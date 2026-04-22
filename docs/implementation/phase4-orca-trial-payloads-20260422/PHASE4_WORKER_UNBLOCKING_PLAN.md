# Phase4 Worker Unblocking Plan

RUN_ID: `20260422T224559Z`

## Purpose

This document consolidates the information needed for the next worker to continue the roadmap without re-discovering Phase4 inputs. It does not authorize production ORCA and does not contain raw credentials.

## Current State

| Item | Status | Evidence |
|---|---|---|
| Trial-only scope | READY | Owner stated ORCA use is Trial only; production ORCA remains NO-GO. |
| Safe `medicalmodv2` wrapper | READY | `web-client/scripts/qa-phase4-safe-medicalmodv2.mjs` |
| Current-wrapper payload | READY | [medicalmodv2_phase4_dummy_current_wrapper_v1.json](/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient/web-client/qa/payloads/phase4/medicalmodv2_phase4_dummy_current_wrapper_v1.json) |
| Current-wrapper payload SHA-256 | READY | `e0f34fa28177155bf19cc0476863bf540f8b1ff4d844ddf189b88ab327645618` |
| Owner JSON-SHA approval | READY | [OWNER_APPROVAL_PHASE4_JSON_SHA_ADDENDUM.md](/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient/docs/implementation/phase4-orca-trial-payloads-20260422/OWNER_APPROVAL_PHASE4_JSON_SHA_ADDENDUM.md) |
| Payload local dry-run | READY | [phase4-medicalmodv2-summary.sanitized.json](/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient/docs/implementation/phase4-orca-trial-payloads-20260422/wrapper-dry-run-current-wrapper/phase4-medicalmodv2-summary.sanitized.json) |
| ORCA Trial env file | PRESENT_LOCALLY | repo-local `orca.env.local` exists and is intentionally untracked; do not print values. |
| Local backend | NOT_READY | [RUNTIME_BLOCKER_REPORT.md](/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient/docs/implementation/phase4-orca-trial-payloads-20260422/RUNTIME_BLOCKER_REPORT.md) |

## Approved Phase4 Live Scope

- Environment: Live ORCA Trial only.
- Wrapper: `web-client/scripts/qa-phase4-safe-medicalmodv2.mjs`.
- Server route: `POST /api/orca/official/chart-support/medical-mod-v2`.
- Native target class: `/api21/medicalmodv2?class=01`.
- Request class: `medicalmodv2`.
- Target patient/candidate: `00001 / 00001`.
- Department: `11`.
- Physician: `0005`.
- Payload: `web-client/qa/payloads/phase4/medicalmodv2_phase4_dummy_current_wrapper_v1.json`.
- Payload SHA-256: `e0f34fa28177155bf19cc0476863bf540f8b1ff4d844ddf189b88ab327645618`.
- Execution count: one live Trial action only.

## Explicit Non-Scope

Do not run:

- production ORCA
- fullflow
- Phase3 retry
- acceptmodv2 mutation
- diseasev3 live execution
- subjectivesv2 live execution
- Request_Number `02` / `03` / `04`
- `medicalmodv2` class `02` / `03` / `04`
- `subjectivesv2` class `02`
- diseasev3 `Request_Number=01`
- patients/candidates `00002` through `00011`
- exploratory standalone connection tests outside the documented wrapper/runtime checks

## Runtime Inputs Still Needed Before Live Execution

These are local backend startup inputs, not ORCA payload inputs. They must be provided through an approved local secret/config path and must not be committed, printed, or copied into docs:

| Variable | Purpose | Notes |
|---|---|---|
| `MODERNIZED_POSTGRES_PASSWORD` | local dev PostgreSQL password | `setup-modernized-env.sh` stopped before backend start when this was absent. |
| `ORCA_CREDENTIALS_AES_KEY_B64` | server-side ORCA credential encryption key | 32-byte random Base64 value; do not reuse production material. |
| `ATTACHMENT_STORAGE_S3_SECRET_KEY` | local MinIO/S3 secret | local runtime only. |
| `PHR_EXPORT_SIGNING_SECRET` | local PHR export signing secret | random local runtime value. |
| `PHR_EXPORT_S3_SECRET_KEY` | local PHR export S3 secret | local runtime only. |
| `MINIO_ROOT_PASSWORD` | local MinIO root password | local runtime only. |
| `FACTOR2_AES_KEY_B64` | 2FA encryption key | 32-byte random Base64 value; required for server startup. |

`ORCA_API_USER` / `ORCA_API_PASSWORD` are expected to come from the existing ignored ORCA env path (`orca.env.local` or `ORCA_ENV_FILE`). Do not print their values.

Generated files such as `custom.properties.dev` and `docker-compose.override.dev.yml` are intentionally ignored and may contain runtime configuration. Do not include them in review packages, summaries, or committed changes.

## Next Worker Procedure

1. Confirm branch/HEAD/status/worktrees.
2. Confirm Trial-only scope and active handoff.
3. Confirm payload SHA-256:

```bash
shasum -a 256 web-client/qa/payloads/phase4/medicalmodv2_phase4_dummy_current_wrapper_v1.json
```

Expected:

```text
e0f34fa28177155bf19cc0476863bf540f8b1ff4d844ddf189b88ab327645618
```

4. Confirm required local runtime variables are present by presence only. Do not print values.
5. Start backend via the documented path:

```bash
WEB_CLIENT_MODE=npm ./setup-modernized-env.sh
```

6. Confirm sanitized backend health/readiness without exposing internal URLs, exception details, or credentials.
7. Run exactly one live Trial action:

```bash
RUN_ID=<run_id> node web-client/scripts/qa-phase4-safe-medicalmodv2.mjs \
  --execute-approved-phase4 \
  --sanitized-evidence-only \
  --disable-browser-artifacts \
  --phase4-only \
  --payload web-client/qa/payloads/phase4/medicalmodv2_phase4_dummy_current_wrapper_v1.json \
  --payload-sha256 e0f34fa28177155bf19cc0476863bf540f8b1ff4d844ddf189b88ab327645618
```

8. Classify the result from sanitized wrapper evidence only.

## Business Success Criteria

Business success requires all of:

- `response.httpStatus` is 2xx.
- `response.apiResult` is zero-like.
- `response.businessAccepted=true`.
- At least one completion field exists in `response.completionEvidence`: information timestamp, `medicalUid`, `invoiceNumber`, or `dataId`.
- `rawResponseBodyStored=false`, `rawPayloadStored=false`, `rawPatientOrInsuranceDetailStored=false`, and `rawArtifactsCaptured=false`.

HTTP 200, wrapper exit 0, dry-run, mock, precheck, `not_run`, `not_verified`, or owner approval alone is not business success.

## Evidence Policy

Allowed:

- sanitized summary
- allowlisted parsed fields
- endpoint/class/request metadata
- minimal patient/candidate ID
- payload SHA-256
- response classification
- Api_Result
- classified Api_Result_Message
- RUN_ID
- final verdict

Forbidden:

- raw ORCA request body
- raw ORCA response body
- raw patient detail
- raw insurance detail
- HAR
- trace
- video
- screenshot
- raw network dump
- password
- cookie
- token
- session ID
- CSRF value

## Future Work Outside Current WO-8

- `diseasev3_phase4_dummy_native_intent_v1.json` is available only as future safe-wrapper input.
- `subjectivesv2_phase4_dummy_native_intent_v1.json` is available only as future safe-wrapper input.
- Separate wrappers must be created and locally contract-tested before either endpoint is executed live.

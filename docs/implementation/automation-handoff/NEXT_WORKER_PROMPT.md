# NEXT_WORKER_PROMPT

status: active
created_at: 2026-04-23T06:01:15Z
last_checked_at: 2026-04-23T08:01:50Z
source_work_order: RWO-06
blocker_id: phase4-medicalmodv2-live-trial-ready
priority: high
supersedes:
- RWO-06A non-S3 runtime profile handoff from 2026-04-23T05:48:33Z

## Context

RUN_ID `20260423T060115Z` implemented and locally verified the object-storage-free WebORCA Trial dev/runtime profile:

- `OPENDOLPHIN_RUNTIME_PROFILE=orca-trial-no-object-storage`
- `attachment.storage.mode=disabled`

The implementation keeps object-storage features fail-closed, rejects S3/MinIO/PHR S3 configuration mixing, keeps production-like startup S3-only, and documents the non-claim boundary.

Phase4 `medicalmodv2` still has not been run live through this new profile. The safe wrapper and approved payload path already exist:

- wrapper: `web-client/scripts/qa-phase4-safe-medicalmodv2.mjs`
- endpoint: `POST /api/orca/official/chart-support/medical-mod-v2`
- payload package: `web-client/qa/payloads/phase4/medicalmodv2_phase4_dummy_current_wrapper_v1.json`

RUN_ID `20260423T080150Z` rechecked this handoff after owner clarification that WebORCA / ORCA Trial should be used. Trial remains the only allowed ORCA target, but live traffic was not sent because the approved local non-S3 runtime path still lacked `MODERNIZED_POSTGRES_PASSWORD`, `PHR_EXPORT_SIGNING_SECRET`, and `FACTOR2_AES_KEY_B64`. The payload hash, wrapper dry-run, evidence contract tests, and server guard scripts passed with no credential or raw artifact capture.

Owner clarification after that run: because the database/backend runtime is local, the automation may generate missing local-only dev/Trial runtime values to unblock local startup when they are not external credentials and can be safely regenerated for this machine. Known allowed examples are `MODERNIZED_POSTGRES_PASSWORD`, `PHR_EXPORT_SIGNING_SECRET`, and `FACTOR2_AES_KEY_B64`. Values must be generated with an OS-backed cryptographic random source when secret, stored only in an approved gitignored local runtime file such as `./orca.env.local` or an already configured readable local `ORCA_ENV_FILE`, never printed, never committed, never included in evidence, and never used to justify object-storage readiness.

## Goal

Run exactly one approved Phase4 `medicalmodv2` live Trial action through the safe wrapper. If the only missing runtime prerequisites are approved local-only dev/Trial runtime values, generate and store them safely first, then start/verify the non-S3 runtime path.

If any other runtime secrets/config are missing, record `skipped_environment_unavailable_missing_runtime_secret_or_config` and continue to the next independent safe non-S3 Work Order. Do not request, print, generate, or workaround non-approved secret values.

## Allowed Actions

- Confirm branch, HEAD, status, worktrees, and no unrelated unsafe repo state.
- Confirm the non-S3 runtime profile implementation evidence in `docs/implementation/rwo06a-non-s3-runtime-profile-20260423T060115Z/FINAL_REPORT.md`.
- Generate missing local-only dev/Trial runtime values when they are needed for local backend startup, using an OS-backed cryptographic random source for secrets and storing them only in an approved gitignored local runtime file without printing values. Known allowed examples are `MODERNIZED_POSTGRES_PASSWORD`, `PHR_EXPORT_SIGNING_SECRET`, and `FACTOR2_AES_KEY_B64`.
- Use `OPENDOLPHIN_RUNTIME_PROFILE=orca-trial-no-object-storage` for local runtime startup if startup is needed.
- Run the exact safe wrapper `web-client/scripts/qa-phase4-safe-medicalmodv2.mjs` once when prerequisites are available.
- Record only sanitized wrapper summaries and business-success classification.
- Update HANDOFF_STATE.json, release gate matrix, and a final sanitized evidence report.

## Forbidden Actions

- Production ORCA execution.
- More than one live `medicalmodv2` action in this handoff.
- S3/MinIO/object-storage setup, dummy S3, fake credentials, or object-storage readiness claims.
- Requesting, printing, committing, or working around `ATTACHMENT_STORAGE_S3_*`, `PHR_EXPORT_S3_*`, `MINIO_*`, ORCA credentials, production credentials, external-service passwords/tokens, cookies, session IDs, Authorization headers, or raw ORCA bodies.
- Generating ORCA Trial credentials, production credentials, S3/MinIO/object-storage secrets, external-service credentials, cookies, sessions, Authorization headers, CSRF values, patient/insurance data, or any value whose local-only classification is ambiguous.
- Overwriting existing non-empty local runtime values without a sanitized stop record.
- HAR, trace, video, screenshot, raw network dump, request XML, raw request/response body, or body-derived artifacts.
- `env`, `printenv`, `set`, `history`, or `set -x`.
- Changes under legacy `client/` or `server/`.

## Completion Criteria

- Either one live Trial `medicalmodv2` action is executed through the safe wrapper and classified with endpoint-specific parsed business criteria, or the task is skipped with sanitized environment-unavailable evidence.
- Credentials captured: `false`.
- Raw artifacts captured: `false`.
- No production ORCA, S3/MinIO/object-storage, or final release readiness claim.

## Stop Conditions

- Non-Trial endpoint detected.
- Raw artifact capture would be required to decide success.
- Required non-S3 runtime secret/config is absent, cannot be safely generated under the local-only policy, and no independent safe task remains.
- S3/MinIO/object-storage configuration becomes required.
- Target/scope ambiguity or parser ambiguity.

# NEXT_WORKER_PROMPT

status: active
created_at: 2026-04-23T05:48:33Z
last_checked_at: 2026-04-23T05:48:33Z
source_work_order: RWO-06
blocker_id: non-s3-runtime-profile-required
priority: high
supersedes:
- docs/implementation/automation-handoff/history/NEXT_WORKER_PROMPT-20260422T145704Z-phase4-safe-wrapper-action-missing-completed.md
- docs/implementation/automation-handoff/history/NEXT_WORKER_PROMPT-20260422T160301Z-phase4-live-trial-blocked-missing-runtime-secret-or-config.md
- docs/implementation/automation-handoff/history/NEXT_WORKER_PROMPT-20260422T170230Z-phase4-live-trial-blocked-missing-runtime-secret-or-config.md
- docs/implementation/automation-handoff/history/NEXT_WORKER_PROMPT-20260422T180231Z-phase4-live-trial-blocked-missing-runtime-secret-or-config.md
- docs/implementation/automation-handoff/history/NEXT_WORKER_PROMPT-20260422T190124Z-phase4-live-trial-blocked-missing-runtime-secret-or-config.md
- docs/implementation/automation-handoff/history/NEXT_WORKER_PROMPT-20260422T200131Z-phase4-live-trial-blocked-missing-runtime-secret-or-config.md
- docs/implementation/automation-handoff/history/NEXT_WORKER_PROMPT-20260422T224559Z-phase4-live-trial-blocked-missing-runtime-secret-or-config.md

## Context

WO-8 Phase4 `medicalmodv2` has a safe wrapper, an in-repo JSON payload, and owner approval for the JSON SHA-256. Live execution is still blocked because the documented local backend path currently requires S3/MinIO/object-storage runtime configuration before the server can be started for the wrapper path.

The owner clarified on 2026-04-23 that the preferred path is **not** a local dummy S3/MinIO server. The preferred path is a first-class non-S3 runtime profile that lets the Trial ORCA verification runtime start without initializing object storage, while object-storage-dependent features fail closed and remain explicitly out of scope.

## Goal

Define and implement a repo-local object-storage-free dev/Trial runtime profile that can support ORCA Trial endpoint verification without requesting, generating, printing, or committing S3/MinIO/object-storage credentials.

This is a blocker-resolution task. Do not run live Trial ORCA in the same step unless the implementation is complete, locally verified, the exact wrapper remains unchanged, and the safe runtime path can be confirmed without S3/object-storage credentials or raw artifact capture. Prefer ending this task with a verified non-S3 runtime-profile report and a follow-up prompt for the single approved Phase4 live action.

## Design Requirements

- The profile must be explicit and fail closed. Suggested names are `attachment.storage.mode=disabled` or an equally clear runtime profile name such as `orca-trial-no-object-storage`.
- It must not emulate S3, start MinIO, create fake S3 credentials, or use `ATTACHMENT_STORAGE_S3_*`, `PHR_EXPORT_S3_*`, `MINIO_*`, or equivalent object-storage secret/config values.
- Object-storage-dependent routes must fail closed with sanitized client responses when the profile is active. At minimum, attachment upload/download, patient image upload/download, and PHR export storage paths must not silently succeed.
- Readiness/health must not expose internal object-storage detail. If readiness reports the disabled storage profile, the status must be sanitized and must not claim object-storage readiness.
- ORCA official routes needed by the safe wrappers must not require object-storage initialization when the profile is active.
- The implementation must update the relevant contracts/runbooks/sample configuration in the same change set, without adding real secrets.

## Allowed Actions

- Confirm branch, HEAD, status, worktrees, and no unrelated unsafe repo state.
- Inspect `server-modernized/`, `setup-modernized-env.sh`, `docker-compose.modernized.dev.yml`, and current runtime config tests.
- Implement the minimal server/runtime changes needed for the object-storage-free profile.
- Update docs under `docs/contracts/`, `docs/runbooks/`, and the roadmap package to describe the profile and its non-claims.
- Update sample config with placeholders or disabled-mode values only if the code contract requires it.
- Add focused tests for resolver/validator behavior, storage manager fail-closed behavior, readiness sanitization, and no S3 credential requirement in the disabled profile.
- Run focused server tests and existing guard scripts relevant to config contracts.
- Record sanitized evidence only.
- Update `HANDOFF_STATE.json`, gate matrix, and write a completion report.

## Forbidden Actions

- Production ORCA execution.
- Live Trial ORCA execution before the non-S3 profile is implemented and locally verified.
- Local dummy S3, MinIO, fake S3 credentials, or object-storage credential generation.
- Requesting, printing, committing, or working around `ATTACHMENT_STORAGE_S3_*`, `PHR_EXPORT_S3_*`, `MINIO_*`, or equivalent values.
- Claiming attachment storage readiness, PHR export readiness, S3 persistence, object-storage deployment readiness, production ORCA readiness, or final release readiness.
- Raw ORCA request/response body capture.
- Raw patient/insurance detail capture.
- HAR, trace, video, screenshot, raw network dump, request XML, raw request/response body, or body-derived artifacts.
- `env`, `printenv`, `set`, `history`, or `set -x`.
- Changes under legacy `client/` or `server/`.

## Required Misuse Cases

Before implementation, explicitly check at least these misuse cases:

1. A user tries to upload/download attachments or patient images while the profile is active.
2. Readiness or health leaks storage endpoint/configuration detail or overclaims storage readiness.
3. A developer accidentally supplies S3/MinIO variables and the profile silently uses them.
4. ORCA Trial wrapper execution is blocked by object-storage initialization even though the endpoint does not need storage.

## Completion Criteria

- The object-storage-free profile is documented and locally testable.
- Object-storage-dependent features fail closed and are not claimed ready.
- ORCA official wrapper prerequisites can be checked without object-storage credentials.
- Relevant tests/checks pass.
- Credentials captured: `false`.
- Raw artifacts captured: `false`.
- If live Trial ORCA is not run, create or leave an active follow-up prompt for exactly one approved Phase4 `medicalmodv2` action through `web-client/scripts/qa-phase4-safe-medicalmodv2.mjs`.

## Final Report Requirements

Report:

- files changed
- tests/checks run
- whether the profile is implemented or still blocked
- object-storage behavior in disabled profile
- readiness/health sanitization result
- live Trial ORCA action status
- credentials captured: expected `no`
- raw artifacts captured: expected `no`
- next prompt status

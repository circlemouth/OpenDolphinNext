# NEXT_WORKER_PROMPT

status: blocked_environment_unavailable
created_at: 2026-04-28T23:03:20Z
updated_at: 2026-04-28T23:03:20Z
source_work_order: RWO-08B
blocker_id: rwo08b-visitptlstv2-identifier-preflight-runtime-orca-config-decrypt-blocker
priority: high
supersedes:
- fullflow-l4-medicalgetv2-api15-history-row-identifier-contract-blocker

## Context

RUN_ID `20260428T230320Z` implemented the official `visitptlstv2` `Request_Number=01` alternative identifier-preflight contract for RWO-08B.

Evidence:

- `docs/implementation/rwo08b-visitptlstv2-identifier-preflight-20260428T230320Z/summary.sanitized.json`
- `docs/implementation/rwo08b-visitptlstv2-identifier-preflight-20260428T230320Z/FINAL_REPORT.md`

The previous contract blocker is resolved repo-locally:

- `acceptlstv2` remains the server-derived selected target source.
- `medicalgetv2` class `01` remains accepted when it returns a ready identifier row.
- Official `visitptlstv2` `Request_Number=01` is now accepted as an alternative read-only identifier-proof source only when a sanitized visit row matches the server-selected acceptance patient, visit date, department, and insurance combination and includes voucher and sequential identifiers.
- Client-provided identifiers remain non-authoritative.

The read-only Trial rerun did not produce usable identifier-preflight evidence because the local runtime failed before ORCA identifier proof could be obtained. The sanitized classification is `runtime_orca_config_decrypt_blocked_before_identifier_preflight`.

Do not run diagnostic Fullflow while this blocker remains.

## Current Blocker

The local server runtime could not decrypt its existing ORCA connection configuration with the currently loaded local runtime key. Treat this as `skipped_environment_unavailable_missing_runtime_secret_or_config`.

Do not print, replace, or silently regenerate ORCA credentials, encrypted connection records, cookies, sessions, Authorization headers, or external-service secrets. If the matching approved local runtime configuration/key is not available, carry this blocker forward and continue independent non-live roadmap work.

## Goal

After the approved local ORCA runtime configuration and matching local-only encryption key are restored or realigned without exposing secret values, rerun the exact artifact-free read-only RWO-08B target-readiness wrapper.

Diagnostic Fullflow is allowed only if same-run sanitized read-only evidence proves `identifierPreflightReady=true` through either:

- a ready `medicalgetv2` row; or
- a ready matching `visitptlstv2` `Request_Number=01` row.

## Required Task Order

1. Inspect current branch, HEAD, status, worktrees, and this prompt.
2. Confirm that `docs/implementation/rwo08b-visitptlstv2-identifier-preflight-20260428T230320Z/summary.sanitized.json` is the latest RWO-08B evidence.
3. Confirm approved local runtime configuration availability without printing secret values.
4. If the local ORCA configuration/key mismatch is still present and cannot be safely repaired under the local-only policy, record a sanitized skip and continue independent non-live roadmap work.
5. If runtime is repaired, run only the artifact-free read-only wrapper with `--sanitized-evidence-only --disable-browser-artifacts`.
6. Do not run diagnostic Fullflow unless identifier-preflight is target-ready and the same run records endpoint packet, target, stop conditions, artifact containment, and sanitized evidence policy.

## Allowed Actions

- Repo inspection under `web-client/`, `server-modernized/`, `api-contract/`, `docs/`, `ops/`, `tests/`, and `scripts/`.
- Edit `docs/implementation/automation-handoff/HANDOFF_STATE.json`.
- Add sanitized evidence under `docs/implementation/rwo08b-visitptlstv2-identifier-preflight-<RUN_ID>/`.
- Run focused server tests, web script tests, JSON validation, `git diff --check`, Docker build/recreate for the local dev/Trial runtime, and safe read-only Trial wrappers when approved runtime/config is available.
- Commit roadmap/handoff-scoped source/doc/evidence changes before reporting.

## Forbidden Actions

- Do not print or commit secret values, ORCA credentials, encrypted credential material, cookies, sessions, Authorization headers, CSRF values, raw ORCA bodies, raw patient details, raw insurance details, HAR, traces, videos, screenshots, request XML, raw network dumps, or credential-bearing URLs.
- Do not overwrite existing non-empty local runtime secret/config values when the classification is ambiguous.
- Do not run live Trial mutation from this prompt.
- Do not run diagnostic Fullflow unless identifier-preflight readiness is proven in the same run.
- Do not use production ORCA, production credentials, production patient data, S3/MinIO/object-storage setup, dummy object storage, or object-storage readiness claims.
- Do not change legacy `client/` or `server/`.
- Do not treat HTTP 200, wrapper exit 0, read-only discovery, dry-run, or identifier-preflight metadata as Fullflow L4 success.
- Do not treat browser UI hiding, local storage state, client-provided identifiers, or client-provided facility/patient/owner data as authority.

## Evidence Requirements

Record sanitized Markdown/JSON only:

- current branch/HEAD/status/worktree;
- task id and RUN_ID;
- prior evidence files read;
- selected target continuity for `00002` and row hash;
- runtime configuration availability classification without values;
- read-only wrapper result, if rerun;
- explicit non-claims;
- `credentialsCaptured=false`;
- `rawArtifactsCommittedOrPackaged=false`;
- `productionOrcaAttempted=false`;
- `s3ObjectStorageUsed=false`.

## Completion Criteria

This prompt may be marked `completed` only when one of these is true:

- identifier-preflight becomes target-ready for the accepted non-duplicate target and queues or executes an authorized diagnostic Fullflow retry packet; or
- the environment blocker is recorded again and the worker has continued to the next safe independent non-live roadmap task.

## Next Recommended First Action

Restore or realign the approved local ORCA runtime configuration and its matching local-only encryption key without printing values. Then rerun the same artifact-free read-only RWO-08B target-readiness wrapper for patient `00002`, date `2026-04-29`, class `01`, row hash `b3b3d7c1416f047abb6450023e575fa39f53ed1d8f804aef8cf3551d945a5ddb`.

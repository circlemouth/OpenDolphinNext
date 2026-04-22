# NEXT_WORKER_PROMPT

status: active
created_at: 2026-04-22
last_checked_at: 2026-04-22T22:45:59Z
source_work_order: WO-8
blocker_id: phase4-live-trial-blocked-local-runtime-config-missing
priority: high
supersedes:
- docs/implementation/automation-handoff/history/NEXT_WORKER_PROMPT-20260422T145704Z-phase4-safe-wrapper-action-missing-completed.md
- docs/implementation/automation-handoff/history/NEXT_WORKER_PROMPT-20260422T160301Z-phase4-live-trial-blocked-missing-runtime-secret-or-config.md
- docs/implementation/automation-handoff/history/NEXT_WORKER_PROMPT-20260422T170230Z-phase4-live-trial-blocked-missing-runtime-secret-or-config.md
- docs/implementation/automation-handoff/history/NEXT_WORKER_PROMPT-20260422T180231Z-phase4-live-trial-blocked-missing-runtime-secret-or-config.md
- docs/implementation/automation-handoff/history/NEXT_WORKER_PROMPT-20260422T190124Z-phase4-live-trial-blocked-missing-runtime-secret-or-config.md
- docs/implementation/automation-handoff/history/NEXT_WORKER_PROMPT-20260422T200131Z-phase4-live-trial-blocked-missing-runtime-secret-or-config.md

## Context

WO-8 Phase4 `medicalmodv2` now has a safe wrapper, an in-repo JSON payload, and owner approval for the JSON SHA-256.

The consolidated worker plan is:

- `docs/implementation/phase4-orca-trial-payloads-20260422/PHASE4_WORKER_UNBLOCKING_PLAN.md`

Resolved blockers:

- `phase4-safe-wrapper-action-missing`: resolved by RUN_ID `20260422T145704Z`.
- `phase4-live-trial-blocked-missing-runtime-secret-or-config`: resolved for payload availability by RUN_ID `20260422T224559Z`; the executable payload is now in-repo.
- JSON SHA approval gap: resolved by owner addendum recorded at `docs/implementation/phase4-orca-trial-payloads-20260422/OWNER_APPROVAL_PHASE4_JSON_SHA_ADDENDUM.md`.

Current blocker:

- RUN_ID `20260422T224559Z` did not execute live ORCA because the local backend at `http://127.0.0.1:9080/openDolphin/api/health` was unreachable. Docker daemon became available after Docker Desktop start, but `WEB_CLIENT_MODE=npm ./setup-modernized-env.sh` stopped before backend start because `MODERNIZED_POSTGRES_PASSWORD` was missing. Generated setup files containing runtime configuration were removed after the failed setup attempt.

## Approved Live Trial Scope

- environment: Live ORCA Trial only
- wrapper: `web-client/scripts/qa-phase4-safe-medicalmodv2.mjs`
- server route: `POST /api/orca/official/chart-support/medical-mod-v2`
- native target class: `/api21/medicalmodv2?class=01`
- request class: `medicalmodv2`
- target candidate/patient scope: `00001 / 00001`
- payload: `web-client/qa/payloads/phase4/medicalmodv2_phase4_dummy_current_wrapper_v1.json`
- payload SHA-256: `e0f34fa28177155bf19cc0476863bf540f8b1ff4d844ddf189b88ab327645618`
- owner approval token: `OWNER_APPROVAL_PHASE4_EXECUTE_00001_ONLY_ONE_TIME_NO_FULLFLOW_NO_PHASE3_RERUN_NO_RN02_03_04_JSON_SHA_E0F34FA28177155BF19CC0476863BF540F8B1FF4D844DDF189B88AB327645618`
- execution limit: one live Trial action only

## Goal

Provide or generate required local runtime configuration through an approved non-logged path, start or confirm the repo-local modernized backend with approved ORCA Trial configuration, then run exactly one live Trial Phase4 `medicalmodv2` dummy execution through the exact safe wrapper above.

## Allowed Actions

- Confirm branch, HEAD, status, worktrees, and no unrelated unsafe repo state.
- Read `docs/implementation/phase4-orca-trial-payloads-20260422/PHASE4_WORKER_UNBLOCKING_PLAN.md`.
- Confirm `orca.env.local` or documented ORCA env path is present without printing values.
- Confirm required local runtime secrets/config for backend startup are present without printing values.
- Start the documented local runtime using `WEB_CLIENT_MODE=npm ./setup-modernized-env.sh` if the runtime is not already up and Docker is available.
- Run health/readiness checks that do not expose secrets or internal details.
- Run focused wrapper tests or dry-run checks if needed.
- Run exactly one live Trial `medicalmodv2` action with:

```bash
RUN_ID=<run_id> node web-client/scripts/qa-phase4-safe-medicalmodv2.mjs \
  --execute-approved-phase4 \
  --sanitized-evidence-only \
  --disable-browser-artifacts \
  --phase4-only \
  --payload web-client/qa/payloads/phase4/medicalmodv2_phase4_dummy_current_wrapper_v1.json \
  --payload-sha256 e0f34fa28177155bf19cc0476863bf540f8b1ff4d844ddf189b88ab327645618
```

- Record sanitized JSON/MD evidence only.
- Update handoff state and release-readiness docs after the live attempt or runtime blocker classification.

## Forbidden Actions

- Production ORCA execution.
- Phase3 retry.
- fullflow.
- acceptmodv2 mutation.
- diseasev3 live execution.
- subjectivesv2 live execution.
- Request_Number `02` / `03` / `04`.
- Mutating `00002` through `00011`.
- Using any wrapper/action other than `web-client/scripts/qa-phase4-safe-medicalmodv2.mjs` for this live Phase4 attempt.
- Printing or committing credentials, cookies, tokens, sessions, raw ORCA request body, raw ORCA response body, raw patient detail, raw insurance detail, or credential-bearing URL.
- HAR, trace, video, screenshot, raw network dump, request XML, raw request/response body, or body-derived artifacts.
- `env`, `printenv`, `set`, `history`, or `set -x`.
- Treating HTTP 200, wrapper exit 0, dry-run, mock, precheck, `not_run`, `not_verified`, or owner-waived evidence as business success.

## Business Success Criteria

The live Trial Phase4 action is business success only if the sanitized wrapper summary shows all of:

- `response.httpStatus` is 2xx.
- `response.apiResult` is zero-like.
- `response.businessAccepted=true`.
- At least one endpoint-specific completion field is present in `response.completionEvidence`: information timestamp, `medicalUid`, `invoiceNumber`, or `dataId`.
- `rawResponseBodyStored=false`, `rawPayloadStored=false`, `rawPatientOrInsuranceDetailStored=false`, and `rawArtifactsCaptured=false`.

If those fields are absent or ambiguous, classify the result as `INCONCLUSIVE` / `notVerified` / blocker, not success.

## Stop Conditions

- Production ORCA would be required.
- Docker/local backend remains unavailable.
- Required local runtime secrets/config for backend startup are absent.
- ORCA runtime config is absent or unreadable.
- Payload SHA mismatch.
- Raw artifact capture would be needed to decide success.
- Target/scope ambiguity.
- Wrapper/action drift.
- Repeated local repair loop without new evidence.

## Final Report Requirements

Report:

- files changed
- tests/checks run
- live Trial ORCA action status
- endpoint/target/request class
- sanitized result and business-success classification
- credentials captured: expected `no`
- raw artifacts captured: expected `no`
- next prompt status

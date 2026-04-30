# NEXT_WORKER_PROMPT

status: completed_rwo08b_trial_diagnostic_fullflow
created_at: 2026-04-29T21:58:00Z
updated_at: 2026-04-30T02:12:40Z
source_work_order: RWO-08B
blocker_id: none
priority: normal
supersedes:
- rwo08b-duplicate-acceptance-after-fresh-readiness-before-order-panel-validation
- rwo08b-duplicate-acceptance-official-identifiers-still-missing-after-medical-row-reconciliation

## Completion Summary

RUN_ID `20260430T020641Z` completed the WebORCA Trial diagnostic Fullflow path through Charts order send.

Sanitized evidence:

- `docs/implementation/rwo08b-fullflow-complete-20260430T020641Z/summary.sanitized.json`
- `docs/implementation/rwo08b-fullflow-complete-20260430T020641Z/FINAL_REPORT.md`
- `docs/implementation/rwo08b-fullflow-complete-20260430T020641Z/command-log.jsonl`

Local-only diagnostic artifacts, not reviewer evidence:

- `artifacts/diagnostic-fullflow/20260430T020641Z/`

Do not commit, package, paste, or reviewer-submit screenshots, HAR, traces, videos, raw network artifacts, raw ORCA request/response bodies, raw patient details, raw insurance details, request XML, cookies, sessions, Authorization headers, CSRF values, credentials, or credential-bearing URLs.

## Result

- Fresh read-only readiness classified the target as `target_ready_for_diagnostic_fullflow`.
- `acceptmodv2` reached WebORCA Trial and returned HTTP `200` / `Api_Result=16`; this duplicate acceptance was reconciled to a server-derived Charts handoff.
- Charts handoff status was `ready`; visit row readiness was `ready`.
- The diagnostic order-save path created a coded `treatmentOrder`.
- `medicalmodv2` reached `/api/orca/official/chart-support/medical-mod-v2` and returned HTTP `200` / `Api_Result=80`.
- The same-day registered-data response was classified as an idempotent duplicate for this duplicate-target Fullflow path.
- UI showed `ORCA送信を完了`.

## Retry Policy Note

Owner instruction on 2026-04-30 removed the three-attempt retry limit. This is now recorded in `HANDOFF_STATE.json`.

The removal does not authorize blind repeated sends. Future live Trial retries still require a concrete repo-local fix or changed precondition, focused no-live verification, fresh sanitized read-only preflight, and sanitized result recording.

## Next Safe Work

RWO-08B diagnostic Fullflow is no longer the active blocker. The next automation worker should select the next non-S3, non-production roadmap item, preferably updating release gate matrix/reviewer packet references to include this Trial diagnostic Fullflow completion.

Keep `RWO-11/RWO-09` rollback rehearsal, owner final GO/NO-GO/PENDING decision capture, operator acceptance, production ORCA, and S3/object-storage gates outside this automation unless explicitly reassigned.

## Forbidden Actions

- Do not run unchanged blind live Trial mutations without a concrete fix or changed precondition.
- Do not print or commit secret values, ORCA credentials, encrypted credential material, cookies, sessions, Authorization headers, CSRF values, raw ORCA bodies, raw patient details, raw insurance details, HAR, traces, videos, screenshots, request XML, raw network dumps, or credential-bearing URLs.
- Do not run production ORCA, production credentials, production patient data, S3/MinIO/object-storage setup, dummy object storage, or object-storage readiness claims.
- Do not change legacy `client/` or `server/`.

## Completion Criteria

This prompt is complete. A future prompt should be created only when a new safe roadmap item is selected.

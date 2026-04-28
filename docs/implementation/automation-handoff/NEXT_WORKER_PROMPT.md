# NEXT_WORKER_PROMPT

status: active
created_at: 2026-04-28T21:24:00Z
updated_at: 2026-04-28T22:42:00Z
source_work_order: RWO-08B
blocker_id: fullflow-l4-medicalgetv2-api15-history-row-identifier-contract-blocker
priority: high
supersedes:
- fullflow-l4-combined-target-readiness-refresh
- fullflow-l4-identifier-preflight-medicalgetv2-blocker

## Context

RWO-08B is not complete. Do not treat the current handoff queue or read-only evidence as Fullflow L4 success.

Latest sanitized evidence:

- `docs/implementation/rwo08b-target-readiness-after-import-20260428T210334Z/run-summary.sanitized.json`: non-duplicate candidate `00002` was locally imported, exact selected-candidate preflight accepted, one guarded acceptmodv2 Trial mutation created an acceptlstv2 target row, and the combined wrapper then blocked at identifier-preflight.
- `docs/implementation/rwo08b-fullflow-l4-target-readiness-20260428T213244Z/summary.sanitized.json`: after a repo-local repair and server rebuild, read-only acceptlstv2 inventory for `2026-04-29` class `01` still found one target-ready `00002` row hash. Identifier-preflight preserved server-derived acceptance metadata, but blocked because medicalgetv2-compatible identifier rows were absent/unavailable.
- `docs/implementation/rwo08b-fullflow-l4-medicalgetv2-20260428T220414Z/summary.sanitized.json`: repo-local payload repair added body-level `Request_Number`, outpatient `InOut=O`, `For_Months=1`, and class `01` history request shape. After rebuild, medicalgetv2 reached HTTP `2xx` and returned sanitized `apiResult=15` / `apiResultClass=nonzero`; one sanitized history row has `hasPerformDate=true` but lacks `Department_Code`, `Sequential_Number`, and `Insurance_Combination_Number`, so `medicalReadyRowCount=0` and `identifierPreflightReady=false`.
- `docs/implementation/rwo08b-fullflow-l4-medicalgetv2-20260428T220414Z/class03-probe/summary.sanitized.json`: class `03` read-only probe also returned `apiResult=15` / `apiResultClass=nonzero` and no ready identifier rows.

The current evidence does not prove an ORCA server defect and does not prove Fullflow L4. It proves a narrower blocker: `00002` has an acceptlstv2 target row, medicalgetv2 is reachable through the safe wrapper, but class `01`/`03` read-only results do not provide the currently required identifier fields.

## Goal

Execute `RWO-08B_MEDICALGETV2_API15_IDENTIFIER_CONTRACT_DECISION_NO_LIVE`.

Produce sanitized evidence that either:

1. proves that combining server-derived `acceptlstv2` department/insurance metadata with a class `01` medicalgetv2 history row is a safe and sufficient identifier-preflight contract for diagnostic Fullflow retry;
2. proves that another official read-only endpoint can supply the missing `Sequential_Number` / order-send identifiers without raw artifacts; or
3. records a minimized owner/operator question if this is a business-state/test-data prerequisite rather than a repo-local contract issue.

## Required Task Order

1. Inspect current branch, HEAD, status, worktrees, and this prompt.
2. Read:
   - `docs/implementation/rwo08b-fullflow-l4-target-readiness-20260428T213244Z/summary.sanitized.json`
   - `docs/implementation/rwo08b-target-readiness-after-import-20260428T210334Z/run-summary.sanitized.json`
   - `docs/runbooks/release-validation.md`
3. Threat-model at least these misuse cases before changes:
   - treating the target-ready acceptlstv2 row as medicalgetv2/order-send readiness;
   - reusing duplicate-blocked `00001` or `00005` unchanged;
   - treating HTTP 200, read-only discovery, dry-run, or identifier-preflight metadata as Fullflow L4 success;
   - capturing or committing raw ORCA bodies, credentials, patient details, insurance details, HAR, trace, video, screenshot, or raw network dumps.
4. Start from the accepted non-duplicate `00002` evidence and row hash. Do not repeat candidate discovery unless target drift is suspected.
5. Investigate official medicalgetv2 semantics and repo wrapper behavior without raw bodies. Prefer official ORCA documentation first, especially whether class `01` history rows are intended to omit sequence/insurance details under `apiResult=15`.
6. If runtime is used, run only artifact-free read-only wrappers with `--sanitized-evidence-only --disable-browser-artifacts`.
7. Do not run diagnostic Fullflow unless identifier-preflight becomes target-ready and artifact containment/preflight requirements are recorded in the same run.

## Allowed Actions

- Repo inspection under `web-client/`, `server-modernized/`, `api-contract/`, `docs/`, `ops/`, `tests/`, and `scripts/`.
- Edit `docs/implementation/automation-handoff/HANDOFF_STATE.json`.
- Add sanitized evidence under `docs/implementation/rwo08b-fullflow-l4-medicalgetv2-contract-<RUN_ID>/`.
- Add or edit narrow no-live/read-only tests or wrappers for medicalgetv2 identifier-row classification.
- Run focused server tests, web script tests, JSON validation, `git diff --check`, and safe read-only Trial wrappers when approved runtime/config is available.
- Commit roadmap/handoff-scoped source/doc/evidence changes before reporting.

## Forbidden Actions

- Do not assert ORCA-side fault from current evidence alone.
- Do not claim Fullflow L4 success unless order-send business success is proven by endpoint-specific sanitized evidence.
- Do not repeat candidates `00001` or `00005` unchanged.
- Do not run live Trial mutation unless a complete endpoint packet and same-run preflight explicitly authorize it.
- Do not use production ORCA, production credentials, production patient data, S3/MinIO/object-storage setup, dummy object storage, or object-storage readiness claims.
- Do not change legacy `client/` or `server/`.
- Do not commit or package raw ORCA bodies, raw patient/insurance detail, credentials, cookies, sessions, Authorization headers, CSRF values, HAR, traces, videos, screenshots, request XML, raw network dumps, or credential-bearing URLs.
- Do not treat browser UI hiding, local storage state, client-provided identifiers, or client-provided facility/patient/owner data as authority.

## Evidence Requirements

Record sanitized Markdown/JSON only:

- current branch/HEAD/status/worktree;
- task id and RUN_ID;
- prior evidence files read;
- candidate/row-hash continuity for `00002`;
- read-only medicalgetv2 `apiResult` / row-presence classification;
- wrapper/test changes, if any;
- explicit non-claims;
- `credentialsCaptured=false`;
- `rawArtifactsCommittedOrPackaged=false`;
- `productionOrcaAttempted=false`;
- `s3ObjectStorageUsed=false`.

## Completion Criteria

This prompt may be marked `completed` only when one of these is true:

- identifier-preflight becomes target-ready for the accepted non-duplicate target and queues a diagnostic Fullflow retry packet;
- a contract-safe alternative identifier-preflight rule is implemented with tests and read-only evidence; or
- a minimized blocker is recorded proving this requires Trial business-state/test-data setup outside the current wrapper contract.

## Next Recommended First Action

Use the latest `00002` row hash and decide, from official specs and sanitized wrapper behavior, whether class `01` medicalgetv2 `apiResult=15` history evidence plus server-derived acceptlstv2 metadata is sufficient, or whether another official endpoint/test-data state is required before diagnostic Fullflow can safely run.

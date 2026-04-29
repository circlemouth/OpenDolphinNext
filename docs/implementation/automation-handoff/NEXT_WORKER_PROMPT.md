# NEXT_WORKER_PROMPT

status: blocked_web_existing_acceptance_handoff
created_at: 2026-04-28T23:29:46Z
updated_at: 2026-04-29T10:34:32Z
source_work_order: RWO-08B
blocker_id: rwo08b-existing-orca-acceptance-web-handoff-blocker
priority: high
supersedes:
- rwo08b-visitptlstv2-identifier-preflight-runtime-orca-config-decrypt-blocker
- rwo08b-current-trial-target-missing-official-identifier-proof

## Context

RUN_ID `20260429T014800Z` supersedes the prior Trial business-state blocker. The owner/operator re-created the WebORCA Trial GUI reception for patient `00002`, and the rebuilt local runtime at HEAD `b5187fa7c` proved same-run target readiness using only sanitized read-only evidence.

Sanitized local-only diagnostic evidence from that run:

- `artifacts/diagnostic-fullflow/20260429T014800Z/rwo08b-target-readiness/summary.sanitized.json`
- `artifacts/diagnostic-fullflow/20260429T014800Z/rwo08b-acceptance-inventory/phase4-acceptmodv2-target-inventory-summary.sanitized.json`
- `artifacts/diagnostic-fullflow/20260429T014800Z/fullflow/blocker-summary.json`
- `artifacts/diagnostic-fullflow/20260429T014800Z/fullflow/summary.json`

These diagnostic artifact paths are local-only and ignored. Do not commit, package, paste, or reviewer-submit screenshots, HAR, traces, videos, raw network artifacts, raw ORCA request/response bodies, raw patient details, raw insurance details, request XML, cookies, sessions, Authorization headers, CSRF values, credentials, or credential-bearing URLs.

Read-only target readiness result:

- selected patient: `00002`
- target: WebORCA / ORCA Trial only
- candidate discovery selected `00002`
- exact preflight accepted
- acceptance inventory classification: `readonly_inventory_target_ready`
- server-derived row hash: `89b7157986cd853ad568c291163c492e20763d0a1ebb723a05f45cbd9dbe2995`
- target-readiness classification: `target_ready_for_diagnostic_fullflow`
- strict gate passed: `identifierPreflightReady=true`
- provisional gate was not needed: `provisionalIdentifierPreflightReady=false`
- `medicalReadyRowCount=1`
- `visitReadyRowCount=1`
- HTTP status `200`, sanitized `apiResult=00`

Diagnostic Fullflow was then run under the Diagnostic Artifact Exception with `QA_PATIENT_ID=00002`. It exited `1` before order send. The result was not a Trial identifier problem and not an ORCA order-send business result.

Observed Fullflow blocker:

- blocker classification: `test-data-blocker`
- blocker reason: `fatal_before_send`
- accept mutation observed HTTP 2xx with sanitized `apiResult=90`
- active rows: `0`
- keyed active rows: `0`
- matching rows: `2`
- matching statuses: `予約`
- charts handoff disabled because there was no active keyed local reception entry
- request XML was not created: `no_request_xml`
- `medicalmodv2` / order send did not run

## Current Blocker

The previous ORCA-side identifier/readiness blocker is cleared for the current target. The remaining blocker is repo-local Web client / QA Fullflow handoff behavior.

The Fullflow harness cannot reuse the existing ORCA GUI-created accepted target as an active local reception/charts handoff. Instead it attempts a Web accept mutation again, receives sanitized `apiResult=90`, then stops before chart handoff and before order-send XML creation.

## Required Boundary

Do not rerun the unchanged diagnostic Fullflow path. A changed repo-local precondition or code fix is required first.

Do not treat target-readiness, HTTP 200, wrapper exit 0, accept mutation transport success, dry-run, UI state, or local browser state as Fullflow L4 success. Fullflow success still requires endpoint-specific sanitized business evidence after the order-send path reaches the intended ORCA endpoint.

Do not loosen authority to client-provided patient ID alone. Patient ID may be used only to select a candidate scope when the server derives and validates the corresponding ORCA acceptance row and local active reception/charts handoff state. Server-side authority, target-drift checks, and duplicate-live controls must remain enforced.

## Next Safe Work

Inspect and repair the existing-acceptance handoff path in `web-client/scripts/qa-fullflow-weborca.mjs` and the related Web reception/charts handoff flow. The safe fix should allow the diagnostic Fullflow harness to use a server-derived existing ORCA acceptance target row, or to hydrate the active local reception/charts handoff from that target, without trusting client-supplied identifiers as authority.

Expected implementation shape:

- read the sanitized target-readiness and Fullflow blocker summaries first;
- keep WebORCA Trial as the only ORCA target;
- keep production ORCA and S3/object-storage out of scope;
- avoid legacy `client/` and `server/` edits;
- add focused tests or script-level checks for the existing-acceptance handoff path;
- after a concrete repo-local fix or changed precondition, rerun one diagnostic Fullflow attempt under local-only artifact containment;
- if the retry still fails, record the new narrower blocker with sanitized evidence.

## Forbidden Actions

- Do not print or commit secret values, ORCA credentials, encrypted credential material, cookies, sessions, Authorization headers, CSRF values, raw ORCA bodies, raw patient details, raw insurance details, HAR, traces, videos, screenshots, request XML, raw network dumps, or credential-bearing URLs.
- Do not run production ORCA, production credentials, production patient data, S3/MinIO/object-storage setup, dummy object storage, or object-storage readiness claims.
- Do not change legacy `client/` or `server/`.
- Do not repeat unchanged live or diagnostic Trial sends.
- Do not use patient ID alone, browser UI state, local storage state, or client-provided identifiers as authority.

## Evidence Requirements

Record sanitized Markdown/JSON only:

- current branch/HEAD/status/worktree;
- task id and RUN_ID;
- prior evidence files read;
- selected target continuity or replacement target identity;
- runtime configuration availability classification without values;
- changed precondition or repo-local fix before retry;
- diagnostic Fullflow classification, if rerun;
- explicit non-claims;
- `credentialsCaptured=false`;
- `diagnosticArtifactsCaptured=true` only when contained local/untracked;
- `rawArtifactsCommittedOrPackaged=false`;
- `productionOrcaAttempted=false`;
- `s3ObjectStorageUsed=false`.

## Completion Criteria

This prompt may be marked `completed` only when one of these is true:

- the existing ORCA GUI-created acceptance can be safely handed off into active local reception/charts state, and diagnostic Fullflow reaches a sanitized order-send classification; or
- a narrower repo-local blocker is recorded after a concrete code fix or changed precondition, with sanitized evidence explaining the next repair.

## Next Recommended First Action

Read the target-readiness and Fullflow blocker summaries from RUN_ID `20260429T014800Z`, then fix the Web/QA existing-acceptance handoff path before any further diagnostic Fullflow retry.

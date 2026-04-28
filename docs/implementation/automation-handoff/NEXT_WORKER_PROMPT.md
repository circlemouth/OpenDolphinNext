# NEXT_WORKER_PROMPT

status: blocked_trial_business_state
created_at: 2026-04-28T23:29:46Z
updated_at: 2026-04-28T23:29:46Z
source_work_order: RWO-08B
blocker_id: rwo08b-current-trial-target-missing-official-identifier-proof
priority: high
supersedes:
- rwo08b-visitptlstv2-identifier-preflight-runtime-orca-config-decrypt-blocker

## Context

RUN_ID `20260428T232946Z` resolved the local Trial runtime decrypt blocker and refreshed read-only WebORCA / ORCA Trial evidence.

Evidence:

- `docs/implementation/rwo08b-trial-runtime-retry-20260428T232946Z/summary.sanitized.json`
- `docs/implementation/rwo08b-trial-runtime-retry-20260428T232946Z/FINAL_REPORT.md`

The dev/Trial runtime now passes `OPENDOLPHIN_ENVIRONMENT=trial-local` into `server-modernized-dev`, allowing the Trial-only runtime fallback to resolve WebORCA Trial settings when an old local encrypted ORCA connection record cannot be decrypted. No secret values were printed, replaced, or committed.

Fresh read-only evidence:

- duplicate-blocked candidates `00001` and `00005` were excluded;
- fresh candidate discovery selected only non-duplicate candidate `00002`;
- exact read-only preflight for `00002` passed;
- target-readiness reached `/api/orca/official/visits/identifier-preflight` with HTTP `200`;
- `acceptlstv2` selected target row remains target-ready;
- `medicalgetv2` class `01` returned `apiResult=15`, `medicalReadyRowCount=0`;
- `visitptlstv2` `Request_Number=01` returned one sanitized row, but `visitReadyRowCount=0`;
- `identifierPreflightReady=false`.

Diagnostic Fullflow remains not authorized for the current Trial target.

## Current Blocker

The blocker is now Trial business/test-data state, not repo-local runtime configuration.

The current non-duplicate Trial target `00002`, date `2026-04-29`, class `01`, row hash `b3b3d7c1416f047abb6450023e575fa39f53ed1d8f804aef8cf3551d945a5ddb` lacks official read-only voucher / sequential / insurance identifier proof.

## Required Boundary

Do not run diagnostic Fullflow for this current target unless a same-run artifact-free read-only target-readiness wrapper proves `identifierPreflightReady=true`.

Do not reuse `00001` or `00005` unchanged. They remain duplicate-blocked candidates for this RWO-08B path.

## Next Safe Work

Select the next independent roadmap item, or prepare a new complete endpoint packet for a non-duplicate Trial target setup path if one is explicitly allowed by the current roadmap/handoff and has:

- endpoint/request class;
- target identity;
- payload hash/identity;
- duplicate-live checkpoint;
- no-live wrapper result;
- parser/sanitizer result;
- runtime readiness;
- endpoint-specific business success criteria;
- stop conditions;
- sanitized evidence policy.

## Forbidden Actions

- Do not print or commit secret values, ORCA credentials, encrypted credential material, cookies, sessions, Authorization headers, CSRF values, raw ORCA bodies, raw patient details, raw insurance details, HAR, traces, videos, screenshots, request XML, raw network dumps, or credential-bearing URLs.
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
- selected target continuity or replacement target identity;
- runtime configuration availability classification without values;
- read-only wrapper result, if rerun;
- explicit non-claims;
- `credentialsCaptured=false`;
- `rawArtifactsCommittedOrPackaged=false`;
- `productionOrcaAttempted=false`;
- `s3ObjectStorageUsed=false`.

## Completion Criteria

This prompt may be marked `completed` only when one of these is true:

- identifier-preflight becomes target-ready for a non-duplicate accepted Trial target and queues or executes an authorized diagnostic Fullflow retry packet; or
- another independent safe roadmap item is selected and completed/skipped under the throughput policy.

## Next Recommended First Action

Continue to the next independent safe roadmap item. Return to RWO-08B only when a non-duplicate Trial target can provide official `medicalgetv2` or `visitptlstv2` voucher / sequential / insurance identifier proof through artifact-free read-only evidence.

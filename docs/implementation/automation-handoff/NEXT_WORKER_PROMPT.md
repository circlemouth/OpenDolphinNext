# NEXT_WORKER_PROMPT

status: active
created_at: 2026-04-28T20:16:56Z
updated_at: 2026-04-28T20:16:56Z
source_work_order: RWO-08B
blocker_id: fullflow-l4-target-readiness-investigation
priority: high
supersedes:
- continuing-official-and-public-research-until-actionable-info-found

## Context

User correction on 2026-04-28T19:52:56Z: an empty `HANDOFF_STATE.json.nextExecutableQueue` does not mean Fullflow L4 is complete. RWO-08B still has release-readiness work. The next worker must not treat the current state as "all validation done".

Current evidence does **not** prove an ORCA Trial server-side defect. It shows Fullflow L4 is blocked by unresolved target-readiness and handoff prerequisites that could be repo/local-sync/selector/handoff/harness issues, Trial test-data state, or ORCA business state. Do not blame ORCA unless sanitized evidence eliminates repo and harness causes.

Important prior evidence:

- `docs/implementation/rwo08b-candidate-00005-diagnostic-fullflow-20260425T144428Z/summary.sanitized.json`: candidate `00005` reached diagnostic fullflow pre-send but `acceptmodv2` returned duplicate acceptance classification (`apiResult=16`), no canonical acceptance keys, and no order send. Do not repeat `00005` unchanged.
- `docs/implementation/rwo08b-readonly-candidate-refresh-20260427T121615Z/summary.sanitized.json`: read-only discovery excluding duplicate-blocked `00001` and `00005` found no fresh selected candidate; remaining candidates failed local exact-match/selectability.
- `docs/implementation/rwo08b-local-exact-match-diagnostic-20260427T135043Z/summary.sanitized.json`: candidates `00002` through `00011` were categorized as `local_absent` / `local_exact_match_missing` despite official ORCA patient/insurance evidence; repo/local sync, facility scope, ID format, or UI selectability remain unproven.
- `docs/implementation/rwo08b-artifact-free-identifier-preflight-20260428T140210Z/summary.sanitized.json`: `/api/orca/official/visits/identifier-preflight` was implemented as an artifact-free, server-derived read-only preflight route, but it was not yet executed against Trial runtime and is not Fullflow success.

## Goal

Execute `RWO-08B_FULLFLOW_L4_TARGET_READINESS_INVESTIGATION`.

The goal is to make Fullflow L4 actionable again by producing sanitized evidence that either:

1. identifies and fixes a repo-local blocker needed for a fresh exact selected candidate and Charts/official identifier handoff;
2. proves a fresh target/read-only identifier preflight is available and queues the next safe diagnostic fullflow step; or
3. records a precise blocker with the next concrete safe action, without overclaiming ORCA fault or L4 success.

## Required Task Order

1. Inspect current branch, HEAD, status, worktrees, and this prompt.
2. Read the four prior evidence files listed above and `docs/runbooks/release-validation.md` Fullflow policy.
3. Threat-model at least these misuse cases before changes:
   - Treating official ORCA patient existence as local selectability/readiness.
   - Reusing duplicate-blocked `00001` or `00005` unchanged.
   - Treating read-only discovery, HTTP 200, dry-run, or wrapper exit as L4 business success.
   - Capturing or committing raw diagnostic artifacts, credentials, raw ORCA bodies, patient details, or insurance details.
4. First perform repo-local/no-live analysis and focused tests for local exact-match/sync and Charts official identifier hydration.
5. If runtime is available and approved non-S3 Trial config is already available through the documented local path, run the artifact-free read-only identifier preflight before any diagnostic fullflow retry.
6. Only consider a diagnostic fullflow retry if the same-run evidence proves:
   - exact selected-candidate preflight accepted for a fresh target;
   - local exact match/selectability is present;
   - duplicate-blocked `00001`/`00005` are not reused unchanged;
   - server-derived official visit identifiers or their absence are proven through sanitized evidence;
   - diagnostic artifacts can remain local-only/untracked under the Diagnostic Artifact Exception.

## Allowed Actions

- Repo inspection under `web-client/`, `server-modernized/`, `docs/`, `ops/`, `tests/`, and `scripts/`.
- Edit `docs/implementation/automation-handoff/HANDOFF_STATE.json`.
- Add sanitized evidence under `docs/implementation/rwo08b-fullflow-l4-target-readiness-<RUN_ID>/`.
- Add or edit narrow no-live tests/wrappers for local exact-match, local sync classification, selector readiness, Charts handoff, and official identifier hydration.
- Run focused no-live tests, JSON validation, web guard, doc links, and `git diff --check`.
- Run artifact-free read-only Trial identifier preflight only if existing approved local Trial runtime/config is available without printing secrets.
- Run one diagnostic fullflow only after all same-run preconditions above pass and diagnostic artifacts can be contained local-only/untracked.
- Commit roadmap/handoff-scoped source/doc/evidence changes before reporting.

## Forbidden Actions

- Do not assert ORCA-side fault from current evidence alone.
- Do not claim Fullflow L4 success unless order-send business success is proven by endpoint-specific sanitized evidence, not by HTTP 200/dry-run/read-only/preflight.
- Do not repeat candidates `00001` or `00005` unchanged.
- Do not run live Trial mutation without complete endpoint packet, same-run preflight, duplicate checkpoint, runtime readiness, and sanitized evidence policy.
- Do not use production ORCA, production credentials, production patient data, S3/MinIO/object-storage setup, dummy object storage, or object-storage readiness claims.
- Do not change legacy `client/` or `server/`.
- Do not commit or package raw ORCA bodies, raw patient/insurance detail, credentials, cookies, sessions, Authorization headers, CSRF values, HAR, traces, videos, screenshots, request XML, raw network dumps, or credential-bearing URLs.
- Do not treat browser UI hiding, local storage state, client-provided identifiers, or client-provided facility/patient/owner data as authority.

## Evidence Requirements

Record sanitized Markdown/JSON only:

- current branch/HEAD/status/worktree;
- task id and RUN_ID;
- prior evidence files read;
- candidate set and excluded duplicate-blocked identities using only sanitized IDs/classes already present in prior evidence;
- local exact-match/sync classification and whether repo-local fix was applied;
- identifier-preflight status if run: endpoint, mutation=false, request class, row-hash/presence flags only, no raw bodies;
- diagnostic fullflow status if run: local-only artifact root, artifact containment proof, route coverage/status classes, order-send reached/not reached, targetMutationRequestCount, business-success classification;
- explicit non-claims;
- `credentialsCaptured=false`;
- `rawArtifactsCommittedOrPackaged=false`;
- `productionOrcaAttempted=false`;
- `s3ObjectStorageUsed=false`.

## Completion Criteria

This prompt may be marked `completed` only when one of these is true:

- a repo-local blocker is fixed and focused tests plus sanitized evidence show the next exact selected-candidate/identifier preflight step is ready;
- read-only Trial identifier preflight produces a fresh target-ready or precise target-blocked classification and queues the next safe action;
- diagnostic fullflow reaches endpoint-specific L4 order-send business success with sanitized evidence; or
- a precise safety/environment/test-data blocker is recorded with the next concrete safe action.

If the worker cannot safely run runtime/read-only/diagnostic steps, it must still complete repo-local no-live analysis/tests where possible, write a sanitized blocker record, keep this prompt active or replace it with a narrower active successor, and continue to independent safe no-live/static work.

## Next Recommended First Action

Start with repo-local no-live investigation of local exact-match/sync and Charts official identifier hydration. Then, if runtime prerequisites exist, run `/api/orca/official/visits/identifier-preflight` in artifact-free read-only mode for a non-duplicate fresh candidate. Do not run `qa-fullflow-weborca` first.

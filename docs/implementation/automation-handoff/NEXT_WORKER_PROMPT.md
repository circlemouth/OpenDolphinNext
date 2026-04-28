# NEXT_WORKER_PROMPT

status: active
created_at: 2026-04-28T20:16:56Z
updated_at: 2026-04-28T21:24:00Z
source_work_order: RWO-08B
blocker_id: fullflow-l4-combined-target-readiness-refresh
priority: high
supersedes:
- continuing-official-and-public-research-until-actionable-info-found
- fullflow-l4-target-readiness-investigation

## Context

User correction on 2026-04-28T19:52:56Z: an empty `HANDOFF_STATE.json.nextExecutableQueue` does not mean Fullflow L4 is complete. RWO-08B still has release-readiness work. The next worker must not treat the current state as "all validation done".

Current evidence does **not** prove an ORCA Trial server-side defect. It shows Fullflow L4 is blocked by unresolved target-readiness and handoff prerequisites that could be repo/local-sync/selector/handoff/harness issues, Trial test-data state, or ORCA business state. Do not blame ORCA unless sanitized evidence eliminates repo and harness causes.

Important prior evidence:

- `docs/implementation/rwo08b-candidate-00005-diagnostic-fullflow-20260425T144428Z/summary.sanitized.json`: candidate `00005` reached diagnostic fullflow pre-send but `acceptmodv2` returned duplicate acceptance classification (`apiResult=16`), no canonical acceptance keys, and no order send. Do not repeat `00005` unchanged.
- `docs/implementation/rwo08b-readonly-candidate-refresh-20260427T121615Z/summary.sanitized.json`: read-only discovery excluding duplicate-blocked `00001` and `00005` found no fresh selected candidate; remaining candidates failed local exact-match/selectability.
- `docs/implementation/rwo08b-local-exact-match-diagnostic-20260427T135043Z/summary.sanitized.json`: candidates `00002` through `00011` were categorized as `local_absent` / `local_exact_match_missing` despite official ORCA patient/insurance evidence; repo/local sync, facility scope, ID format, or UI selectability remain unproven.
- `docs/implementation/rwo08b-artifact-free-identifier-preflight-20260428T140210Z/summary.sanitized.json`: `/api/orca/official/visits/identifier-preflight` was implemented as an artifact-free, server-derived read-only preflight route, but it was not yet executed against Trial runtime and is not Fullflow success.
- `docs/implementation/rwo08b-combined-target-readiness-20260428T204909Z/summary.sanitized.json`: `qa-rwo08b-target-readiness.mjs` now joins candidate discovery, exact selected-candidate preflight, and server-derived identifier-preflight into one artifact-free sanitized target-readiness summary. Dry-run against current prior evidence classified `candidate_discovery_no_selected_candidate`.
- `docs/implementation/rwo08b-target-readiness-after-import-20260428T210334Z/run-summary.sanitized.json`: RUN_ID `20260428T210334Z` resolved the local exact-match blocker for non-duplicate candidate `00002` by local ORCA patient import, exact selected-candidate preflight accepted, one guarded sanitized `acceptmodv2` Trial mutation created an acceptlstv2 target row, the stale backend image was rebuilt so `identifier-preflight` route was available, and the combined wrapper now blocks at `identifier_preflight_target_blocked` / HTTP `400` / sanitized `orca_gateway_error`. No diagnostic Fullflow or order-send was executed.

## Goal

Execute `RWO-08B_COMBINED_TARGET_READINESS_REFRESH`.

The goal is to make Fullflow L4 actionable again by producing sanitized evidence that either:

1. preserves the proven non-duplicate local-exact target `00002` and avoids repeating `00001`/`00005`;
2. resolves or precisely classifies the remaining `medicalgetv2`/identifier-preflight blocker for the server-derived `00002` target row; or
3. records a precise blocker with the next concrete safe action, without overclaiming ORCA fault or L4 success.

## Required Task Order

1. Inspect current branch, HEAD, status, worktrees, and this prompt.
2. Read the four prior evidence files listed above and `docs/runbooks/release-validation.md` Fullflow policy.
3. Threat-model at least these misuse cases before changes:
   - Treating official ORCA patient existence as local selectability/readiness.
   - Reusing duplicate-blocked `00001` or `00005` unchanged.
   - Treating read-only discovery, HTTP 200, dry-run, or wrapper exit as L4 business success.
   - Capturing or committing raw diagnostic artifacts, credentials, raw ORCA bodies, patient details, or insurance details.
4. Start from the latest `00002` evidence rather than repeating candidate discovery unless the target row has drifted.
5. Re-run read-only acceptlstv2 inventory for `2026-04-29` / class `01` to confirm the target row hash is still present.
6. Re-run `node scripts/qa-rwo08b-target-readiness.mjs --execute-readonly --sanitized-evidence-only --disable-browser-artifacts --candidate-discovery-summary <latest-candidate-summary> --exact-preflight-summary <latest-exact-preflight-summary> --acceptance-date 2026-04-29 --class 01 --medical-get-class <candidate> --target-row-hash <server-derived-row-hash>`.
7. If `identifier-preflight` still returns sanitized `orca_gateway_error`, investigate `medicalgetv2` official semantics and repo wrapper behavior without raw ORCA bodies. Do not treat this as ORCA fault or Fullflow success.
8. Only consider a diagnostic fullflow retry if the evidence proves:
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
- Run `web-client/scripts/qa-rwo08b-target-readiness.mjs` in dry-run mode and, only when same-run exact target proof exists, read-only identifier-preflight mode.
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
- combined target-readiness wrapper status and classification;
- identifier-preflight status if run: endpoint, mutation=false, request class, row-hash/presence flags only, no raw bodies;
- diagnostic fullflow status if run: local-only artifact root, artifact containment proof, route coverage/status classes, order-send reached/not reached, targetMutationRequestCount, business-success classification;
- explicit non-claims;
- `credentialsCaptured=false`;
- `rawArtifactsCommittedOrPackaged=false`;
- `productionOrcaAttempted=false`;
- `s3ObjectStorageUsed=false`.

## Completion Criteria

This prompt may be marked `completed` only when one of these is true:

- a fresh non-duplicate target is proven by candidate discovery, exact selected-candidate preflight, and combined target-readiness wrapper evidence;
- read-only Trial identifier preflight produces a fresh target-ready or precise target-blocked classification through the combined wrapper and queues the next safe action;
- diagnostic fullflow reaches endpoint-specific L4 order-send business success with sanitized evidence; or
- a precise safety/environment/test-data blocker is recorded with the next concrete safe action.

If the worker cannot safely run runtime/read-only/diagnostic steps, it must still complete repo-local no-live analysis/tests where possible, write a sanitized blocker record, keep this prompt active or replace it with a narrower active successor, and continue to independent safe no-live/static work.

## Next Recommended First Action

Confirm the `00002` acceptlstv2 target row is still present, then continue no-live/read-only investigation of why `identifier-preflight` cannot derive medicalgetv2-compatible identifier rows. Do not run `qa-fullflow-weborca` until identifier-preflight is target-ready.

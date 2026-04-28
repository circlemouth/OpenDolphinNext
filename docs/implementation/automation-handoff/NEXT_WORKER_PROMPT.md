# NEXT_WORKER_PROMPT

status: active
created_at: 2026-04-28T12:33:47Z
updated_at: 2026-04-28T12:33:47Z
source_work_order: RWO-06I/RWO-06H/RWO-06F/RWO-08B
blocker_id: continuing-official-and-public-research-until-actionable-info-found
priority: high
supersedes:
- remaining-automation-tasks-web-research-required

## Context

Owner instruction on 2026-04-28T12:33:47Z: make the plan so subsequent workers also perform additional research until the needed information is found.

The previous no-live research pass recorded evidence at `docs/implementation/remaining-task-web-research-20260428T115055Z/summary.sanitized.json`, but some endpoints still lack actionable row-level proof, target-readiness proof, or business-context evidence. A later worker must not treat one unsuccessful research pass as terminal. If the needed information is not found in one run, the worker must record what was checked, what was not found, what search/source set remains, and leave this prompt or a successor prompt active.

`RWO-11/RWO-09` rollback rehearsal, release-candidate stop, paired restore, restored-target smoke, operator acceptance, and final owner GO/NO-GO/PENDING remain external owner/operator release-management gates. Do not select or execute those release-management actions. Research may only identify repo-local no-live checks that do not replace the external gate.

## Goal

Execute `CONTINUING_RESEARCH_UNTIL_ACTIONABLE_INFO_FOUND_NO_LIVE`.

Continue official-source-first and secondary public-source research until one of the following is found for each remaining research target:

- an official ORCA source or source-confirmed mapping that unlocks a safe repo-local no-live/read-only task;
- a safe wrapper/parser/test change that can be implemented without live mutation or raw artifacts;
- an authoritative statement proving the needed information cannot be obtained from official/public sources and naming the exact remaining owner/operator decision.

Do not close this prompt merely because one search pass found no answer. If the answer is not found, leave a successor active with the next concrete source/query set.

## Research Targets

### RWO-06I Surgery

Find row-level evidence for class `500` surgery payloads:

- official `medicalmodv2` class `500` row ordering and role semantics;
- row-level proof path for procedure/material/comment rows such as `150003110`, `641210099`, `840000042`;
- whether any official master endpoint beyond `medicationgetv2 Request_Number=02` can prove surgery material/comment applicability, not just code existence or master freshness.

### RWO-06H Injection

Find target-readiness and retry-state evidence for class `310` injection:

- official explanation or source-confirmed meaning of `medicalmodv2 Api_Result=90`;
- read-only evidence path for fresh/lock-free or conflict-free target readiness using `acceptlstv2`, `medicalgetv2`, or another official endpoint;
- whether target freshness can be reduced to sanitized presence/hash checks without raw patient or insurance detail.

### RWO-06F Guidance Fee

Find business-context proof or the smallest remaining owner question for class `130`:

- official/read-only proof for disease context, monthly duplicate context, department/physician/insurance-combination readiness, facility context, selectable-comment applicability, and master freshness;
- source-confirmed guidance-fee prerequisites that decide whether the current class `130` candidate is appropriate;
- if no source can decide it, preserve only the shortest exact owner/operator question.

### RWO-08B Fullflow Identifiers

Find the smallest artifact-free no-live identifier preflight:

- official identifiers required before Charts handoff and ORCA order send;
- which identifiers may be represented as presence flags or row hashes;
- which identifiers must remain non-public and server-derived only;
- a no-live plan using `acceptlstv2` and `medicalgetv2` that avoids diagnostic artifacts.

## Required Research Method

1. Start with official ORCA pages already known in prior evidence.
2. Discover linked endpoint pages from the official overview and endpoint menus before using public sources.
3. Use public/non-official sources only as leads; mark them unconfirmed unless matched to official documentation or repo implementation evidence.
4. Search in Japanese and English terms where relevant, including endpoint names, request numbers, class codes, API result codes, and candidate code values.
5. Inspect repo wrappers/tests before deciding that a source finding is actionable.
6. For every not-found result, record the exact URL/query/source family checked and the next query/source family for the successor worker.

## Allowed Actions

- Web research under the official-source-first policy.
- Repo inspection under `web-client/`, `server-modernized/`, `docs/`, `ops/`, `tests/`, and `scripts/`.
- Edit `docs/implementation/automation-handoff/HANDOFF_STATE.json`.
- Add sanitized evidence under `docs/implementation/continuing-official-research-<RUN_ID>/`.
- Add or edit narrow no-live wrapper/parser tests only when research identifies a safe repo-local next task.
- Run focused no-live tests, JSON validation, web guard, doc links, and `git diff --check`.
- Commit roadmap/handoff-scoped source/doc/evidence changes before reporting.

## Forbidden Actions

- Any live Trial mutation.
- Production ORCA, production credentials, production patient data.
- S3/MinIO/object-storage setup, dummy object storage, or object-storage readiness claims.
- Raw ORCA bodies, raw patient detail, raw disease detail, raw insurance detail, credentials, cookies, sessions, Authorization headers, CSRF values, HAR, traces, videos, screenshots, or raw network dumps in committed/package evidence.
- Changes under legacy `client/` or `server/`.
- Treating official-source research, public-source research, HTTP 200, `Api_Result`, wrapper exit, dry-run pass, read-only preflight, code validity, or master freshness as business success.
- Selecting or executing `RWO-11/RWO-09` rollback/operator/final owner decision as automation release-management work.

## Evidence Requirements

Record sanitized Markdown/JSON only:

- checked URL or search query and checked date;
- source class: official, repo, public-confirmed, public-unconfirmed, or not-found;
- endpoint/request-class identity;
- relevant request number/class/code/result-code mapping;
- whether the finding creates a safe no-live/read-only next action;
- parser/sanitizer or wrapper-test requirements if applicable;
- stop conditions and business-success separation;
- next source/query set if information was not found;
- non-claims;
- `credentialsCaptured=false`;
- `diagnosticArtifactsCaptured=false`;
- `rawArtifactsCommittedOrPackaged=false`;
- `liveTrialOrca.executed=false`.

## Completion Criteria

This prompt may be marked `completed` only when every research target has one of:

- actionable source-backed no-live/read-only task queued;
- focused repo-local no-live wrapper/test work completed;
- authoritative official/source-confirmed evidence that no further public/official research can answer the question and the exact owner/operator question is minimized.

If any target still lacks that outcome, do not complete this prompt. Update `HANDOFF_STATE.json`, write sanitized evidence, and leave this prompt active or replace it with a narrower active successor listing the next source/query set.

## Same-Run Continuation Requirement

After recording evidence or a narrowed not-found result for one target, continue to the next target unless a global stop condition is reached.

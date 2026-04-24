# NEXT_WORKER_PROMPT

status: active
created_at: 2026-04-24T21:00:00Z
source_work_order: RWO-08B/RWO-06D/RWO-07/RWO-06F-through-06K
blocker_id: owner-expanded-fullflow-disease-request-number-order-v2-scope
priority: high
supersedes:
- subjectivesv2-live-trial-post-request-number-fix-transport-rejected-502-investigation

## Context

Owner direction recorded on 2026-04-24 expands automation scope:

- Existing broad browser/fullflow harnesses may run even if they create screenshots, HAR, traces, videos, or raw network artifacts, but only as local-only untracked diagnostic artifacts.
- Diagnostic artifacts are not release evidence and must not be committed, copied into reviewer packets, or pasted into summaries.
- `diseasev3` create/update/delete verification should proceed through endpoint-specific wrappers, parser/sanitizer checks, duplicate-live checkpoints, and sanitized business-success criteria.
- Electronic-chart operations that users can act on must be enumerated and tested, including Request_Number `02` / `03` / `04` or equivalent update/delete/cancel semantics.
- `medicalmodv2` order families with Trial-rejected v1 payloads must use web-researched official/public sources plus no-live contract checks to propose justified v2 candidates before any live retry.

Current repo state at creation:

- Branch: `master`
- Last known HEAD: `aa30a9b09`
- Latest reviewer packet refresh: RUN_ID `20260424T200206Z`
- Prior `subjectivesv2` status: HTTP `502` / `transportRejected`, no business success, no new live retry unless a concrete fix or changed precondition is found.

## Goal

Advance the expanded release-readiness scope without overclaiming:

1. Inventory fullflow/browser harnesses that can now run under the Diagnostic Artifact Exception.
2. Run or prepare the next safe fullflow diagnostic step if local runtime prerequisites are available.
3. Advance `diseasev3` from create-only no-live readiness toward live create verification, then prepare update/delete only after create has sanitized endpoint-specific evidence.
4. Build the RWO-07 operation matrix for every electronic-chart user action that maps to create/update/delete/cancel/copy/send semantics and Request_Number `02` / `03` / `04` or equivalent selectors.
5. Use web-researched official/public sources to propose v2 candidate payloads for rejected order families: `instractionChargeOrder/130`, `baseChargeOrder/110`, `injectionOrder/310`, `surgeryOrder/500`, `testOrder/600`, and `radiologyOrder/700`.

## Required First Steps

1. Inspect current branch, HEAD, status, and worktrees.
2. Read `$CODEX_HOME/automations/orca/memory.md`, `HANDOFF_STATE.json`, this prompt, `WORKPLAN_TO_RELEASE.md`, `REMAINING_WORK_BREAKDOWN.md`, `RELEASE_GATE_MATRIX.md`, and `ORCA_TRIAL_REACHABILITY_EXPANSION_PLAN.md`.
3. If uncommitted unrelated changes exist, do not overwrite them.
4. If the previous worker already completed one of the tasks below, continue with the next independent task.

## Allowed Actions

- Run web research against official/public sources for order v2 candidates, and record only source URLs, code/name/class candidates, caveats, and sanitized reasoning.
- Add docs/evidence for the v2 candidate research and update matrices.
- Run no-live parser/sanitizer/wrapper dry-runs for candidate payloads.
- Run live ORCA Trial checks only through existing reviewed wrappers or narrowly reviewed repo-local commands, with endpoint-specific success criteria and duplicate-live checkpoints.
- Run diagnostic fullflow/browser harnesses that create screenshots/HAR/traces/videos/raw-network artifacts only if artifacts remain local-only, untracked, and excluded from committed evidence and reviewer packets.
- Commit roadmap/handoff-scoped docs, sanitized evidence, and source/test fixes after verification.

## Forbidden Actions

- Production ORCA execution or production readiness claims.
- S3/MinIO/object-storage setup, dummy storage, fake object-storage credentials, or storage readiness claims.
- Printing, requesting, committing, or packaging ORCA credentials, production credentials, external-service secret values, cookies, session IDs, auth headers, anti-forgery values, credential-bearing URLs, raw ORCA bodies, raw patient details, or raw insurance details.
- Committing or packaging screenshots, HAR, traces, videos, raw network dumps, request XML, raw request/response bodies, or raw body-derived artifacts.
- Repeating a rejected v1 live mutation identity without a source-backed v2 candidate and focused no-live verification.
- Repeating `subjectivesv2` live with the same payload unless a concrete repo-local fix or changed precondition is documented and verified no-live.
- Changes under legacy `client/` or `server/`.

## Priority Order

1. Create a sanitized RWO-07 operation matrix for user-actionable chart operations and Request_Number `02` / `03` / `04` applicability.
2. Prepare or run `diseasev3` create live verification if existing wrapper/readiness prerequisites are satisfied; otherwise write the exact blocker and next command.
3. Inventory diagnostic fullflow harnesses and run the next safe diagnostic fullflow if runtime prerequisites are already available; otherwise record `skipped_environment_unavailable_*` and continue.
4. Record web-researched v2 candidate findings for rejected order families and prepare no-live candidate payload work.
5. Update `HANDOFF_STATE.json`, release gate matrix, roadmap docs, and final summary with claim boundaries.

## Evidence Requirements

- Sanitized Markdown/JSON evidence only.
- Diagnostic artifact manifest may list local relative directories, artifact classes, counts, hashes, and excluded-from-commit status, but must not include raw content.
- For live Trial steps: endpoint, target, request class/number, payload identity hash, duplicate-live checkpoint, parsed business-success classification, and credentialsCaptured/rawArtifactsCommitted flags.
- For web research: source URL, source type, candidate code/name/class, confidence, and caveats.

## Completion Criteria

This prompt is complete when one of these is true:

- RWO-07 operation matrix plus at least one next executable endpoint-specific task is recorded.
- `diseasev3` create reaches sanitized `live_accepted`, `business_rejected`, or blocked classification.
- Diagnostic fullflow produces sanitized L4 evidence or a concrete environment/blocker record.
- Rejected order-family v2 candidates are researched and queued with no-live verification tasks.

In every completion path:

- credentials printed/captured: `false`
- raw artifacts committed/packaged: `false`
- diagnostic artifacts, if captured, remain local-only/untracked and excluded from reviewer packets
- no production ORCA, S3/MinIO/object-storage, broad all-order claim, broad SOAP/disease claim, or final release readiness claim

## Final Report Requirements

Use `【ワーカー報告】` and include branch/HEAD, active prompt, current Work Order, next Work Order, files changed, commit id, tests/checks, live Trial endpoint/target/request class if used, diagnostic artifact handling if used, sanitized business-success classification, blockers, recommended next action, credentials captured, and raw artifacts committed/packaged.

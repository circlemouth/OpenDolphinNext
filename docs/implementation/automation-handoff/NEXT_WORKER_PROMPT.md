# NEXT_WORKER_PROMPT

status: completed
created_at: 2026-04-28T11:12:00Z
updated_at: 2026-04-28T11:50:55Z
source_work_order: RWO-06I/RWO-06H/RWO-06F/RWO-08B/RWO-11
blocker_id: remaining-automation-tasks-web-research-required
priority: high
supersedes:
- rwo06f-readonly-context-wrapper-gaps

## Context

The remaining automation queue previously had no immediately executable roadmap item because the uncompleted entries were safety-stopped, environment-skipped, human-pending, or external release-management gated.

Owner clarification on 2026-04-28: remaining tasks should be revised so that anything resolvable by web/official specification research is investigated comprehensively before concluding it needs owner/operator input or must remain safety-stopped.

`RWO-11/RWO-09` rollback rehearsal, release-candidate stop, paired restore, restored-target smoke, operator acceptance, and final owner GO/NO-GO/PENDING remain external owner/operator release-management gates. This prompt does not authorize those actions. For that item, only web/runbook/static research is allowed to identify whether any repo-local non-live automation-owned checks remain.

## Goal

Execute `REMAINING_TASKS_OFFICIAL_WEB_RESEARCH_NO_LIVE`.

Process the currently queued non-completed items in `HANDOFF_STATE.json.nextExecutableQueue`, using official ORCA web research and repo inspection before preserving a blocker:

- `RWO-06I_SURGERY_V3_ADJUNCT_MASTER_PROOF_PREFLIGHT`
- `RWO-06H_FRESH_LOCK_FREE_TARGET_PREFLIGHT`
- `RWO-06F_OWNER_BUSINESS_CONTEXT`
- `RWO-08B_L4_FULLFLOW_OFFICIAL_IDENTIFIER_PREFLIGHT`
- `RWO-11_ROLLBACK_OWNER_DECISION` as web/runbook/static research only, with release-management execution still external.

Do not run any live Trial mutation.

## Required First Steps

1. Inspect current branch, HEAD, status, and registered worktrees.
2. Read `$CODEX_HOME/automations/orca/memory.md`, `HANDOFF_STATE.json`, this prompt, and `AUTOMATION_THROUGHPUT_POLICY.md`.
3. Preserve production ORCA, S3/object-storage, raw artifacts, credentials, and `RWO-11/RWO-09` release-management execution as out of scope.
4. For each queued task, first check official ORCA sources and record checked URLs/dates before deciding the task is still blocked.

## Official Research Sources

Prefer official ORCA sources:

- `https://www.orca.med.or.jp/receipt/tec/api/overview.html`
- `https://www.orca.med.or.jp/receipt/users/tec/api/medicalmod.html`
- `https://www.orca.med.or.jp/receipt/users/tec/api/medicationgetv2.html`
- `https://www.orca.med.or.jp/receipt/users/tec/api/masterlastupdatev3.html`
- `https://www.orca.med.or.jp/receipt/users/tec/api/diseasegetv2.html`
- `https://www.orca.med.or.jp/receipt/users/tec/api/acceptancelst.html`
- endpoint pages discovered from the official overview.

Public/non-official sources may be used only as secondary leads and must be marked unconfirmed unless confirmed against official ORCA documentation.

## Task-Specific Research Questions

### RWO-06I Surgery

- Confirm official `medicalmodv2` class `500` surgery sample structure, including rows `150003110`, `641210099`, `840000042`, quantities, and row ordering.
- Determine whether `medicationgetv2 Request_Number=02` can prove the procedure/material/comment rows, or whether another official master lookup is required.
- Determine whether `masterlastupdatev3` is freshness-only or can support row-level validity claims.
- Produce the next safe no-live wrapper/test/evidence task if research can unblock row proof.

### RWO-06H Injection

- Determine whether official docs explain `medicalmodv2 Api_Result=90` in a way that identifies lock, stale target, or another retry-relevant target state.
- Determine whether `acceptlstv2`, `medicalgetv2`, or another official read-only endpoint can prove fresh or lock-free target readiness with sanitized fields only.
- If not, narrow the safety stop to the exact unavailable proof.

### RWO-06F Guidance Fee

- Determine which class `130` guidance-fee preconditions can be proven by official read-only APIs without raw disease/patient/insurance detail.
- Classify disease context, monthly duplicate context, department/physician/insurance-combination readiness, facility context, selectable-comment applicability, and master freshness as repo-local no-live, read-only Trial probe, owner/operator decision, or safety stop.
- Draft the shortest remaining owner/operator question only after official-spec and repo inspection are exhausted.

### RWO-08B Fullflow

- Determine whether existing `acceptlstv2` target inventory and server-derived identifier patterns can safely hydrate fullflow identifiers.
- Identify which official identifiers are needed before Charts handoff and ORCA order send.
- Separate identifiers that can be represented as sanitized presence flags or row hashes from identifiers that must never be serialized publicly.
- Define the smallest artifact-free no-live preflight, or preserve diagnostic/fullflow blocker if official specs cannot support one.

### RWO-11/RWO-09 External Gate

- Do not execute rollback, release-candidate stop, paired restore, restored-target smoke, operator acceptance, or final owner decision capture.
- Review repository runbooks and public/static guidance only to identify any remaining repo-local non-live checks automation can safely complete.
- If none exist, confirm the external release-management gate boundary and list the minimum owner/operator inputs needed for any future explicit reassignment.

## Allowed Actions

- Perform web research under the official-source policy.
- Edit `docs/implementation/automation-handoff/HANDOFF_STATE.json`.
- Add sanitized evidence under `docs/implementation/remaining-task-web-research-<RUN_ID>/`.
- Add or edit no-live wrapper/parser tests only if research identifies a safe repo-local next task and scope is narrow.
- Run focused no-live tests, JSON validation, web guard, doc links, and `git diff --check`.
- Commit roadmap/handoff-scoped source/doc/evidence changes before reporting.

## Forbidden Actions

- Any live Trial mutation.
- Production ORCA, production credentials, production patient data.
- S3/MinIO/object-storage setup, dummy object storage, object-storage readiness claims.
- Raw ORCA bodies, raw patient detail, raw disease detail, raw insurance detail, credentials, cookies, sessions, Authorization headers, CSRF values, HAR, traces, videos, screenshots, or raw network dumps in committed/package evidence.
- Changes under legacy `client/` or `server/`.
- Treating official-source research, HTTP 200, `Api_Result`, wrapper exit, dry-run pass, read-only preflight, code validity, or master freshness as business success.
- Selecting or executing `RWO-11/RWO-09` rollback/operator/final owner decision as automation release-management work.

## Evidence Requirements

Record sanitized Markdown/JSON only:

- checked URL and checked date;
- endpoint/request-class identity;
- relevant request number/class/code mapping;
- derived no-live/read-only next action or narrowed blocker;
- affected task id;
- parser/sanitizer or wrapper-test requirements if applicable;
- stop conditions;
- business-success separation;
- non-claims;
- `credentialsCaptured=false`;
- `diagnosticArtifactsCaptured=false`;
- `rawArtifactsCommittedOrPackaged=false`;
- `liveTrialOrca.executed=false`.

## Completion Criteria

This prompt is complete when sanitized evidence exists showing, for every queued remaining task, one of:

- official web research identified a safe repo-local no-live/read-only next task and queued it;
- focused repo-local no-live wrapper/test work completed;
- a narrower sanitized blocker explains why the task still cannot proceed;
- `RWO-11/RWO-09` is confirmed as external release-management work with no remaining repo-local non-live automation task.

Completion evidence: `docs/implementation/remaining-task-web-research-20260428T115055Z/summary.sanitized.json`.

## Same-Run Continuation Requirement

After recording evidence or a sanitized blocker for one task, continue to the next queued task unless a global stop condition is reached.

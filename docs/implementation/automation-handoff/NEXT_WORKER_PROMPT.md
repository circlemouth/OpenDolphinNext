# NEXT_WORKER_PROMPT

status: active
created_at: 2026-04-27T05:33:12Z
updated_at: 2026-04-27T05:50:15Z
source_work_order: RWO-06H
blocker_id: rwo06h-injectable-row-proof-needs-changed-candidate
priority: normal
supersedes:
- rwo11-rwo09-owner-authorized-automation-progression
- rwo11-rwo09-rollback-target-ambiguity-continue-independent-work

## Context

RUN_ID `20260427T053312Z` completed the owner-authorized `RWO-11/RWO-09` preparation step:

- rollback rehearsal checklist: `docs/implementation/rwo11-rwo09-rollback-rehearsal-plan-20260427T053312Z/rollback-rehearsal-checklist.sanitized.md`
- rollback summary: `docs/implementation/rwo11-rwo09-rollback-rehearsal-plan-20260427T053312Z/summary.sanitized.json`
- rollback report: `docs/implementation/rwo11-rwo09-rollback-rehearsal-plan-20260427T053312Z/FINAL_REPORT.md`

The actual rollback rehearsal remains stopped as `blocked_safety_stop_target_ambiguity`. Do not retry it unless new explicit input names a non-production rehearsal target, paired `web-client` / `server-modernized` restore commit or artifact, target-specific commands, restored-target smoke path, and operator/owner evidence. Do not infer final owner `GO` / `NO-GO` / `PENDING`.

The same run also completed current-head `RWO-09` non-S3 static/package/security refresh:

- static summary: `docs/implementation/rwo09-non-s3-static-refresh-20260427T053312Z/summary.sanitized.json`
- static report: `docs/implementation/rwo09-non-s3-static-refresh-20260427T053312Z/FINAL_REPORT.md`

No live Trial mutation, diagnostic artifact capture, production ORCA, S3/object-storage setup, rollback rehearsal execution, owner final decision, or final release readiness is claimed.

RUN_ID `20260427T055015Z` repaired the `medicationgetv2 Request_Number=02` read-only wrapper contract:

- evidence: `docs/implementation/rwo06h-medicationgetv2-contract-fix-20260427T055015Z/FINAL_REPORT.md`
- summary: `docs/implementation/rwo06h-medicationgetv2-contract-fix-20260427T055015Z/summary.sanitized.json`
- fix: append `class=01`, send `Base_Date` as `YYYY-MM-DD`, classify official `E##` / `W##` results separately, and require `success_zero` plus matching `Medication_Code` before `masterFound=true`
- repaired-wrapper control: official sample `114030710` returned `2xx/success_zero/row_found_with_selection_comments/masterFound=true`
- repaired-wrapper injection candidate check: `641210099` returned `2xx/official_error/official_error_no_row_proof/masterFound=false`

Prior RWO-06H `medicationgetv2` candidate checks that omitted `class=01` or used compact `Base_Date` are insufficient as final candidate rejection proof. Rerun any still-relevant source-backed injectable candidates with the repaired wrapper before using `masterFound=false` as a stop reason.

## Goal

Continue independent no-live endpoint precondition work. The next useful path is `RWO-06H` injectable row-proof discovery using the repaired `medicationgetv2` wrapper. Prefer rerunning still-relevant source-backed injectable candidates under the repaired wrapper before selecting or skipping RWO-06H. If no changed candidate/precondition exists after repaired-wrapper rerun, safely skip with evidence and continue to the next independent no-live queue item.

## Required First Steps

1. Inspect current branch, HEAD, status, and worktrees.
2. Read `$CODEX_HOME/automations/orca/memory.md`, `HANDOFF_STATE.json`, this prompt, and the latest RWO-06H evidence.
3. Confirm the prior rejected/invalid candidates are not reused unchanged as success evidence: `620000012`, `620076111`, `620007539`, `620006203`, `620004173`, `620002589`, `621958501`, `620006734`, `620767312`, `620738012`, `621429304`.
4. Also confirm that old `2xx/other_present/masterFound=false` results generated before RUN_ID `20260427T055015Z` are not treated as final candidate rejection proof unless rerun with the repaired wrapper.
5. If endpoint semantics or candidate validity are unclear, perform ORCA official-source research first and record sanitized no-live evidence.

## Allowed Actions

- Source-backed no-live candidate research for an injectable medication row.
- Sanitized read-only `medicationgetv2 Request_Number=02` row-proof checks when runtime is available and the wrapper/evidence mode is safe.
- Parser/sanitizer tests, wrapper dry-runs, duplicate checkpoint checks, and claim-boundary updates.
- Current-head static/package/security checks only if source/docs changed and focused verification is needed.

## Forbidden Actions

- Live Trial mutation without a complete endpoint packet and current sanitized preflight.
- Reusing prior rejected candidates unchanged as injectable acceptance evidence.
- Production ORCA, production readiness claims, S3/MinIO/object-storage setup, or storage readiness claims.
- Credentials, cookies, sessions, Authorization headers, CSRF values, credential-bearing URLs, raw ORCA bodies, raw patient/insurance detail, screenshots, HAR, traces, videos, raw network dumps, request XML, or raw request/response bodies in committed evidence or packages.
- Re-running `RWO-11/RWO-09` rollback execution while target/restore identity remains ambiguous.

## Evidence Requirements

- Sanitized Markdown/JSON only.
- Record candidate source, checked date, request number, sanitized result classification, claim boundary, and stop condition.
- `credentialsCaptured=false`.
- `rawArtifactsCommittedOrPackaged=false`.

## Completion Criteria

This prompt is complete when a changed RWO-06H candidate/precondition is proven or safely skipped with repaired-wrapper sanitized evidence, handoff state is updated, relevant checks pass, and roadmap-scoped changes are committed.

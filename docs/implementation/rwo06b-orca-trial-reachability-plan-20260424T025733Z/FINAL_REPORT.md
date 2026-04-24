# RWO-06B ORCA Trial Reachability Expansion Plan

RUN_ID: `20260424T025733Z`

## Verdict

`RWO06B_ORCA_TRIAL_REACHABILITY_EXPANSION_PLAN_ADDED`

The roadmap now includes tasks to verify currently unconfirmed WebORCA / ORCA Trial reachability for prescription, treatment/generic orders, SOAP, disease CRUD, Request_Number `02` / `03` / `04` when approved, and safe fullflow variants.

This was a planning/docs update only. No new ORCA Trial live execution was performed.

## Scope

- Branch at start: `master`
- Start HEAD: `d8eb74969`
- Active handoff prompt: `docs/implementation/automation-handoff/NEXT_WORKER_PROMPT.md` was already `completed`
- Current Work Order: `RWO-06B` planning
- Next Work Order: build the endpoint-level reachability inventory and checkpoint matrix, then run safe read-only or approved mutation checks in hourly resumable batches

## Files Changed

- `docs/implementation/clinical-functional-release-readiness-roadmap-20260422/ORCA_TRIAL_REACHABILITY_EXPANSION_PLAN.md`
- `docs/implementation/clinical-functional-release-readiness-roadmap-20260422/WORKPLAN_TO_RELEASE.md`
- `docs/implementation/clinical-functional-release-readiness-roadmap-20260422/REMAINING_WORK_BREAKDOWN.md`
- `docs/implementation/clinical-functional-release-readiness-roadmap-20260422/RELEASE_GATE_MATRIX.md`
- `docs/implementation/clinical-functional-release-readiness-roadmap-20260422/RELEASE_READINESS_EXECUTIVE_SUMMARY.md`
- `docs/implementation/clinical-functional-release-readiness-roadmap-20260422/FUNCTIONAL_CLAIMS_BOUNDARY.md`
- `docs/implementation/automation-handoff/HANDOFF_STATE.json`

## Plan Additions

- Added RWO-06B for reachability inventory and safe wrapper gap analysis.
- Added RWO-06C for batched read-only Trial reachability probes.
- Added RWO-06D for endpoint-specific approved Trial mutation reachability checks.
- Added RWO-08B for batched safe fullflow reachability variants.
- Added an hourly automation rule: each run must read previous checkpoints, skip already accepted live mutation identities, record endpoint-specific blockers, and continue to independent safe checks when time remains.
- Added a run-budget rule: one hourly run is not required to finish every queued check, but it must avoid starting work that cannot safely finish with sanitized evidence, scans, updates, and commit inside the run budget.

## Claim Boundary

Allowed claim: the roadmap now includes a safe, resumable plan to verify the currently unconfirmed ORCA Trial reachability paths.

Not claimed: prescription, treatment/generic orders, SOAP, disease CRUD, Request_Number `02` / `03` / `04`, or safe fullflow have been newly verified through ORCA Trial.

## Security Notes

- Credentials printed or captured: `false`
- Raw ORCA request/response bodies captured: `false`
- Raw patient/insurance detail captured: `false`
- HAR/trace/video/screenshot/raw network dump captured: `false`
- Production ORCA attempted: `false`
- S3/MinIO/object-storage configuration requested or used: `false`

## Recommended Next Action

Run RWO-06B inventory first. The inventory should produce an endpoint-level checklist with route, ORCA API, request class/number, wrapper, parser, success criteria, current evidence status, and next queued action for the hourly automation.

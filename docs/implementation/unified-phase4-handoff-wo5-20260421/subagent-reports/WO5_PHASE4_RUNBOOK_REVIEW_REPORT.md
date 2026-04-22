# WO-5 Phase 4 Runbook Review Report

RUN_ID: `20260421T235619Z`

## Scope

This report is advisory/reference only for the main agent. It reviews Phase 4 handoff requirements and wording boundaries. It does not authorize or execute Phase 4, fullflow, Phase 3 retry, live ORCA mutation, Request_Number 02/03/04, or candidates 00002-00011 mutation.

## Verdict

The Phase 4 handoff runbook must be written as a preparation and gate document only. It may describe what a future explicitly approved Phase 4 owner must verify, but it must not contain executable Phase 4, fullflow, or mutation commands as runnable steps.

Recommended gate wording:

- `may_prepare_phase4_prompt=yes` only if WO-5 docs are complete and accepted.
- `may_run_phase4=no` in WO-5.
- `phase4_status=not_run`, `fullflow_status=not_run`, `phase3_retry_rerun=no`, `new_live_orca_mutation=no`.

## Required Inputs

- Sanitized Phase 3 accepted evidence for candidate `00001` only.
- Sanitized C7 dynamic gate evidence showing accepted target mutation request count and request-number boundary.
- Acceptance ID / encounter key / schedule key only if already present in sanitized evidence; do not recover them from raw ORCA artifacts.
- Current WO-3 and WO-4 final reports showing static/local clinical gates passed and no live ORCA mutation was claimed.
- Current package metadata and source-scope scan status from the main agent, if used as a future Phase 4 prerequisite.
- Explicit owner approval for a future Phase 4 execution task. WO-5 itself is not that approval.

## Required Prechecks

- Confirm Phase 3 was not rerun after the approved single retry.
- Confirm Phase 4 remains `not_run`.
- Confirm fullflow remains `not_run`.
- Confirm candidates `00002` through `00011` remain mutation `not_run`.
- Confirm the future input artifact source commit/hash matches the cited summary and package metadata.
- Confirm any final package scan targets the final package hash, not an older sidecar or superseded ZIP.
- Confirm raw artifacts are absent: raw ORCA bodies, credentials, cookies, Authorization, JSESSIONID, CSRF values, HAR, traces, videos, screenshots, and raw network dumps.
- Confirm static checks are green or that any waiver is explicit, accepted, and not promoted into success evidence.
- Confirm the future Phase 4 command guard has been reviewed before any executable prompt is drafted.

## Forbidden Commands / Actions

The WO-5 runbook must not include these as executable steps:

- `qa-acceptmodv2-weborca.mjs`
- `qa-fullflow-weborca.mjs`
- any Phase 3 retry wrapper
- any Phase 4 wrapper or browser automation that submits live ORCA mutations
- any command using Request_Number `02`, `03`, or `04`
- any command targeting candidates `00002` through `00011`
- any replay of old mutation artifacts
- any raw HAR/trace/video/screenshot/network capture generation
- any package/final artifact ledger/final ZIP sidecar creation by this subagent report

If examples are necessary, they should be fenced as non-executable pseudocode and labeled `DO NOT RUN IN WO-5`.

## Future Evidence Expectations

A future explicitly approved Phase 4 task should be expected to produce only sanitized, artifact-relative evidence:

- sanitized JSON and Markdown summaries
- command log with runId, cwd, start/end, exit code, and explicit not-run statuses
- relevant gate outputs, including C5/C3/C6/C7 where applicable to the future approved task
- dynamic evidence secret scan
- final package source-scope scan against the final package hash
- package metadata validation and artifact hash ledger verification
- explicit separation of functional success evidence, dynamic scan evidence, package scan evidence, full-source scan claims, and worktree-clean claims

The future report must not treat HTTP 200, wrapper exit 0, `apiResult=60`, Request_Number `00`, local/MSW/static tests, or not-run/not-verified states as live ORCA mutation success.

## Stop Conditions

Stop and write a blocker report if any of the following is true:

- A command would rerun Phase 3, execute Phase 4, execute fullflow, or send a new live ORCA mutation.
- Candidate scope cannot be proven to remain `00001` only.
- Request_Number `02`, `03`, or `04` would be sent or used as success evidence.
- Raw sensitive material or raw browser/network artifacts are generated, detected, or needed to justify a claim.
- Source commit, artifact hash, package hash, or input identity cannot be matched.
- Final ZIP source-scope scan target hash differs from the final ZIP hash.
- Any residual static failure lacks an explicit accepted waiver.
- The runbook wording would allow an operator to infer Phase 4 is already approved.

## Wording Pitfalls To Avoid

- Do not write `Phase 4 ready` without a qualifier. Use `Phase 4 prompt may be prepared after review` if applicable.
- Do not write `may_run_phase4=yes` in WO-5.
- Do not write `accepted` for Phase 4; use `not_run`.
- Do not describe WO-3/WO-4 local/server/static coverage as live ORCA success.
- Do not say `final source clean` when only package source-scope scan exists.
- Do not say `worktree clean` without contemporaneous `git status --short` evidence.
- Do not say `no secrets in repo` when only dynamic evidence or package subset was scanned.
- Do not include absolute local evidence paths; use repo-relative or artifact-relative paths only.
- Do not include raw patient, insurance, credential, session, ORCA XML/JSON, or network details.

## Advisory Runbook Shape

Recommended sections for the main agent's canonical runbook:

1. Purpose and explicit non-authorization statement.
2. Required sanitized inputs.
3. Precheck matrix with pass/fail/blocked columns.
4. Forbidden actions and command guard.
5. Future evidence output contract.
6. Stop conditions and blocker classification.
7. Final recommendation field limited to prompt preparation, not execution.

## Boundary Confirmation

- This review did not execute Phase 3 retry.
- This review did not execute Phase 4.
- This review did not execute fullflow.
- This review did not run live ORCA mutation.
- This review did not mutate candidates `00002` through `00011`.
- This review did not create final package, final artifact ledger, or final ZIP sidecars.

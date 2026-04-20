# 【ワーカー報告】Subagent C docs report

RUN_ID: `20260420T000558Z`

## Scope

- Worktree: `C:\Users\marug\Documents\GitHub\opendolphin-subagent-docs-report`
- Branch: `codex/subagent-docs-report-20260420`
- Task: ORCA Trial Phase 2.5 reopen docs/report wording alignment with reviewed evidence and current route taxonomy.
- Not run: live ORCA, Phase 3, Phase 4, fullflow, mutation scripts.
- Legacy trees: `client/` and `server/` not edited.
- DADS/UI: not materially applicable.

## Files Changed

- `docs/contracts/orca-route-taxonomy.md`
- `docs/README.md`
- `docs/runbooks/release-validation.md`
- `docs/runbooks/reviewer-submission-packet.md`
- `docs/releases/orca-remediation-cutover.md`
- `docs/implementation/README.md`
- `docs/implementation/opendolphin-postfix-static-remediation-20260418/07_invariants_matrix.md`
- `docs/implementation/opendolphin-postfix-static-remediation-20260418/09_dynamic_orca_trial_report.md`
- `docs/implementation/orca-trial-phase2_5-gate-hardening-20260419T131740Z/README.md`
- `docs/implementation/orca-trial-phase2_5-gate-hardening-20260419T131740Z/FINAL_REPORT.md`
- `docs/implementation/orca-trial-phase2_5-gate-hardening-20260419T131740Z/subagent-prompts/*.md` targeted wording updates
- `docs/implementation/orca-trial-phase2_5-gate-hardening-20260419T131740Z/subagent-reports/*.md` targeted wording updates
- `docs/implementation/orca-trial-readonly-preflight-harness-20260419T220346Z/README.md`
- `docs/implementation/orca-trial-readonly-preflight-harness-20260419T220346Z/FINAL_REPORT.md`
- `docs/implementation/orca-trial-readonly-preflight-harness-20260419T220346Z/subagent-prompts/*.md` targeted wording updates
- `docs/implementation/orca-trial-readonly-preflight-harness-20260419T220346Z/subagent-reports/*.md` targeted wording updates
- `docs/implementation/orca-trial-readonly-preflight-harness-20260419T220346Z/dynamic-evidence/readonly-investigation-command-log.md`
- `docs/implementation/orca-trial-readonly-preflight-harness-20260419T220346Z/dynamic-evidence/readonly-investigation-summary.md`
- `docs/implementation/orca-trial-readonly-preflight-harness-20260420T000000Z/subagent-C-docs-report.md`

## Wording Decisions

- `acceptedCandidateCount=0` now means ORCA Trial official initial patients `00001`-`00011` exist as official initial data, but currently lack mutation-ready read-only evidence across harness / endpoint / auth / parser / insurance / appointment / selector / local selectable / exact preflight criteria.
- Candidate discovery is proposal-only and is not a Phase 3 handoff artifact.
- Exact selected-candidate preflight is required before Phase 3, and `acceptedForPhase3Attempt` must be boolean `true`.
- Exact selected-candidate preflight not run means Phase 3 not run and Phase 4 not run.
- HTTP 403 for insurance or appointment is `ambiguous_readiness_failure`, not insurance missing / appointment missing.
- `apiResult=10` is `patient_not_found` rejection.
- `apiResult=60` is no-existing-acceptance diagnostic, not mutation success.
- `apiResult=00` with `Request_Number=00` is existing-acceptance diagnostic, not mutation success.
- C7 dynamic evidence is not verified unless target mutation request capture exists. `targetMutationRequestCount=0` / `checkedRequests=0` must not be accepted.
- MSW/local/static tests are not live ORCA fullflow success and must not be mixed with live evidence claims.
- `full_source_secret_scan_claim=not_claimed` is not full clean. `worktree_clean=not_verified` is not clean checkout truth.
- Public ORCA routes are official/master only. mock/test/detector/docs references are not public routes, and `runtime-ready-smoke` blocked route detector is a detector, not a success route.
- Route taxonomy category examples are representative only; docs no longer imply legacy route strings remain narrowly only in `orcaQueueApi.ts` and `orcaQueue.ts`.

## Not-Verified Claims

- No live ORCA success was claimed or newly verified.
- Phase 3, Phase 4, fullflow, and mutation request capture were not run.
- Full source secret scan was not claimed.
- Clean checkout truth was not claimed from support packages.
- UI changes were not included; DADS/UI is not materially applicable.

## Verification

- Static docs grep was used to inspect required wording and remaining risk terms.
- `git diff --check` passed after edits.
- UTF-8 BOM check passed for changed and untracked docs.
- No code, dependency, or runtime behavior changed; full web/server build was not run for this docs-only task.

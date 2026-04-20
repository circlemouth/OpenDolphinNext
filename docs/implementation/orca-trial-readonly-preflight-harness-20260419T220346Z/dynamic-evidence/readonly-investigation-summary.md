# Read-only investigation summary

- runId: 20260419T220346Z
- cwd: /Users/Hayato/Documents/GitHub/OpenDolphin_WebClient.worktrees/orca-readonly-investigation-20260419T220346Z/web-client
- branch: codex/orca-readonly-investigation-20260419T220346Z
- command_start: 2026-04-19T22:26:15.029Z
- command_end: 2026-04-19T22:28:19.104Z
- command_exit_code: 1
- acceptedCount: 0
- candidateDiscoveryAloneAuthorizesPhase3: false
- mutationPolicy.prohibited: true
- mutationPolicy.blockedRequestCount: 0
- releaseVerdict: PARTIAL / TEST-DATA OR HARNESS READINESS BLOCKER
- blockerClassification: test-data-or-harness-readiness-blocker
- blockerReason: phase3_mutation_ready_readonly_evidence_missing
- exactPreflightRan: false
- phase3Ran: false
- phase4Ran: false
- mutationRan: false
- rawSensitiveFieldsExcluded: true

## Interpretation
- ORCA Trial official initial patients `00001`-`00011` exist as official initial data, but are not mutation-ready in current evidence.
- `acceptedCandidateCount=0` means `00001`-`00011` currently lack mutation-ready read-only evidence across harness / endpoint / auth / parser / insurance / appointment / selector / local selectable / exact preflight criteria.
- Candidate discovery is proposal-only. Exact selected-candidate preflight was not run, so Phase 3 and Phase 4 were not run.
- HTTP 403 for insurance or appointment is `ambiguous_readiness_failure`, not insurance missing / appointment missing.
- `apiResult=10` is `patient_not_found` rejection. `apiResult=60` is no-existing-acceptance diagnostic. `apiResult=00` with `Request_Number=00` is existing-acceptance diagnostic. None of these diagnostic states is mutation success.
- C7 dynamic evidence is not verified unless target mutation request capture exists. `targetMutationRequestCount=0` / `checkedRequests=0` must not be accepted.

## Candidate failure dimensions
- 00001: rejection=ambiguous_readiness_failure; official=accepted/200/00/present; insurance=rejected/403/blank/ambiguous_readiness_failure; appointment=rejected/direct_acceptance/not_required/403/blank/ambiguous_readiness_failure; local=accepted/none; selectors=rejected; diagnostic=accepted; blockedRequests=0
- 00002: rejection=ambiguous_readiness_failure; official=accepted/200/00/present; insurance=rejected/403/blank/ambiguous_readiness_failure; appointment=rejected/direct_acceptance/not_required/403/blank/ambiguous_readiness_failure; local=rejected/local_exact_match_missing; selectors=not_verified; diagnostic=accepted; blockedRequests=0
- 00003: rejection=ambiguous_readiness_failure; official=accepted/200/00/present; insurance=rejected/403/blank/ambiguous_readiness_failure; appointment=rejected/direct_acceptance/not_required/403/blank/ambiguous_readiness_failure; local=rejected/local_exact_match_missing; selectors=not_verified; diagnostic=accepted; blockedRequests=0
- 00004: rejection=ambiguous_readiness_failure; official=accepted/200/00/present; insurance=rejected/403/blank/ambiguous_readiness_failure; appointment=rejected/direct_acceptance/not_required/403/blank/ambiguous_readiness_failure; local=rejected/local_exact_match_missing; selectors=not_verified; diagnostic=accepted; blockedRequests=0
- 00005: rejection=ambiguous_readiness_failure; official=accepted/200/00/present; insurance=rejected/403/blank/ambiguous_readiness_failure; appointment=rejected/direct_acceptance/not_required/403/blank/ambiguous_readiness_failure; local=accepted/none; selectors=rejected; diagnostic=accepted; blockedRequests=0
- 00006: rejection=ambiguous_readiness_failure; official=accepted/200/00/present; insurance=rejected/403/blank/ambiguous_readiness_failure; appointment=rejected/direct_acceptance/not_required/403/blank/ambiguous_readiness_failure; local=rejected/local_exact_match_missing; selectors=not_verified; diagnostic=accepted; blockedRequests=0
- 00007: rejection=ambiguous_readiness_failure; official=accepted/200/00/present; insurance=rejected/403/blank/ambiguous_readiness_failure; appointment=rejected/direct_acceptance/not_required/403/blank/ambiguous_readiness_failure; local=rejected/local_exact_match_missing; selectors=not_verified; diagnostic=accepted; blockedRequests=0
- 00008: rejection=ambiguous_readiness_failure; official=accepted/200/00/present; insurance=rejected/403/blank/ambiguous_readiness_failure; appointment=rejected/direct_acceptance/not_required/403/blank/ambiguous_readiness_failure; local=rejected/local_exact_match_missing; selectors=not_verified; diagnostic=accepted; blockedRequests=0
- 00009: rejection=ambiguous_readiness_failure; official=accepted/200/00/present; insurance=rejected/403/blank/ambiguous_readiness_failure; appointment=rejected/direct_acceptance/not_required/403/blank/ambiguous_readiness_failure; local=rejected/local_exact_match_missing; selectors=not_verified; diagnostic=accepted; blockedRequests=0
- 00010: rejection=ambiguous_readiness_failure; official=accepted/200/00/present; insurance=rejected/403/blank/ambiguous_readiness_failure; appointment=rejected/direct_acceptance/not_required/403/blank/ambiguous_readiness_failure; local=rejected/local_exact_match_missing; selectors=not_verified; diagnostic=accepted; blockedRequests=0
- 00011: rejection=ambiguous_readiness_failure; official=accepted/200/00/present; insurance=rejected/403/blank/ambiguous_readiness_failure; appointment=rejected/direct_acceptance/not_required/403/blank/ambiguous_readiness_failure; local=rejected/local_exact_match_missing; selectors=not_verified; diagnostic=accepted; blockedRequests=0

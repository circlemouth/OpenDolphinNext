# Phase 3 command/sanitize fix summary

## Verdict
`ACCEPT COMMAND/SANITIZE FIX PACKAGE / READY FOR PHASE 3 RETRY REVIEW`

This is not a Phase 3 execution. ORCA live mutation, Phase 4, and fullflow were not run.

## Root cause confirmed
The old Phase 3 acceptmodv2 path relied on `qa-acceptmodv2-weborca.mjs` directly. That harness created `screenshots/` and `network/` directories by design, wrote screenshots around the accept action, and wrote sanitized network JSON files under a network evidence directory. HAR was optional but possible through `QA_RECORD_HAR=1`.

Because the previous auditor timed out before confirming a guard-compatible command, there was no approved command satisfying the no raw/browser/network artifact contract.

## Remediation
- Added `qa-phase3-approved-acceptmodv2.mjs` as the approved repository command wrapper.
- Added `phase3-approved-command-guard.mjs` with exact candidate/preflight/hash/input identity/artifact-mode checks.
- Added approved mode to `qa-acceptmodv2-weborca.mjs`:
  - no screenshots
  - no HAR
  - no raw summary
  - no network directory
  - no console/page-error artifact files
  - sanitized summary only
- Extended preflight validation to pin input identity hash and fail if `targetMutationRequestCount` is not `0`.
- Extended acceptmodv2 business evidence so Request_Number `02/03/04` cannot be classified as Phase 3 mutation success.

## Security posture
- Client-provided candidate, path, hash, artifact mode, and execution phase are not trusted.
- The wrapper recomputes the preflight artifact hash from disk.
- The wrapper rejects old mutation-route artifacts, raw/browser/network capture flags, Phase 4/fullflow flags, and non-`00001` candidates before mutation.
- Request_Number `01` is the only intended future Phase 3 mutation. Request_Number `00` is inquiry only; `02/03/04` are forbidden in this Phase 3 scope.
- HTTP 200, `apiResult=60`, `acceptedForPhase3Attempt=true`, and diagnostic `not_run` are not mutation success.

## Status
- mutation: `not_run`
- Phase 3 actual execution: `not_run`
- Phase 4: `not_run`
- fullflow: `not_run`
- candidate: `00001` only


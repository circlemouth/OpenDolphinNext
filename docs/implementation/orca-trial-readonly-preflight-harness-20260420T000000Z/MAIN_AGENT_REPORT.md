# Main Agent Report

RUN_ID: `20260420T000000Z`

## Branches And Subagents

- Integration branch: `codex/orca-phase2_5-reopen-main-20260420`
- Subagent A: `codex/subagent-phase3-handoff-20260420`, worktree `../opendolphin-subagent-phase3-handoff`, commit `cceabed6b`
- Subagent B: `codex/subagent-evidence-package-20260420`, worktree `../opendolphin-subagent-evidence-package`, commit `505f8b7b`
- Subagent C: `codex/subagent-docs-report-20260420`, worktree `../opendolphin-subagent-docs-report`, commit `8338abc8`
- Subagent D: `codex/subagent-readonly-probe-20260420`, worktree `../opendolphin-subagent-readonly-probe`, commit `526d761c`

## Integration

Merged in required order:

1. A: Phase 3 preflight handoff gate and focused tests.
2. B: final ZIP package evidence generation and validation.
3. C: docs/report claim alignment and route taxonomy wording.
4. D: sanitized read-only probe preparation evidence and stop report.

## Threat / Misuse Cases Checked

- Discovery-only summary forged with `acceptedForPhase3Attempt=true` cannot authorize Phase 3.
- Current exact preflight artifact with stale/missing artifact path, hash, runId, candidateId, input identity, sanitized evidence, or strict boolean `acceptedForPhase3Attempt` fails closed.
- `HTTP 200`, wrapper success, message-only success, `apiResult=60`, and `Request_Number=00` diagnostics cannot be promoted to mutation success.
- Insurance/appointment `HTTP 403` remains ambiguous readiness failure.
- Raw or generated review package paths, HAR/traces/videos/screenshots/network dumps, `.git`, legacy source, and generated build directories are rejected.
- Full source secret scan and clean checkout truth are not claimed without explicit evidence.

## Validation Logs

Accepted command logs are in `test-logs/`:

- `bash-syntax.log`
- `node-check.log`
- `web-guard.log`
- `focused-vitest-native.log`
- `typecheck.log`
- `build.log`
- `lint.log`
- `web-client-ci.log`
- `review-package-tests.log`
- `dynamic-evidence-secret-scan.log`

All accepted logs include command, cwd, runId, start, end, exit code, and non-empty output.

## Read-only Status

- Dynamic live read-only discovery: not run in the 20260420 probe because authenticated context bootstrap was blocked locally.
- acceptedCandidateCount: `0 / 11` remains from the reviewed 20260419 evidence.
- exact selected-candidate preflight: not run.
- Phase 3: not run.
- Phase 4: not run.

## Package Notes

Final package hash, size, and file count are recorded in the `.summary.txt` sidecar after ZIP creation. Package source-scope scan evidence is external by design because embedding the post-creation scan log would change the ZIP hash.

## Next Owner

ORCA read-only harness owner / Codex: repair local authentication/bootstrap blockers, rerun safe read-only candidate discovery, and only then run exact selected-candidate preflight if `acceptedCandidateCount > 0`.

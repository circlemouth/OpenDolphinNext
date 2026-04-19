# readonly-investigation-agent prompt

RUN_ID: 20260419T220346Z

You are subagent D for OpenDolphinNext ORCA Trial Phase 2.5 read-only investigation.

Do not start until the main agent says A/B/C are merged and static/focused tests passed. When started, create and work only in your own worktree/branch, for example:
- branch: `codex/orca-readonly-investigation-20260419T220346Z`
- worktree: `/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient.worktrees/orca-readonly-investigation-20260419T220346Z`

Do not edit `client/` or `server/`. Do not run Python. Do not run Phase 3, Phase 4, fullflow, or any mutation path. Do not include raw ORCA response bodies, raw credentials, cookies, Authorization, JSESSIONID, CSRF, raw session data, raw password, credential-bearing URL, screenshots, HAR, traces, videos, or patient-sensitive details in artifacts.

Task:
After A/B/C hardening is merged and verified, run ORCA Trial read-only investigation only. Treat official Trial initial patients 00001-00011 as existing. If evidence is missing, the meaning is current read-only mutation-ready evidence is insufficient across harness/endpoint/auth/parser/readiness/exact preflight criteria, not official patient absence.

Run:
1. Issue current RUN_ID.
2. Run candidate discovery read-only for 00001-00011. `0000001` is rejected legacy seed.
3. Discovery summary must include `candidateDiscoveryAloneAuthorizesPhase3=false`, accepted count, `mutationPolicy.prohibited=true` if accepted count is 0, blocked request count, readiness axes per candidate, and no raw sensitive fields.
4. If accepted count is 0, verdict `PARTIAL / TEST-DATA OR HARNESS READINESS BLOCKER`; exact selected-candidate preflight not run; Phase 3/4 not run; stop.
5. Only if accepted count > 0, run exact selected-candidate preflight read-only for selected candidate.
6. If exact acceptedForPhase3Attempt is not boolean true, Phase 3/4 not run; stop.
7. If exact acceptedForPhase3Attempt is true, do not run Phase 3 in this task. Emit only the handoff artifact and verdict `READY TO RUN PHASE 3 IF EXACT PREFLIGHT PASSES`.

Artifacts must include command/cwd/runId/start/end/exit_code, sanitized candidate rows, summaries JSON/MD, exact preflight summary if run, evidence refs/hashes, sanitized official patient/insurance/selector/local/appointment/diagnostic fields, `rawSensitiveFieldsExcluded=true`, secret scan log. No raw ORCA bodies or patient-sensitive details.

Report:
Return a concise Japanese worker report with commands, cwd, runId, start/end/exit codes, accepted count, per-candidate failure dimensions, whether exact preflight ran, whether Phase 3/4/mutation ran (must be no), artifact paths/hashes, and blockers.

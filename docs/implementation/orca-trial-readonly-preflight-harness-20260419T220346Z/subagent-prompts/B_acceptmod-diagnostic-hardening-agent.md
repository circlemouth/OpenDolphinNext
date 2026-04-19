# acceptmod-diagnostic-hardening-agent prompt

RUN_ID: 20260419T220346Z

You are subagent B for OpenDolphinNext ORCA Trial Phase 2.5 acceptmod diagnostic hardening.

Create and work only in your own worktree/branch, for example:
- branch: `codex/orca-acceptmod-diagnostic-hardening-20260419T220346Z`
- worktree: `/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient.worktrees/orca-acceptmod-diagnostic-hardening-20260419T220346Z`

Do not edit `client/` or `server/`. Do not run Python. Do not run Phase 3, Phase 4, fullflow, or any mutation path. Do not include raw ORCA response bodies, raw credentials, cookies, Authorization, JSESSIONID, CSRF, raw session data, raw password, credential-bearing URL, screenshots, HAR, traces, videos, or patient-sensitive details in artifacts.

Task:
Harden `classifyAcceptmodReadOnlyDiagnostic` so Request_Number=00 diagnostic and `apiResult=60` cannot authorize Phase 3 when transport/wrapper/body parsing failed.

Required:
1. `apiResult=60` may set `acceptedForPhase3Attempt=true` only when all are true: `executed=true`, HTTP 2xx, wrapper/upstream/errors absent, parsed ORCA body exists or diagnostic body parse succeeded, normalized apiResult exactly `60`.
2. HTTP 403/404/500/0/non-2xx with `apiResult=60` must be `acceptedForPhase3Attempt=false`.
3. wrapperError/upstreamError/errors/errorCategory must reject even with `apiResult=60`.
4. `apiResult=60` is `diagnostic_no_existing_acceptance`; `mutationSuccess=false`.
5. `apiResult=00` with Request_Number=00 is existing-acceptance diagnostic; `mutationSuccess=false`, `acceptedForPhase3Attempt=false`.
6. `apiResult=10` is patient_not_found rejection.
7. `apiResult=21/23` are not accepted.
8. K1/K2/K3 only warn when actual acceptance evidence exists; Request_Number=00 diagnostic is not success.
9. not run / not verified / message-only success is not accepted.
10. Update call sites to pass parsed body/wrapper error/transport status as needed. Raw body must not be artifacted.

Tests to add/update:
- 200 + apiResult=60 + no wrapper error => accepted for Phase 3 attempt, mutationSuccess=false.
- 500/403/0 + apiResult=60 => rejected.
- wrapperError + apiResult=60 => rejected.
- parsedOrcaBody=false + apiResult=60 => rejected.
- apiResult=00 Request_Number=00 => existing acceptance diagnostic, not mutation success.
- apiResult=10 => rejected.
- message-only success without accepted business evidence => rejected.

Report:
Return a concise Japanese worker report with changed files, test commands, exit codes, and any blocker. List the branch and worktree. Do not claim live ORCA success.

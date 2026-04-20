# Command log

- runId: 20260419T220346Z
- cwd: /Users/Hayato/Documents/GitHub/OpenDolphin_WebClient.worktrees/orca-readonly-investigation-20260419T220346Z/web-client
- command: RUN_ID=20260419T220346Z QA_BASE_URL=https://localhost:5173 QA_WEBORCA_CANDIDATES=00001,00002,00003,00004,00005,00006,00007,00008,00009,00010,00011 node scripts/qa-weborca-candidate-discovery.mjs
- start: 2026-04-19T22:26:15.029Z
- end: 2026-04-19T22:28:19.104Z
- exit_code: 1
- stdout: /Users/Hayato/Documents/GitHub/OpenDolphin_WebClient.worktrees/orca-readonly-investigation-20260419T220346Z/artifacts/orca-remediation/closeout/20260419T220346Z/reports/candidate-discovery.stdout.log
- stderr: /Users/Hayato/Documents/GitHub/OpenDolphin_WebClient.worktrees/orca-readonly-investigation-20260419T220346Z/artifacts/orca-remediation/closeout/20260419T220346Z/reports/candidate-discovery.stderr.log

Exact selected-candidate preflight was not run because `acceptedCandidateCount=0`.
`acceptedCandidateCount=0` means ORCA Trial official initial patients `00001`-`00011` exist as official initial data but currently lack mutation-ready read-only evidence across harness / endpoint / auth / parser / insurance / appointment / selector / local selectable / exact preflight criteria.
Phase 3, Phase 4, fullflow, and mutation scripts were not run.
Candidate discovery is proposal-only and is not a Phase 3 handoff artifact.

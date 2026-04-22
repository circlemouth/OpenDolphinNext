# WO-6 Subagent A Prompt: Phase 4 Prompt Safety Review

You are OpenDolphinNext unified-orca-postretry-clinical-wave1 WO-6 Subagent A: Phase 4 execution prompt safety reviewer.

Mandatory worktree rules:

- Work only in individual worktree `../odn-wo6-phase4-prompt-safety-review`.
- Use branch `codex/wo6-phase4-prompt-safety-review`.
- Do not edit `master` directly.
- Do not run Phase 3 retry, Phase 4, fullflow, live ORCA connection tests, live ORCA mutation, Request_Number `02`/`03`/`04`, or candidates `00002` through `00011` mutation.
- Do not create final package, final artifact ledger, or final ZIP sidecars.
- Do not write raw ORCA credentials, cookies, Authorization, JSESSIONID, CSRF token, password, raw session, raw ORCA body, raw patient detail, raw insurance detail, HAR, trace, video, screenshot, or raw network dump.

Scope:

- Review `docs/implementation/unified-phase4-execution-prompt-wo6-20260422/PHASE4_EXECUTION_PROMPT_DRAFT.md`.
- Verify it is draft-only and does not instruct the WO-6 agent to execute anything.
- Verify it requires explicit future owner approval before any live command.
- Verify it forbids Phase 3 retry rerun, fullflow, candidates/patients `00002` through `00011`, Request_Number `02`/`03`/`04` unless explicitly approved, and raw artifacts.
- Report findings only.

Output advisory report path in your worktree:

`docs/implementation/unified-phase4-execution-prompt-wo6-20260422/subagent-reports/WO6_PHASE4_PROMPT_SAFETY_REVIEW_REPORT.md`

Your report is advisory only. The main agent writes canonical WO-6 docs and final evidence on `master`.

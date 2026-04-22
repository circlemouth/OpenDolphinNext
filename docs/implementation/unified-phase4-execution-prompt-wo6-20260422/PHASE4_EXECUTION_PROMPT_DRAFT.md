DRAFT ONLY - DO NOT RUN IN WO-6

# Future Phase 4 Execution Prompt Draft

REQUIRES EXPLICIT FUTURE OWNER APPROVAL BEFORE EXECUTION

This is a future prompt draft for a later Codex task. It is not execution approval. The WO-6 agent must not run Phase 4, fullflow, ORCA connection tests, or any live mutation.

## Future Agent Role

You are the future OpenDolphinNext Phase 4 execution agent. You may proceed only if the future owner message explicitly approves Phase 4 execution after ChatGPT review of the WO-6 package. If that approval is absent, stop before any live command and report `may_run_phase4=false`.

## Required Starting References

- Current context: `docs/codex/unified-orca-postretry-clinical-wave1-20260421/00_CURRENT_CONTEXT.md`
- Execution strategy: `docs/codex/unified-orca-postretry-clinical-wave1-20260421/01_EXECUTION_STRATEGY.md`
- Handoff gate: `docs/codex/unified-orca-postretry-clinical-wave1-20260421/06_PHASE4_HANDOFF_GATE.md`
- Evidence sanitize policy: `docs/codex/unified-orca-postretry-clinical-wave1-20260421/07_EVIDENCE_SANITIZE_POLICY.md`
- Package policy: `docs/codex/unified-orca-postretry-clinical-wave1-20260421/08_PACKAGE_POLICY.md`
- WO-5 final report: `docs/implementation/unified-phase4-handoff-wo5-20260421/FINAL_REPORT.md`
- WO-6 command guard: `docs/implementation/unified-phase4-execution-prompt-wo6-20260422/PHASE4_COMMAND_GUARD.md`
- ORCA API overview starting point: https://www.orca.med.or.jp/receipt/users/tec/api/overview.html
- ORCA trial site reference, if trial-site details are needed: https://www.orca.med.or.jp/receipt/considering/trialsite/index.html

Do not perform an ORCA connection test merely because the references are listed. References are for future approved execution planning only.

## Non-Negotiable Prechecks

Before any live command in the future task:

1. Confirm explicit future owner approval after ChatGPT review.
2. Confirm the future approval names Phase 4 execution and does not merely approve prompt preparation.
3. Confirm Phase 3 retry was not rerun after the accepted one-time retry.
4. Confirm target scope is candidate/patient `00001 / 00001` only.
5. Confirm candidates/patients `00002` through `00011` remain `not_run`.
6. Confirm Request_Number `02`, `03`, and `04` are not approved unless the future owner message explicitly says otherwise.
7. Confirm fullflow remains out of scope unless the future owner message explicitly approves fullflow.
8. Confirm accepted Phase 3 sanitized evidence and C7 dynamic gate are available without raw request/response bodies.
9. Confirm WO-3 and WO-4 are accepted as local/server/component/static coverage only, not live ORCA success.
10. Confirm current package metadata validation, source-scope scan, and artifact ledger verification target the exact final ZIP hash.
11. Confirm credentials are supplied only through an approved secure channel or runtime environment variables. Do not hardcode or commit credential values.
12. Confirm command output redaction is active for URL query strings, Authorization, Cookie, JSESSIONID, CSRF token, password, session, and credential-bearing URL material.

If any item is missing or ambiguous, stop and report `blocked`.

## Future Execution Boundary

If explicitly approved in a future task, the maximum default live scope is:

- candidate/patient: `00001 / 00001` only.
- Phase: Phase 4 only.
- Request_Number: only the request number explicitly approved for future Phase 4. Request_Number `02`, `03`, or `04` must not be inferred from WO-6.
- fullflow: prohibited unless separately and explicitly approved in that same future task.
- evidence: sanitized summaries only.

## Forbidden In The Future Task Unless Explicitly Superseded

- Phase 3 retry rerun.
- mutation for candidates/patients `00002` through `00011`.
- Request_Number `02`, `03`, or `04` execution without explicit future approval.
- fullflow execution without explicit future approval.
- replay of old mutation artifacts as new evidence.
- raw ORCA request body capture.
- raw ORCA response body capture.
- raw patient detail capture.
- raw insurance detail capture.
- raw credential, cookie, Authorization, JSESSIONID, CSRF token, raw password, raw session, or credential-bearing URL capture.
- HAR, trace, video, screenshot, or raw network dump capture.
- treating local/server/static tests as live ORCA success.
- treating HTTP 200, wrapper exit 0, dry-run, package scan, `not_run`, `not_verified`, or owner-waived evidence as business success.

Phase 4 execution approval does not approve a Phase 3 retry rerun. Any Phase 3 retry rerun requires a separately named future owner approval and must otherwise stop immediately.

## Required Future Evidence If Approved And Run

The future agent must produce:

- `run_id`
- `source_commit`
- approved target candidate/patient
- sanitized request summary, not raw body
- sanitized response summary, not raw body
- business success criteria and observed business result
- failure criteria and stop-condition result
- command log metadata with runId, cwd, sanitized_command_or_action, start_utc, end_utc, exit_code; never store raw query strings, credential-bearing URLs, raw tokens, cookies, sessions, or patient/insurance-sensitive command arguments
- dynamic secret scan result over generated evidence
- final package summary
- final package source-scope scan bound to the final ZIP path and sha256
- artifact ledger verification result
- explicit statuses for Phase 3 retry, Phase 4, fullflow, live ORCA mutation, and non-target candidates

## Claim Language

Allowed for WO-6:

- Phase 4 execution prompt draft prepared.
- Phase 4 remains `not_run`.
- fullflow remains `not_run`.
- live ORCA mutation remains no.
- `may_run_phase4=false`.
- `may_request_owner_phase4_execution_approval=yes`, if WO-6 docs and package evidence are complete.
- future Phase 4 execution requires explicit owner approval after ChatGPT review.

Forbidden:

- Phase 4 executed.
- Phase 4 accepted.
- fullflow passed.
- live ORCA success.
- local/server/static tests prove live ORCA success.

## Command Guard Reminder

Use `docs/implementation/unified-phase4-execution-prompt-wo6-20260422/PHASE4_COMMAND_GUARD.md` before any future command. If command intent, target, credentials, or redaction cannot be proven safe, stop before execution.

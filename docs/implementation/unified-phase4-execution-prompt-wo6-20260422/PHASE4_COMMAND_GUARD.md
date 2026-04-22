# Phase 4 Command Guard

This guard is for a future approved Phase 4 task. It does not authorize WO-6 or any current agent to execute Phase 4.

## Default Stance

- `may_run_phase4=false` in WO-6.
- No live command may run until explicit future owner approval after ChatGPT review.
- Fail closed on ambiguous command intent, ambiguous target, missing approval, missing redaction, stale package hash, or credential handling uncertainty.

## Required Credential Approach

Future credentials must be supplied only through approved secure channel or runtime environment variables. Acceptable examples:

- `ORCA_API_USER` set in the local runtime environment.
- `ORCA_API_PASSWORD` set in the local runtime environment.
- approved local secret file outside committed package evidence, with logs recording only set/unset classification.

Forbidden:

- raw credential values in committed files.
- raw credential values in prompts.
- raw credential values in command arguments that may be logged.
- Basic auth values, cookies, JSESSIONID, CSRF token values, or credential-bearing URLs in logs, sidecars, package files, screenshots, traces, videos, HAR, or raw network dumps.

## Required Redaction

Future command logging must redact or omit:

- URL query strings when they may contain credentials or patient-sensitive data.
- `Authorization`.
- `Cookie`.
- `Set-Cookie`.
- `JSESSIONID`.
- `CSRF` and `X-CSRF-Token`.
- `password`, `passwd`, `rawPassword`.
- raw session IDs and tokens.
- credential-bearing URLs.
- raw ORCA request/response bodies.
- raw patient and insurance details.

Only sanitized labels such as `<redacted>`, set/unset classification, status codes, business categories, non-sensitive IDs approved for the gate, hashes, file counts, and command metadata may be recorded.

## Future Command Allowlist

The future approved run may use only command categories that match the explicit owner approval:

| category | allowed only if |
|---|---|
| git metadata commands | read-only and needed to prove source commit/status |
| static package validation | validates current evidence/package, no live ORCA |
| command-log wrapper | records metadata and sanitized output |
| environment classification | prints only set/unset/sanitized classification |
| approved Phase 4 wrapper | future owner approval names the exact wrapper/action and target |
| dynamic evidence scan | scans generated sanitized evidence only |
| final package creation | excludes forbidden raw/generated artifacts |
| final metadata validation | targets exact final ZIP hash |
| final artifact ledger verification | targets exact current sidecar directory |

The allowlist does not permit command execution by itself. Future owner approval is still required.

## Command Denylist

Do not run commands that match these intents or patterns in WO-6 or any future task without explicit superseding approval:

- Phase 3 retry rerun.
- `phase3` mutation wrapper execution.
- Phase 4 execution in WO-6.
- fullflow execution.
- mutation for candidate/patient IDs `00002` through `00011`.
- Request_Number `02`, `03`, or `04` execution unless explicitly approved in the future task.
- direct ORCA connection tests in WO-6.
- raw request/response dump tooling.
- HAR capture.
- browser trace capture.
- video or screenshot capture for live ORCA evidence.
- raw network dump capture.
- commands that echo environment variable values containing credentials, cookies, sessions, tokens, or passwords.
- commands that pass credentials in URL userinfo or query strings.

Examples of command text that must trigger review/stop:

```text
fullflow
phase3
Request_Number=02
Request_Number=03
Request_Number=04
candidateId=00002
patientId=00002
candidateId=00011
patientId=00011
--trace
--video
--screenshot
--har
dump-request
dump-response
raw-network
```

## Stop-On-Drift Rules

Stop before execution if:

- command target differs from the approved candidate/patient.
- command path differs from the approved wrapper/action.
- command output cannot be redacted safely.
- a command would create raw ORCA bodies, raw patient/insurance details, HAR, trace, video, screenshot, or raw network dump.
- final ZIP path/hash differs from metadata validation target.
- final sidecar ledger references stale or missing files.
- old mutation artifacts are proposed as new evidence.
- HTTP 200, wrapper exit 0, dry-run, local/server/static tests, package validation, metadata validation, source-scope scan, `not_run`, `not_verified`, or owner-waived evidence is about to be claimed as live ORCA business success.

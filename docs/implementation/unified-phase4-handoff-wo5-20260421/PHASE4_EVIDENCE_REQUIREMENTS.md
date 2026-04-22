# Phase 4 Evidence Requirements

## Evidence Classes Must Stay Separate

| evidence class | what it can prove | what it cannot prove |
|---|---|---|
| dynamic review evidence scan | generated evidence has no matched raw secret/sensitive patterns | source tree is clean, package is valid, or ORCA business action succeeded |
| package source-scope scan | final review ZIP text scope has no matched raw secret/sensitive patterns and excludes forbidden paths | full source clean, live ORCA success, or worktree clean |
| full source scan | full repository scan status if explicitly run and logged | package hash validity or ORCA success |
| worktree clean | git status at a point in time | package content validity or live ORCA success |
| package metadata validation | ZIP summary/hash/count/ledger/scan metadata consistency | business success |
| functional/business success evidence | endpoint-specific, sanitized business evidence | secret-scan pass, package pass, HTTP 200, or wrapper exit 0 alone |

## Required Statements

- package source scan passed != full source clean.
- HTTP 200 != business success.
- wrapper exit 0 != business success.
- dry-run/precheck != mutation success.
- local/server/component/static tests != live ORCA success.
- dynamic evidence secret scan passed != source clean.
- worktree started clean != final worktree clean.
- owner-waived / not_verified != success.

## Future Phase 4 Evidence Minimum

Any future approved Phase 4 task must produce:

- sanitized final summary in MD and JSON.
- command log index and individual command logs with runId, cwd, command, start_utc, end_utc, and exit_code.
- sanitized gate outputs for relevant C5/C3/C6/C7 checks as applicable.
- dynamic review evidence secret scan over generated evidence.
- final review ZIP summary with packageMode, source branch, source commit, hash, size, count, scan claims, and `may_run_phase4`.
- final package source-scope scan log bound to the exact final ZIP path and sha256.
- artifact ledger and verification log for final sidecars.
- explicit not_run/no statements for Phase 3 retry, fullflow unless separately approved, and non-`00001` mutation.

## Sensitive Artifact Exclusions

The following must not be generated, included, or used as evidence:

- raw ORCA request body.
- raw ORCA response body.
- raw patient detail.
- raw insurance detail.
- raw credential, cookie, Authorization, JSESSIONID, CSRF token, raw password, raw session, credential-bearing URL.
- HAR, trace, video, screenshot, raw network dump.
- `.git`, `node_modules`, `dist`, `target`, `coverage`, `test-results`, raw artifact directories.

## Claim Language

Allowed:

- Phase 4 handoff docs prepared.
- Phase 4 remains not_run.
- fullflow remains not_run.
- no new live ORCA mutation run.
- future Phase 4 prompt/run remains blocked until explicit approval.
- Clinical Wave 1 coverage remains local/server/component/static only.

Forbidden:

- Phase 4 accepted.
- fullflow passed.
- live medicalmodv2/diseasev3/subjectivesv2 success.
- WO-2 reopen package evidence verified.
- live ORCA success from local/MSW/static/server tests.


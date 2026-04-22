# Phase 4 Stop Policy

This policy applies to WO-6 preparation and any future Phase 4 execution task.

## Stop Immediately

Stop immediately and do not package as accepted if any of these occur:

- any attempt to rerun Phase 3.
- any attempt to run fullflow without explicit future approval.
- any unapproved live mutation.
- any Phase 4 execution attempt during WO-6.
- any live ORCA connection test during WO-6.
- any mutation target other than the explicitly approved target.
- any mutation for candidates/patients `00002` through `00011`.
- any Request_Number `02`, `03`, or `04` execution without explicit future approval.
- raw ORCA request body detected.
- raw ORCA response body detected.
- raw patient detail detected.
- raw insurance detail detected.
- raw credential, Cookie, Authorization, JSESSIONID, CSRF token, raw password, raw session, token, or credential-bearing URL detected.
- HAR, trace, video, screenshot, raw network dump, or raw browser/network artifact detected.
- stale sidecar hash mismatch.
- package validation target mismatch.
- final ZIP source-scope scan target mismatch.
- artifact ledger references missing files, stale files, duplicate files, unsafe paths, or absolute paths.
- command output contains credential/session/token values.
- `not_run`, `not_verified`, or owner-waived evidence is promoted to success.
- HTTP 200, wrapper exit 0, dry-run, local test, server test, static test, package validation, or source-scope scan is promoted to live ORCA business success.

## Stop And Report Blocked

Stop and report `blocked` if:

- explicit future owner approval is absent or ambiguous.
- ChatGPT review acceptance is absent where required.
- approved target candidate/patient is not explicit.
- approved request/action is not explicit.
- credential channel is not approved.
- redaction cannot be verified.
- source commit or final package hash cannot be fixed to a single value.
- final sidecar directory is missing or ambiguous.
- old WO-5 sidecars could be confused with current evidence.
- final sidecar filenames do not include the current WO-6 final ZIP basename, or any sidecar path/hash/ledger can be mistaken for a WO-5 artifact.

## Recovery Rules

Allowed recovery in WO-6:

- fix documentation wording that could be read as execution authorization.
- regenerate docs-only package and sidecars.
- rerun package metadata validation, source-scope scan, and artifact ledger verification against the exact final ZIP.
- correct stale package hashes by regenerating all dependent sidecars.

Not allowed recovery in WO-6:

- running Phase 3 retry.
- running Phase 4.
- running fullflow.
- running live ORCA connection tests.
- running mutation.
- adding app production code changes.
- adding CWP functional changes.
- keeping raw sensitive artifacts and explaining them as temporary.

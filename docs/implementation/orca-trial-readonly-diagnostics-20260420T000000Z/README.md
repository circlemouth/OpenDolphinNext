# ORCA Trial Read-only Diagnostics Evidence Rerun Package

RUN_ID placeholder: actual rerun must use a fresh UTC timestamp in `YYYYMMDDThhmmssZ`.

This directory is the prepared evidence/package landing area for the post-merge Phase 2.5 read-only diagnostics rerun. Subagent D did not run live ORCA read-only discovery in this branch because the main agent has not yet declared the merged diagnostic source ready.

## Prepared Flow

1. Generate a new `RUN_ID` from the actual UTC rerun timestamp.
2. Run safe read-only diagnostics only after main-agent approval.
3. Write sanitized status input as `final-summary.status.sanitized.json`.
4. Generate the review package under `docs/implementation/orca-trial-readonly-diagnostics-<RUN_ID>/`.
5. Validate final ZIP metadata against the final ZIP, not a preliminary ZIP.
6. Run `orca-readonly-evidence-finalizer.mjs` to create:
   - `final-summary.sanitized.json`
   - `final-summary.sanitized.md`
   - `secret-scan.sanitized.txt`
   - `artifact-sha256.txt`
   - sidecar summary Phase 2.5 status fields

## Non-Goals

- No Phase 3.
- No Phase 4.
- No fullflow.
- No mutation request.
- No raw ORCA body, raw patient detail, raw insurance detail, HAR, trace, video, raw screenshot, raw network dump, credential, cookie, Authorization header, JSESSIONID, CSRF token, raw session, password, or credential-bearing URL.

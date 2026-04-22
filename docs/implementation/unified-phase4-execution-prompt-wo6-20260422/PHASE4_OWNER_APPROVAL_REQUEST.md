# Phase 4 Owner Approval Request

## What WO-6 Prepared

WO-6 prepared the future Phase 4 execution prompt draft, owner approval checklist, go/no-go matrix, command guard, stop policy, evidence template, and review-package evidence plan.

WO-6 did not execute Phase 4. WO-6 did not connect to live ORCA. WO-6 did not run mutation, fullflow, Request_Number `02`/`03`/`04`, or Phase 3 retry.

## Current Not-Run Status

| item | status |
|---|---|
| Phase 3 retry rerun in WO-6 | no |
| Phase 4 | `not_run` |
| fullflow | `not_run` |
| live ORCA mutation | no |
| live ORCA connection test | no |
| candidates/patients `00002` through `00011` mutation | `not_run` |
| Request_Number `02`/`03`/`04` execution | not run |

## Approval Needed Before Any Future Live Execution

The owner must explicitly approve all of the following in a future message after ChatGPT review accepts WO-6:

- permission to start Phase 4 execution, not merely prompt preparation.
- exact candidate/patient target. Default must be `00001 / 00001` only.
- exact allowed request number or action for Phase 4.
- whether fullflow remains prohibited. Default is prohibited.
- whether Request_Number `02`, `03`, or `04` remains prohibited. Default is prohibited.
- approved credential delivery channel.
- approved evidence directory and package output directory.
- explicit acceptance of the sanitized-evidence-only policy.

Without that explicit approval, the future agent must stop with `may_run_phase4=false`.

## Expected Risk

Phase 4 may perform a live ORCA mutation if later approved. The main risks are:

- unintended mutation of the wrong candidate/patient.
- accidental second Phase 3 retry.
- accidental fullflow or Request_Number `02`/`03`/`04` execution.
- raw ORCA, patient, insurance, credential, cookie, token, or network artifacts being captured.
- local/static/server evidence being overclaimed as live ORCA success.
- stale package sidecars being reused as current evidence.

## Exact Stop Conditions

Stop before execution if any of these occur:

- future owner approval is absent, ambiguous, or only approves prompt preparation.
- target candidate/patient is not exactly the approved target.
- any command would rerun Phase 3.
- any command would run fullflow without explicit approval.
- any command would mutate `00002` through `00011`.
- any command would execute Request_Number `02`, `03`, or `04` without explicit approval.
- command output would expose credentials, cookies, Authorization, JSESSIONID, CSRF token, password, session, credential-bearing URL, raw ORCA body, raw patient detail, raw insurance detail, HAR, trace, video, screenshot, or raw network dump.
- package validation target does not match the final ZIP hash.
- source-scope scan targets a stale ZIP.
- `not_run`, `not_verified`, owner-waived, HTTP 200, wrapper exit 0, or dry-run evidence is promoted to live business success.

## Credential Handling Requirement

Credentials must be provided only via approved secure channel or runtime environment variables such as `ORCA_API_USER` and `ORCA_API_PASSWORD`. Raw values must not be committed, logged, packaged, echoed, included in sidecars, embedded in URLs, or copied into prompt text.

Command logs may record only set/unset classification and sanitized redaction results.

## Owner Decision Fields

The future owner approval must state:

| decision | required owner value |
|---|---|
| approve Phase 4 execution | yes/no |
| target candidate/patient | exact value |
| allowed request/action | exact value |
| fullflow allowed | yes/no |
| Request_Number `02`/`03`/`04` allowed | yes/no |
| credential channel | approved secure channel or env vars |
| evidence output directory | repo-relative path |
| raw artifact policy accepted | yes/no |
| package/sidecar regeneration required | yes |

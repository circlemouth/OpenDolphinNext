# Phase 4 Handoff Runbook

## This WO-5 Does Not Approve Phase 4

WO-5 prepares handoff documentation only.

- Phase 4 remains `not_run`.
- fullflow remains `not_run`.
- no new live ORCA mutation was run in WO-5.
- future Phase 4 prompt/run remains blocked until explicit owner/ChatGPT approval in a future task.
- This document must not be used as execution approval.

## Required Inputs For Any Future Phase 4 Task

A future task may only prepare or run Phase 4 after explicit approval and after all required inputs are present:

| required input | required status |
|---|---|
| accepted Phase 3 sanitized evidence | accepted, sanitized JSON/MD only |
| candidate/patient scope | `00001` only |
| C7 dynamic gate | accepted |
| static/typecheck/build/test evidence | accepted, or explicit accepted waiver |
| WO-3 coverage | accepted local/server/component/static coverage |
| WO-4 coverage | accepted local/server/component/static coverage |
| current review package | final package hash, source-scope scan, and artifact ledger verified |
| WO-2 reopen package evidence | remains owner-waived / not_verified, not success evidence |

## Required Prechecks

| precheck | required outcome |
|---|---|
| no second Phase 3 retry | prove no rerun was attempted |
| no mutation for `00002` through `00011` | prove these remain not_run |
| source_commit matches artifact summary | exact match between final package summary and command evidence |
| package hash verified | final ZIP sha256 matches metadata sidecar and ledger |
| raw artifacts absent | no raw ORCA body, raw patient/insurance detail, HAR, trace, video, screenshot, or raw network dump |
| Phase 4 command guard reviewed | future command is reviewed before execution and is blocked by default |
| live ORCA credential/session guard reviewed | review set/unset/classification only; never record raw values |

## Forbidden Actions

- Phase 4 without explicit future approval.
- fullflow.
- mutation for `00002` through `00011`.
- replay of old mutation artifacts.
- Request_Number `02`, `03`, or `04` execution.
- raw ORCA request body capture.
- raw ORCA response body capture.
- raw credential, cookie, Authorization, JSESSIONID, CSRF token, raw password, raw session, or credential-bearing URL capture.
- HAR, trace, video, screenshot, or raw network dump capture.
- treating `not_run`, `not_verified`, or owner-waived evidence as success.

## Required Future Phase 4 Evidence

Future Phase 4 evidence must be sanitized and limited to reviewable, non-sensitive summaries:

- sanitized JSON/MD only.
- relevant gates C5/C3/C6/C7 as applicable.
- dynamic secret scan over generated evidence.
- final package source-scope scan bound to the final package hash.
- artifact ledger verification for current sidecars.
- no HAR/trace/video/screenshot/raw network dump.
- no raw ORCA body.
- no raw patient detail or raw insurance detail.
- no raw credential/session material.

## Stop Conditions

Stop immediately and do not package as accepted if any of these occur:

- any attempt to rerun Phase 3.
- any unapproved Phase 4, fullflow, or mutation command.
- any mutation target other than candidate/patient `00001`.
- raw sensitive artifact detected.
- package scan target mismatch.
- package hash/ledger mismatch.
- `not_run`, `not_verified`, or owner-waived evidence promoted to success.
- HTTP 200, wrapper exit 0, dry-run/precheck, local/MSW/static tests, or package scan is used as live ORCA business success.

## Misuse Cases Considered

| misuse case | WO-5 control |
|---|---|
| reviewer treats this handoff as permission to execute Phase 4 | runbook states WO-5 does not approve execution and requires explicit future approval |
| old mutation or fullflow artifacts are replayed as current evidence | prechecks require current package hash/ledger and forbid old artifact replay |
| sanitized/local/static evidence is promoted to live ORCA success | evidence requirements separate local/static, dynamic scan, source scan, and functional business success |
| credentials or raw ORCA bodies are captured to debug a future run | forbidden actions and stop conditions reject raw sensitive capture |


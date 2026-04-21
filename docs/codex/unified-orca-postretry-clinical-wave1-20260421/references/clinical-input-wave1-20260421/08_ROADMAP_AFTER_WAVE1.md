# 08. Roadmap after Wave 1

## CWP-07: stale revision / concurrent edit / patient switch isolation

Scope:
- stale 409 `REVISION_CONFLICT` UI
- dirty preserved
- reload/diff/retry route
- P1 slow response after switch to P2 must not leak P1 data
- SOAP/document/order/disease race matrix

## CWP-08: DADS component contract

Scope:
- shared DADS DOM audit helper
- labels/support/error
- placeholder non-dependence
- disabled reason/enabling condition
- primary action count per context
- patient identity visibility

## CWP-09: Playwright DADS page contract

Scope:
- 1280px / 768px contract
- keyboard/focus/focus restore
- important info not hidden
- page action hierarchy
- raw trace/video/HAR not included in package

## CWP-10: dynamic evidence and package hygiene

Scope:
- sanitized command log format
- test run summary manifest
- package validation
- absolute local path normalization
- historical docs vs current evidence labels
- full-source scan only if separately executed

## Future ORCA live gate

Keep separate from Wave 1 and require explicit authorization:

- medicalmodv2 live mutation gate
- diseasev3 live mutation gate
- subjectivesv2 live mutation gate
- official ORCA spec confirmation
- sanitized ORCA evidence only; no raw credentials/HAR/XML

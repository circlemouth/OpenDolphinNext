# Evidence Manifest

RUN_ID: `20260514T020603Z`
FOLLOW_UP_RUN_ID: `20260514T060351Z`

## Sanitized QA Evidence

| Evidence | Path |
| --- | --- |
| candidate discovery summary | `artifacts/orca-remediation/closeout/20260514T020603Z/qa/weborca-candidate-discovery/summary.json` |
| readonly preflight summary | `artifacts/orca-remediation/closeout/20260514T020603Z/qa/weborca-readonly-preflight/summary.json` |
| acceptmodv2 sanitized summary | `artifacts/orca-remediation/closeout/20260514T020603Z/qa/acceptmodv2/accept-summary.sanitized.json` |
| fullflow summary | `artifacts/orca-remediation/closeout/20260514T020603Z/qa/fullflow/summary.json` |
| fullflow steps | `artifacts/orca-remediation/closeout/20260514T020603Z/qa/fullflow/steps.log` |
| Phase4 dry-runs | `artifacts/orca-remediation/closeout/20260514T020603Z/qa/phase4-dry-runs/` |
| Phase4 live results | `artifacts/orca-remediation/closeout/20260514T020603Z/qa/phase4-live/` |

## Command Results

- Web guard: passed.
- Typecheck: passed.
- Focused Vitest: passed.
- Sensitive evidence redaction guard: passed.
- runtime-ready smoke: failed before accept because no runtime-ready entry existed for the date.

## Follow-up Sanitized Summary Contract

`qa-fullflow-weborca.mjs` now records normal close-and-send evidence as sanitized summary fields only:

- `closeAndSendResult.routeTemplate`
- `closeAndSendResult.httpStatusClass`
- `closeAndSendResult.operationStatus`
- `closeAndSendResult.state`
- `closeAndSendResult.needsUserReview`
- `closeAndSendResult.apiResult`
- `closeAndSendResult.blockerClassification`
- `closeAndSendResult.rawSensitiveFieldsExcluded`

The backward-compatible `sendResult` alias is retained for readers that have not yet switched to `closeAndSendResult`, but it must not contain raw ORCA payloads.

`runtime-ready-smoke.mjs` also writes patient-context-bearing summaries through the same redaction policy. Patient ID, display name, row text, reception key, schedule key, appointment key, and encounter key are replaced by redaction markers in retained evidence.

## Follow-up Runtime Evidence

| Evidence | Path | Result |
| --- | --- | --- |
| runtime-ready smoke | `artifacts/webclient/runtime-gate-ready/20260514T040844Z/runtime-ready-result.json` | PASS, redacted patient context |
| fullflow summary | `artifacts/orca-remediation/closeout/20260514T040844Z/qa/fullflow/summary.json` | PASS to rooted blocker summary |
| fullflow blocker summary | `artifacts/orca-remediation/closeout/20260514T040844Z/qa/fullflow/blocker-summary.json` | `test-data-blocker / close_and_send_guard_blocked` |
| CTA reachability fullflow summary | `artifacts/orca-remediation/closeout/20260514T060351Z/qa/fullflow/summary.json` | PASS to normal close-and-send route reachability; HTTP `400` safely classified |
| CTA reachability blocker summary | `artifacts/orca-remediation/closeout/20260514T060351Z/qa/fullflow/blocker-summary.json` | `trial-business-or-capability-blocker / trial_close_and_send_not_business_accepted:unknown` |
| CTA reachability steps | `artifacts/orca-remediation/closeout/20260514T060351Z/qa/fullflow/steps.log` | Shows `finish CTA visible after start`, dialog confirm, and route-template request only |
| runtime-ready smoke after CTA fix | `artifacts/webclient/runtime-gate-ready/20260514T060351Z-SMOKE2/runtime-ready-result.json` | PASS, redacted patient context; post-start summary refetch recorded as not observed instead of failing the smoke |

## Excluded Evidence

The following were intentionally not retained:

- raw ORCA request/response body
- raw ORCA XML
- raw ORCA JSON/business body
- ORCA credential or Basic header
- Cookie / Authorization / JSESSIONID / CSRF
- HAR, trace, video, raw network JSON
- screenshots containing visible Trial patient identifiers
- request XML sidecar files from the fullflow close-and-send pass

## Notes

An early Phase4 dry-run attempt used a wrong working-directory-relative payload path and was rejected before live ORCA traffic. It is not accepted evidence and is superseded by the repo-root dry-runs listed above.

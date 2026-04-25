# RWO-08B Charts Visit-Date Repair

RUN_ID: `20260425T080024Z`

## Result

`RWO08B_CHARTS_VISIT_DATE_REPAIR_NO_LIVE_TESTS_PASS_DIAGNOSTIC_TARGET_BLOCKED_BEFORE_CHARTS_HANDOFF`

The active handoff investigated why a Charts-reaching diagnostic target had no server-fetched official visit identifiers in the selected Charts context. A repo-local client defect was found: Charts refetched the outpatient appointment/visit list using the page load date (`today`) instead of the handoff `visitDate`. When a Trial handoff belongs to a different visit date, Charts can miss the server visit row that carries `Insurance_Combination_Number`, `Voucher_Number`, and `Sequential_Number`.

The fix makes Charts use `encounterContext.visitDate` for the appointment/visit query date, falling back to `today` only when no handoff visit date exists. This keeps ORCA send fail-closed when official identifiers are still missing and does not derive identifiers from client-provided handoff keys.

## Sanitized Evidence

| Item | Result |
|---|---|
| Focused no-live resolver test | `pass_10_tests` |
| Web guard | `pass` |
| Typecheck | `pass` |
| Runtime-ready smoke | `pass_json_only` |
| Read-only preflight | `rejected_selector_option_missing_no_mutation` |
| Accepted/local-selectable candidate classes | `acceptedCandidateCount=2`, `localSelectableCandidateCount=2` |
| Diagnostic fullflow after fix | `blocked_before_charts_handoff` |
| Medical-information gate | `pass` |
| Charts handoff | `error_before_charts_navigation` |
| Selected visit row | `not_present` |
| Visit row readiness | `unknown` |
| Request XML | `not_created` |
| Business success | `false` |
| Raw artifacts committed/packaged | `false` |

## Diagnostic Artifact Manifest

Local-only gitignored roots:

- `artifacts/diagnostic-fullflow/20260425T080024Z/readonly-preflight`
- `artifacts/diagnostic-fullflow/20260425T080024Z/fullflow-post-date-fix`

The roots are diagnostic-only. They are not release evidence, not committed, and not packaged.

| Class | Count |
|---|---:|
| total files | 24 |
| request XML | 0 |
| raw artifacts committed/packaged | 0 |

## Misuse Cases Checked

| Misuse case | Control / result |
|---|---|
| Derive ORCA official identifiers from client handoff keys. | Rejected; the fix changes only the server fetch date and keeps identifier authority in server-returned visit rows. |
| Query the wrong visit date and silently fall back to stale/current-day rows. | Fixed; handoff `visitDate` now drives the Charts appointment/visit query date. |
| Treat preflight rejection or Charts handoff as business success. | Rejected; no request XML was created and no L4 success is claimed. |
| Commit raw diagnostic browser/network/request artifacts. | Rejected; diagnostic output remains gitignored local-only. |

## Claim Boundary

Allowed claim: a repo-local Charts date-selection defect was repaired and no-live verification passed.

Not claimed: L4 fullflow success, Trial order-send business success, `diseasev3` acceptance, `subjectivesv2` acceptance, Request_Number `02` / `03` / `04` acceptance, production ORCA readiness, S3/object-storage readiness, rollback rehearsal, owner final GO, or final release readiness.

## Next Action

Find or establish a current WebORCA Trial diagnostic precondition that reaches Charts after the visit-date repair, then run one diagnostic fullflow to verify that the selected visit row is populated with server-fetched official identifiers.

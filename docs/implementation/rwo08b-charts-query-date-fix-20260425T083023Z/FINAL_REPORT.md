# RWO-08B Charts Visit-Date Refetch Fix

RUN_ID: `20260425T083023Z`

## Result

`RWO08B_CHARTS_VISIT_DATE_REFETCH_FIX_NO_LIVE_PASS_DIAGNOSTIC_BLOCKED_BEFORE_CHARTS_HANDOFF`

This run investigated the active blocker `fullflow-charts-reaching-target-official-visit-identifiers-missing`.

The repo-local defect found was that Charts refetched appointment/visit rows using the browser-local current date even when the reception-to-Charts handoff carried a canonical `visitDate`. That can make a Charts-reaching Trial context miss the server-fetched visit row that contains official identifiers.

The fix changes only the fetch date selection:

- prefer handoff `visitDate` when present
- fall back to today only when no handoff `visitDate` exists
- continue to accept `Insurance_Combination_Number`, `Voucher_Number`, and `Sequential_Number` only from server-fetched visit rows
- continue to fail closed when official rows are missing or ambiguous

## Sanitized Evidence

| Item | Result |
|---|---|
| Code commit | `576f56f40` |
| Focused no-live tests | `pass_10_tests` |
| Web guard | `pass` |
| Typecheck | `pass` |
| Runtime startup | `orca-trial-no-object-storage` started |
| Runtime-ready smoke | `pass_json_only` |
| Diagnostic fullflow | `blocked_before_charts_handoff` |
| Medical-information gate | `pass` |
| Charts handoff | `error` |
| Selected visit row | `not_present` |
| Visit row readiness | `unknown` |
| Request XML | `not_created` |
| L4 fullflow success | `false` |
| Raw artifacts committed/packaged | `false` |

## Diagnostic Artifact Manifest

Local-only root:

- `artifacts/diagnostic-fullflow/20260425T083023Z/fullflow-post-query-date-fix`

The root is gitignored diagnostic output only. It is not release evidence, not committed, and not packaged.

| Class | Count |
|---|---:|
| total files | 14 |

## Misuse Cases Checked

| Misuse case | Control / result |
|---|---|
| Use client-provided official visit identifiers. | Rejected. The fix changes only the server query date; official identifiers still come only from server-fetched visit rows. |
| Treat handoff `visitDate` as authorization or business success. | Rejected. `visitDate` is only a query scope hint; fullflow did not reach L4 success. |
| Repeat a failed diagnostic without a concrete fix. | Avoided. The single post-fix diagnostic run followed the committed query-date fix and focused no-live verification. |
| Commit raw browser/network/request artifacts. | Rejected. Raw diagnostic output remains local-only and gitignored. |

## Claim Boundary

Allowed claim: Charts now refetches appointment/visit rows for the handoff `visitDate`, preserving fail-closed official identifier resolution.

Not claimed: L4 fullflow success, Trial order-send business success, `diseasev3` acceptance, `subjectivesv2` acceptance, Request_Number `02` / `03` / `04` acceptance, production ORCA readiness, S3/object-storage readiness, rollback rehearsal, owner final GO, or final release readiness.

## Next Action

Find or establish a current Trial diagnostic precondition that reaches Charts after the visit-date refetch fix, then rerun one diagnostic fullflow to classify selected visit row and official identifier readiness.

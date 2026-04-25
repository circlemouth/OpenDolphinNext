# RWO-08B Visit Row Hydration Repair

RUN_ID: `20260425T063024Z`

## Result

`RWO08B_VISIT_ROW_SELECTION_REPAIR_NO_LIVE_TESTS_PASS_RUNTIME_SMOKE_PASS_DIAGNOSTIC_BLOCKED_BEFORE_CHARTS_HANDOFF`

This run fixed the repo-local Charts selection defect that could keep an accepted encounter from hydrating official visit identifiers even after the server returned a usable official visit row. `ChartsPage` now resolves the selected Reception entry through a shared resolver that:

- prefers exact handoff matches only when they already contain official visit identifiers;
- falls back to a single server-fetched official visit row for the same patient/date when the accepted handoff keys differ from the official row keys;
- refuses patient/date fallback when official identifiers are incomplete or multiple matching official rows exist.

This preserves fail-closed behavior. The client still does not synthesize `Insurance_Combination_Number`, `Voucher_Number`, or `Sequential_Number` from canonical keys, client state, or mutation request input.

## Sanitized Evidence

| Item | Result |
|---|---|
| Focused resolver tests | `pass` / 8 tests |
| Web guard | `pass` |
| Typecheck | `pass` |
| Runtime smoke | `pass` |
| Diagnostic fullflow | `blocked_before_charts_handoff` |
| Diagnostic target classification | `trial_native_default_candidate` |
| Medical-information gate | `pass` |
| Charts handoff | `error_before_charts_navigation` |
| Selected visit row | `not_available` |
| Request XML | `not_created` |
| L4 fullflow success | `false` |
| Raw artifacts committed/packaged | `false` |

## Diagnostic Artifact Manifest

Local-only root:

- `artifacts/diagnostic-fullflow/20260425T063024Z/fullflow`

The root is gitignored diagnostic output only and is not release evidence, not committed, and not packaged.

| Class | Count |
|---|---:|
| screenshots | 4 |
| network JSON | 2 |
| HAR | 0 |
| trace | 0 |
| video | 0 |
| request XML | 0 |
| JSON | 8 |
| markdown | 1 |
| total files | 14 |

## Misuse Cases Checked

| Misuse case | Control / result |
|---|---|
| Client uses canonical keys to fabricate official visit identifiers. | Rejected. The resolver only accepts server-fetched rows with all three official identifiers present. |
| Patient/date fallback selects the wrong encounter when multiple official rows exist. | Rejected by focused test; multiple matching official rows resolve to no fallback. |
| Projection-only rows shadow a later official visit row. | Fixed by preferring the single complete official visit row over a projection-only exact key match. |
| Diagnostic artifacts enter tracked evidence. | Only counts and allowlisted classifications were copied; diagnostic root is gitignored. |

## Claim Boundary

Allowed claim: the repo-local Charts selected-entry resolver now hydrates server-fetched official visit rows when a single authoritative official row exists, and focused no-live tests/typecheck/runtime smoke passed.

Not claimed: L4 fullflow success, Trial order-send business success, `diseasev3` acceptance, `subjectivesv2` acceptance, Request_Number `02` / `03` / `04` acceptance, production ORCA readiness, S3/object-storage readiness, rollback rehearsal, owner final GO, or final release readiness.

## Next Action

Rerun diagnostic fullflow with the same class of target that reaches Charts after accept. The `trial_native_default_candidate` used in this run did not establish a canonical Charts handoff, so it did not verify the repaired selected-entry hydration path live.

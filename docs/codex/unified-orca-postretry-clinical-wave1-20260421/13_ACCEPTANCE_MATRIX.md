# 13. Unified acceptance matrix

| Gate | Acceptance | Do not claim |
|---|---|---|
| WO-1 ORCA postretry | evidence hygiene fixed; C7/business tests pass; no new mutation | Phase 4 ready without review; full repo clean if not scanned |
| WO-2 Static/DADS | typecheck/build/test:ci green or explicit waiver | DADS compliance beyond touched scope |
| WO-3 Clinical batch1 | CWP-01/05/02 targeted tests pass | live ORCA diseasev3/subjectivesv2 |
| WO-4 Clinical batch2 | CWP-04/03/06 targeted tests pass | live medicalmodv2/fullflow |
| WO-5 Phase4 handoff | docs/prechecks prepared; Phase 4 not_run | Phase 4 executed or accepted |

## Global blockers

- Phase 3 rerun detected
- Phase 4/fullflow run without explicit approval
- raw sensitive artifact included
- final ZIP scan target hash mismatch
- not_run/not_verified claimed as success
- live ORCA success claimed from local/MSW/static tests
- typecheck/build/test:ci failure with no waiver and no fix

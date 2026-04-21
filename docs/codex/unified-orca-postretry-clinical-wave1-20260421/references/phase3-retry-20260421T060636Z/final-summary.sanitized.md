# ORCA Trial Phase 3 Retry Final Summary

- RUN_ID: 20260421T060636Z
- Branch / HEAD: master / f0e9c92035193a29d8ad9a3897bfc9a08b123ebc
- source_commit matches artifact summary: yes
- Worktree clean: not_verified (generated evidence directory exists; initial status was clean)
- Candidate / patient: 00001 / 00001
- Preflight sha256: matched (57d43788d7384cdcdc6368271bbcfdf1a2f1a87e92c6ee801271c36332159590)
- Input identity sha256: matched (356d109381b57e0c792eada1a4bd394248c6fca8273a82ab770143efc92bc29a)
- Dry-run: exit 0, mutation/phase3/phase4/fullflow not_run, no raw/browser/network artifacts
- Phase 3 retry: executed once via approved wrapper, exit 0
- apiResult: K3
- Request_Number: (not present in sanitized response evidence)
- Intended mutation request number: 01
- mutationSuccess: true
- Business classification: businessAcceptedWithWarnings
- Accepted/rejected/inconclusive: accepted
- C7 dynamic payload gate: accepted, targetMutationRequestCount=1, checkedRequests=1
- Phase 4: not_run
- fullflow: not_run
- 00002-00011 mutation: not_run
- Raw/browser/network artifacts: excluded
- May run Phase 4: no

## Static Sanity Checks

- node --check wrapper: PASS
- focused Vitest guards/evidence: PASS (3 files, 55 tests)
- npm run typecheck: FAIL (existing charts test type errors)
- npm run lint: PASS_WITH_WARNINGS (495 warnings)
- npm run build: FAIL (same TypeScript errors)
- npm run test:ci: FAIL (5 failed, 1280 passed, 2 skipped)

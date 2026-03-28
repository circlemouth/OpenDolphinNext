# Static Analysis Baseline Inventory

- Date: 2026-03-28
- RUN_ID: 20260327T225253Z
- Scope: `server-modernized` SpotBugs / FindSecBugs Wave 4 integrated snapshot
- Authoritative command: `mvn -f pom.server-modernized.xml -pl server-modernized -am -Pstatic-analysis verify`
- Thin wrapper: `bash ./scripts/server-modernized/verify-static-analysis.sh`

## Intent

- Keep parent POM intent unchanged: SpotBugs / FindSecBugs remain fail-on-error.
- Keep Checkstyle / PMD unchanged.
- Keep the authoritative entrypoint explicit and repo-local.
- Record the Wave 4 integrated baseline without threshold relaxation, blanket suppression, or filter weakening.

## Before Counts

- Wave 4 start baseline: `35`
- Historical Wave 2 start baseline: `249`
- Historical Wave 2 end baseline: `144`
- Historical Wave 1 start baseline: `329`

## Wave 4 Changes

- Integrated the remaining SpotBugs / FindSecBugs tail in the current repo snapshot with smallest viable diffs.
- Closed the ORCA REST helper tail, the ORCA wrapper boolean/nullability tail, the dead helper in the ORCA XML mapper support, the narrow-catch fallback in the ORCA disease master lookup, the ORCA sync resource exposure tail, and the subjective user lookup nullability tail.
- No blanket suppression, POM threshold changes, or Checkstyle / PMD enablement were introduced.

## After Counts

- Canonical command result: `PASS`
- Total findings: `0`
- Delta from Wave 4 start: `-35`
- Delta from Historical Wave 2 start: `-249`
- Delta from Historical Wave 1 start: `-329`

## Top Bug Families

- `none`

## Top Packages

- `none`

## Lane Residues

### Lane A

- Count: `0`
- Status:
  - Cleared in the current integrated snapshot.

### Lane B

- Count: `0`
- Status:
  - Cleared in the current integrated snapshot.

### Lane C

- Count: `0`
- Status:
  - Cleared in the current integrated snapshot.

### Lane D

- Count: `0`
- Status:
  - Cleared in the current integrated snapshot.

### Outside Lane Scope

- Count: `0`
- Status:
  - No SpotBugs / FindSecBugs findings remain outside the lane allocations.

## Next Wave Boundary

1. Wave 4 is complete for the current repo snapshot.
2. Future static-analysis regressions should be tracked as a new baseline rather than folded back into Wave 4.

## Commands Used

```bash
mvn -f pom.server-modernized.xml -pl server-modernized -am -Pstatic-analysis verify

mvn -f pom.server-modernized.xml -pl server-modernized -am -DskipTests compile

bash ./scripts/server-modernized/verify-static-analysis.sh
```

## Notes / Unknown

- `mvn -f pom.server-modernized.xml -pl server-modernized -am -Pstatic-analysis verify` is the repo-local authoritative static-analysis entrypoint.
- `bash ./scripts/server-modernized/verify-static-analysis.sh` remains as a convenience wrapper that delegates to the same contract.
- `compile` passed.
- `bash ./scripts/server-modernized/verify-static-analysis.sh` passed.
- The current snapshot leaves no remaining SpotBugs / FindSecBugs findings.

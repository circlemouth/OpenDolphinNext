# Approved Phase 3 command runbook

## Stop conditions
Stop before mutation if any of these are true:
- ChatGPT has not accepted this remediation package.
- Candidate is not exactly `00001`.
- Preflight artifact path or SHA-256 differs from the approved values.
- Input identity hash differs from the approved value.
- `acceptedForPhase3Attempt` is not strict boolean `true`.
- `mutationPolicy.targetMutationRequestCount` is not `0`.
- Browser/network/raw artifact capture is enabled.
- Phase 4 or fullflow flags are present.
- A direct curl or non-repository command path is selected.

## Dry-run command
This command is safe for remediation review. It does not call ORCA and does not call the acceptmodv2 mutation route.

```bash
node web-client/scripts/qa-phase3-approved-acceptmodv2.mjs \
  --candidate 00001 \
  --preflight docs/implementation/orca-trial-readonly-contract-fix-20260420T141516Z/exact-selected-candidate-preflight.sanitized.json \
  --preflight-sha256 57d43788d7384cdcdc6368271bbcfdf1a2f1a87e92c6ee801271c36332159590 \
  --input-identity-sha256 356d109381b57e0c792eada1a4bd394248c6fca8273a82ab770143efc92bc29a \
  --sanitized-evidence-only \
  --disable-browser-artifacts \
  --phase3-only \
  --dry-run
```

## Future Phase 3 owner command
Only after ChatGPT accepts this remediation package, the Phase 3 execution owner may replace `--dry-run` with `--execute-approved-mutation`.

```bash
node web-client/scripts/qa-phase3-approved-acceptmodv2.mjs \
  --candidate 00001 \
  --preflight docs/implementation/orca-trial-readonly-contract-fix-20260420T141516Z/exact-selected-candidate-preflight.sanitized.json \
  --preflight-sha256 57d43788d7384cdcdc6368271bbcfdf1a2f1a87e92c6ee801271c36332159590 \
  --input-identity-sha256 356d109381b57e0c792eada1a4bd394248c6fca8273a82ab770143efc92bc29a \
  --sanitized-evidence-only \
  --disable-browser-artifacts \
  --phase3-only \
  --execute-approved-mutation
```

Phase 4 remains Do not run. fullflow remains Do not run.

## Required handoff values
- candidate: `00001`
- preflight path: `docs/implementation/orca-trial-readonly-contract-fix-20260420T141516Z/exact-selected-candidate-preflight.sanitized.json`
- preflight sha256: `57d43788d7384cdcdc6368271bbcfdf1a2f1a87e92c6ee801271c36332159590`
- input identity hash: `356d109381b57e0c792eada1a4bd394248c6fca8273a82ab770143efc92bc29a`
- intended mutation request: `Request_Number=01`


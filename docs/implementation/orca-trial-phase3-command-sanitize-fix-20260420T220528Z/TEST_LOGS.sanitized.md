# Test logs

RUN_ID: `20260420T220528Z`

No live ORCA, acceptmodv2 mutation route, Phase 4, or fullflow command was run.

## Static checks

```text
node --check web-client/scripts/qa-phase3-approved-acceptmodv2.mjs
exit_code=0

node --check web-client/scripts/qa-acceptmodv2-weborca.mjs
exit_code=0

node --check web-client/scripts/qa-lib/phase3-approved-command-guard.mjs
exit_code=0

node --check web-client/scripts/qa-lib/acceptmodv2-identity-gate.mjs
exit_code=0

node --check web-client/scripts/qa-lib/acceptmodv2-business-evidence.mjs
exit_code=0
```

## Dry-run command

```text
node web-client/scripts/qa-phase3-approved-acceptmodv2.mjs --candidate 00001 --preflight docs/implementation/orca-trial-readonly-contract-fix-20260420T141516Z/exact-selected-candidate-preflight.sanitized.json --preflight-sha256 57d43788d7384cdcdc6368271bbcfdf1a2f1a87e92c6ee801271c36332159590 --input-identity-sha256 356d109381b57e0c792eada1a4bd394248c6fca8273a82ab770143efc92bc29a --sanitized-evidence-only --disable-browser-artifacts --phase3-only --dry-run --artifact-dir docs/implementation/orca-trial-phase3-command-sanitize-fix-20260420T220528Z/dry-run-evidence
exit_code=0
result=PASS
ORCA live mutation=not_run
acceptmodv2 mutation route=not_run
Phase 4=not_run
fullflow=not_run
```

## Targeted tests

```text
cd web-client && npm test -- --run scripts/__tests__/acceptmodv2IdentityGate.test.ts scripts/__tests__/acceptmodv2BusinessEvidence.test.ts scripts/__tests__/phase3ApprovedCommandGuard.test.ts scripts/__tests__/orcaTrialPreflight.test.ts
exit_code=0
test_files=4 passed
tests=134 passed

cd web-client && npm test -- --run scripts/__tests__/acceptmodv2BusinessEvidence.test.ts scripts/__tests__/phase3ApprovedCommandGuard.test.ts
exit_code=0
test_files=2 passed
tests=16 passed
```

## Broader checks

```text
cd web-client && npm run typecheck
exit_code=0

cd web-client && npm run lint
exit_code=0
warnings=492 existing warning class; no lint errors

cd web-client && npm run build
exit_code=0

cd web-client && npm run test:ci
exit_code=0
test_files=186 passed
tests=1258 passed, 2 skipped
```

## Dependency audit

```text
cd web-client && npm audit --audit-level=high
exit_code=0
high_or_critical_vulnerabilities=0
reported_low_vulnerabilities=4
```

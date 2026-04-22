# Test Logs (sanitized)

RUN_ID: `20260422T180231Z`

## node --check qa-lib

```text
PASS
```

## node --check wrapper

```text
PASS
```

## vitest targeted

```text

> web-client@0.0.0 pretest
> npm run verify:web-guard


> web-client@0.0.0 verify:web-guard
> npm run verify:no-public-secrets && npm run verify:no-blocked-orca-route-strings && npm run verify:no-legacy-auth-drift


> web-client@0.0.0 verify:no-public-secrets
> node scripts/verify-no-public-secrets.mjs

[verify:no-public-secrets] web-client 配下の gitignore 対象外 .env* に問題は検出されませんでした。

> web-client@0.0.0 verify:no-blocked-orca-route-strings
> node scripts/verify-no-blocked-orca-route-strings.mjs

[verify:no-blocked-orca-route-strings] ORCA route taxonomy guard passed. scanned roots=9, files=1322. category counts: production fail-close sentinel=2, MSW mock/test-only legacy route surface=2, e2e/QA fixture surface=250, blocked-route detector=39, docs/reference=203, server route inventory negative assertion=2, web.xml exposure negative assertion=3. skipped roots: none

> web-client@0.0.0 verify:no-legacy-auth-drift
> node scripts/verify-no-legacy-auth-drift.mjs

[verify:no-legacy-auth-drift] legacy auth drift token の再混入は検出されませんでした。

> web-client@0.0.0 test
> vitest run --run scripts/__tests__/phase4Medicalmodv2SafeEvidence.test.ts


 RUN  v4.0.18 /Users/Hayato/Documents/GitHub/OpenDolphin_WebClient/web-client

 ✓ scripts/__tests__/phase4Medicalmodv2SafeEvidence.test.ts (6 tests) 8ms

 Test Files  1 passed (1)
      Tests  6 passed (6)
   Start at  03:03:29
   Duration  585ms (transform 33ms, setup 80ms, import 18ms, tests 8ms, environment 393ms)

```

## wrapper dry-run

```text
Phase 4 safe medicalmodv2 dry-run passed without live ORCA traffic
sanitized evidence: /Users/Hayato/Documents/GitHub/OpenDolphin_WebClient/docs/implementation/phase4-live-trial-blocker-20260422T180231Z/wrapper-dry-run/phase4-medicalmodv2-summary.sanitized.json
```

## wrapper mock

```text
Phase 4 safe medicalmodv2 mock passed without live ORCA traffic
sanitized evidence: /Users/Hayato/Documents/GitHub/OpenDolphin_WebClient/docs/implementation/phase4-live-trial-blocker-20260422T180231Z/wrapper-mock/phase4-medicalmodv2-summary.sanitized.json
```

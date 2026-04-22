# Phase 4 Live Trial Blocker Test Logs

RUN_ID: `20260422T200131Z`

## Checks

| Check | Result | Notes |
|---|---|---|
| Branch/status/worktree preflight | PASS | Current branch `master`, HEAD `458426d45`, one registered worktree. Existing roadmap/handoff edits were present before this run and were not reverted. |
| Approved runtime input presence check | BLOCKED | Local handoff file absent; approved payload/hash environment pairs absent. Values were not printed. |
| `node --check web-client/scripts/qa-lib/phase4-medicalmodv2-safe-evidence.mjs` | PASS | Syntax check only. |
| `node --check web-client/scripts/qa-phase4-safe-medicalmodv2.mjs` | PASS | Syntax check only. |
| `npm test -- --run scripts/__tests__/phase4Medicalmodv2SafeEvidence.test.ts` | PASS | `verify:web-guard` pretest passed; Vitest `1` file / `6` tests passed. |
| Phase 4 safe wrapper dry-run | PASS | `dry_run_passed_no_live_orca`; live Trial action `not_run`. |
| Targeted secret/raw-artifact scan | PASS | No targeted secret pattern matches; no HAR/trace/video/screenshot/XML/raw network artifacts found. |

## Runtime Input Presence Check

| Source | Result |
|---|---|
| Local handoff file | absent |
| `PHASE4_MEDICALMODV2_PAYLOAD_PATH` + `PHASE4_MEDICALMODV2_PAYLOAD_SHA256` | absent |
| `QA_PHASE4_MEDICALMODV2_PAYLOAD` + `QA_PHASE4_MEDICALMODV2_PAYLOAD_SHA256` | absent |
| `ORCA_PHASE4_PAYLOAD_PATH` + `ORCA_PHASE4_PAYLOAD_SHA256` | absent |

Values were not printed. Payload contents were not read, stored, committed, or logged.

## Vitest Targeted Output

```text
> web-client@0.0.0 pretest
> npm run verify:web-guard

> web-client@0.0.0 verify:web-guard
> npm run verify:no-public-secrets && npm run verify:no-blocked-orca-route-strings && npm run verify:no-legacy-auth-drift

[verify:no-public-secrets] web-client 配下の gitignore 対象外 .env* に問題は検出されませんでした。
[verify:no-blocked-orca-route-strings] ORCA route taxonomy guard passed. scanned roots=9, files=1335. category counts: production fail-close sentinel=2, MSW mock/test-only legacy route surface=2, e2e/QA fixture surface=250, blocked-route detector=39, docs/reference=214, server route inventory negative assertion=2, web.xml exposure negative assertion=3. skipped roots: none
[verify:no-legacy-auth-drift] legacy auth drift token の再混入は検出されませんでした。

✓ scripts/__tests__/phase4Medicalmodv2SafeEvidence.test.ts (6 tests)
Test Files  1 passed (1)
Tests  6 passed (6)
```

## Wrapper Dry-Run

```text
Phase 4 safe medicalmodv2 dry-run passed without live ORCA traffic
sanitized evidence: /Users/Hayato/Documents/GitHub/OpenDolphin_WebClient/docs/implementation/phase4-live-trial-blocker-20260422T200131Z/wrapper-dry-run/phase4-medicalmodv2-summary.sanitized.json
```

## Live Trial ORCA

- live Trial ORCA action: `not_run`
- reason: `blocked_missing_runtime_secret_or_config`
- endpoint/request class prepared: `POST /api/orca/official/chart-support/medical-mod-v2` / `medicalmodv2`
- target candidate/patient scope: `00001 / 00001`
- credentials printed or captured: no
- raw artifacts captured: no

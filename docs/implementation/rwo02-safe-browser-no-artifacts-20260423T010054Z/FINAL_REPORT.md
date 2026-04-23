# RWO-02 Safe Browser No-Artifacts Report

RUN_ID: `20260423T010054Z`

## Verdict

`RWO02_MINIMAL_SAFE_BROWSER_SMOKE_PASS_WITH_REMAINING_BROWSER_MIGRATION_GAPS`

## Scope

- Work Order: RWO-02
- Browser mode: no-live ORCA, route-stubbed local browser smoke
- Safe harness: `web-client/scripts/run-safe-playwright-no-artifacts.mjs`
- Safe config: `playwright.no-artifacts.config.ts`
- Passing spec: `tests/e2e/safe-no-artifacts/charts-missing-context-recovery.safe.spec.ts`

## Actions

1. Added a dedicated Playwright config with `trace`, `screenshot`, and `video` set to `off`.
2. Added a wrapper that rejects selected specs before execution when they import the artifact-capturing common fixture or contain explicit screenshot/HAR/trace/video/raw-network artifact patterns.
3. Added a minimal no-live Charts fail-closed smoke that uses direct `@playwright/test` fixtures and route stubs, not the artifact-capturing shared fixture.
4. Ran the minimal smoke with MSW disabled so page route stubs controlled the session and chart shell.
5. Verified no retained HAR, trace, video, screenshot, or raw-network files under `test-results/no-artifacts`.

## Commands

| Command | Result | Notes |
|---|---|---|
| `npm run --prefix web-client test:e2e:no-artifacts -- --dry-run --run-id 20260423T010054Z tests/e2e/safe-no-artifacts/charts-missing-context-recovery.safe.spec.ts` | PASS | Wrapper accepted the safe spec. |
| `npm run --prefix web-client test:e2e:no-artifacts -- --dry-run --run-id 20260423T010054Z tests/e2e/charts-outpatient-mainflow.spec.ts` | EXPECTED_BLOCK | Existing spec imports artifact-capturing `tests/playwright/fixtures.ts`. |
| `PLAYWRIGHT_DISABLE_MSW=1 npm run --prefix web-client test:e2e:no-artifacts -- --run-id 20260423T010054Z tests/e2e/safe-no-artifacts/charts-missing-context-recovery.safe.spec.ts` | PASS | 1 browser test passed. |
| `find test-results/no-artifacts -type f ...forbidden names...` | PASS | 0 forbidden artifact files. |
| `npm run --prefix web-client verify:web-guard` | PASS | No public secret, blocked route, or legacy auth drift regression. |
| `npm run --prefix web-client typecheck` | PASS | Includes pretypecheck web guard. |

## Browser Evidence

- Checked path: Charts minimal context loss fail-closed behavior.
- Business/security assertion: without sufficient encounter context, Charts shows recovery UI, disables ORCA send, and exposes a return-to-reception action.
- Live ORCA action: `not_run`.
- ORCA endpoint/target/request class: `not_applicable_no_live_browser_smoke`.
- Credentials printed or captured: `no`.
- Raw ORCA request/response body captured: `no`.
- Raw patient/insurance detail captured: `no`.
- HAR/trace/video/screenshot/raw network dump captured: `no`.

## Remaining Gaps

- RWO-03/RWO-04/RWO-05 existing browser specs still import the artifact-capturing shared fixture and, for several specs, explicitly write screenshots or artifact files.
- Those specs must be migrated or replaced with safe no-artifacts variants before they can be executed under this automation's evidence policy.
- Full browser workflow coverage remains partial; this run only closes a minimal RWO-02 safe smoke.

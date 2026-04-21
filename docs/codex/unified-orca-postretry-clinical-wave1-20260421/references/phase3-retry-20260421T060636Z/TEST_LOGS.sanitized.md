# TEST_LOGS sanitized

- node --check web-client/scripts/qa-phase3-approved-acceptmodv2.mjs: PASS (exit 0)
- focused Vitest phase3ApprovedCommandGuard / acceptmodv2IdentityGate / acceptmodv2BusinessEvidence: PASS (3 files, 55 tests, exit 0)
- npm run typecheck: FAIL (exit 2)
  - src/features/charts/__tests__/dadsClinicalInputContract.test.tsx:181 TS2322 null not assignable to LetterModulePayload | undefined
  - src/features/charts/__tests__/dadsClinicalInputContract.test.tsx:243 TS2353 readOnly is not a known property
- npm run lint: PASS_WITH_WARNINGS (exit 0, 495 warnings)
- npm run build: FAIL (exit 2, same TypeScript errors as typecheck)
- npm run test:ci: FAIL (exit 1, 3 failed files, 5 failed tests, 192 passed files, 1280 passed tests, 2 skipped)
  - src/__tests__/AppRouter.login-redirect.test.tsx: login-screen not found while facility resolving screen was shown
  - src/__tests__/WorkspaceTabBar.test.tsx: 3 timeout failures
  - src/features/administration/__tests__/AdministrationPage.connection.test.tsx: pushUrl / pushTenantId test timed out

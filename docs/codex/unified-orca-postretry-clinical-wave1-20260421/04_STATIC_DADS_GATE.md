# 04. WO-2 Static/DADS recovery

## Scope

WO-2 restores static confidence after the Phase 3 retry. It focuses on failing TypeScript/build/test gates.

## Known failures

From Phase 3 retry evidence:

- `npm run typecheck`: FAIL
- `npm run build`: FAIL
- `npm run test:ci`: FAIL

Known failing areas:

- `src/features/charts/__tests__/dadsClinicalInputContract.test.tsx`
- `AppRouter.login-redirect.test.tsx`
- `WorkspaceTabBar.test.tsx`
- `AdministrationPage.connection.test.tsx`

## Required process

1. Reproduce the failures.
2. Classify each failure:
   - introduced by ORCA postretry changes
   - clinical Wave 1 related
   - DADS/UI contract issue
   - existing but now uncovered
   - environment-only
3. Prefer fixing over waiving.
4. If waiver is unavoidable, document exact command, exact test/file, risk, follow-up owner, and Phase 4 impact.

## DADS basis allowed

Use only `references/dads_app_ui_design_rules_20260411.md`.

Allowed DADS grounds:

- important information not hidden
- labels required
- support text with conditions/examples
- placeholder not a substitute for guidance
- specific error text
- disabled avoided, or reason/enabling condition shown nearby
- readonly generally avoided for editable-looking values
- one primary action per screen/context
- button order/hierarchy consistency
- date input guidance and normalization

Do not invent DADS requirements.

## Required commands

```bash
npm run typecheck
npm run build
npm run lint
npm run test:ci
git diff --check
```

Run focused tests for changed UI/chart/DADS areas.

## WO-2 output directory

```text
docs/implementation/unified-static-dads-recovery-wo2-20260421/
```

## WO-2 acceptance

Preferred:

- typecheck/build/test:ci all green.

Fallback:

- residual failures have explicit waiver evidence.
- if residual failures affect Phase 4 confidence, `may_run_phase4=no`.

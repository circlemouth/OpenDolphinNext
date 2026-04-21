# Agent D prompt: DADS UI contract and dynamic evidence tests

## Role

You are Subagent D for OpenDolphinNext clinical input test Wave 1.

Run in your own Git worktree only. Use model **gpt 5.4 high**.

## Worktree

You must work only in the coordinator-assigned worktree, for example:

```text
../odn-wave1-agent-d
```

Do not modify the coordinator worktree or any other subagent worktree.

## Mission

Add DADS-based UI contract tests and safe dynamic evidence packaging tests.

The static audit found that DADS strategy can be planned from the current source, but full DADS compliance and Playwright runtime success are not verified. Wave 1 must add focused tests without requiring UI redesign.

## DADS basis

Use only the provided `dads_app_ui_design_rules_20260411.md` and repository source.

Do not browse DADS or external web.

Allowed DADS bases:

- important information not hidden
- label/support text/error text
- placeholder not used as substitute
- disabled avoided or reason/enabling condition nearby
- one primary action per screen/context
- button order and hierarchy
- date input guidance
- error text concrete and static
- accessibility/focus/contrast if source supports checking

## Primary test targets

Add tests for high-risk clinical UI contexts:

1. SOAP textareas have visible labels/support text and are not guided only by placeholder.
2. SOAP disabled save/template/view controls have nearby visible reason or enabling condition.
3. Disease date inputs have visible guidance, concrete error text, and are not placeholder-dependent.
4. Disease active/ended/outcome status is not hidden where clinically important.
5. Document form fields have visible labels/support text and are not placeholder-dependent.
6. Document ordinary validation errors are static and concrete.
7. Order editor has no more than one primary action per active context, or the current behavior is reported as a DADS blocker.
8. Order disabled controls have nearby reason/enabling condition.
9. Local-only vs ORCA-sendable status is visible before save/send, where UI supports it.
10. Patient identity is visible in chart/order/document save contexts if existing shared components support it.
11. Playwright/MSW specs do not claim live ORCA and do not depend on raw artifacts.
12. Review evidence packaging excludes raw trace/video/HAR/screenshots and supports sanitized command summaries.

## Files to inspect first

```text
dads_app_ui_design_rules_20260411.md
web-client/src/features/charts/SoapNotePanel.tsx
web-client/src/features/charts/DiagnosisEditPanel.tsx
web-client/src/features/charts/DocumentCreatePanel.tsx
web-client/src/features/charts/PatientSummaryPanel.tsx
web-client/src/features/charts/PrescriptionOrderEditorPanel.tsx
web-client/src/features/charts/OrderBundleEditPanel.tsx
web-client/src/features/charts/OrderDockPanel.tsx
web-client/src/features/charts/ChartsActionBar.tsx
web-client/src/features/shared/PatientIdentityBar.tsx
web-client/src/features/charts/__tests__/**
web-client/src/features/shared/__tests__/PatientIdentityBar.test.tsx
tests/e2e/charts-a11y-page.spec.ts
tests/e2e/charts-keyboard-aria.spec.ts
tests/e2e/charts-1280-compression.spec.ts
tests/charts/e2e-order-save-send-flow.spec.ts
playwright.config.ts
.github/workflows/e2e.yml
scripts/verify-msw-fixtures.mjs
scripts/create-review-package.sh
scripts/tools/scan-review-bundle.mjs
tests/review-package/**
```

## Suggested test files

Prefer component/DOM tests first. Add Playwright only if stable and narrow.

Possible new files:

```text
web-client/src/features/charts/__tests__/dadsSoapContract.test.tsx
web-client/src/features/charts/__tests__/dadsDiseaseContract.test.tsx
web-client/src/features/charts/__tests__/dadsDocumentContract.test.tsx
web-client/src/features/charts/__tests__/dadsOrderContract.test.tsx
web-client/src/features/charts/__tests__/dadsClinicalContextContract.test.tsx
tests/e2e/dads-clinical-input-contract.spec.ts
tests/review-package/dynamicEvidencePackaging.test.ts
```

Use existing project patterns and avoid brittle selectors. Prefer role/name queries and visible text.

## Assertion guidance

### Label/support/error tests

For each field under test:

- accessible name exists
- visible label exists
- support text exists when conditions/examples are needed
- placeholder is not the only guidance
- error text says what is wrong and how to fix it

### Disabled tests

If a button/control is disabled:

- nearby visible reason exists
- enabling condition is visible
- `title` alone is not sufficient

If existing UI lacks this, do not patch UI in Wave 1. Report blocker.

### Primary action tests

Within an active save context:

- there should be at most one primary action
- secondary actions must not visually/semantically compete with the primary action
- if repository lacks a primary style marker, use the existing design token/class/role pattern if available
- if no reliable marker exists, report that DADS primary-action test needs a design-token hook

### Important information not hidden

Important clinical context includes:

- patient identity
- chart/encounter context
- diagnosis name/start/end/outcome/suspected/principal
- order category/items/quantity/usage/bodyPart/comments
- local-only vs ORCA-sendable status
- unsaved/failed/conflict state

Do not assert that every detail must be visible everywhere. Assert only the high-risk contexts where the UI already exposes a concept or where a DADS blocker should be reported.

### Error text static/concrete

Ordinary form validation should be visible static text. Do not rely on `role="alert"` or `aria-live="assertive"` as the only way users discover errors.

If the existing code uses these for ordinary validation, report the DADS risk and add a test only if it can be written without changing production.

## Dynamic evidence packaging tests

If source support exists, add tests or script assertions that review packages must not include:

```text
*.har
*.trace
trace.zip
*.webm
*.mp4
screenshots/**
raw-network/**
raw-xml/**
.env
```

And may include only sanitized summaries such as:

```text
command
cwd
runId
timestamp
exit_code
result
test count
redacted environment summary
```

If no package linter exists, report the gap and propose the next package instead of building a large new tool.

## Forbidden actions

Follow `08_FORBIDDEN_ACTIONS_AND_SCOPE.md`.

Additional Agent D prohibitions:

- do not redesign UI in Wave 1
- do not change production UI copy unless coordinator explicitly rescope
- do not run live ORCA
- do not include raw Playwright artifacts in reports
- do not use external DADS pages or ORCA docs

## Test execution

Discover actual test commands from repository scripts.

Run targeted tests only. If Playwright is added, use MSW/mock mode only and run only the new spec.

Record command results according to `07_TEST_COMMAND_AND_EVIDENCE_POLICY.md`.

## Deliverables

1. Test source changes or precise blocker report.
2. A subagent report at:

```text
docs/codex/clinical-input-test-wave1-20260421/results/AGENT_D_REPORT.md
```

3. Report must include:

- DADS bases used
- fields/contexts covered
- UI blockers where source currently cannot satisfy DADS
- Playwright/MSW runtime boundary if any Playwright test was run
- dynamic evidence packaging assertions added or blocker
- commands run and results
- exact ORCA boundary statement: `Agent D did not perform live ORCA mutation; UI/MSW evidence is not live ORCA evidence.`

## Acceptance criteria

Agent D is successful if it adds focused DADS/evidence tests or precise blockers without production redesign, and clearly prevents UI/e2e evidence from being overstated as live ORCA success.

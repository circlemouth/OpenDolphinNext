# Subagent A Reopen Source/Static Scope Report

- RUN_ID: `20260421T133005Z`
- Worktree: `/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient-wo2-subagent-A-20260421`
- Branch: `codex/wo2-reopen-subagent-A-20260421`
- Base: `codex/wo2-static-dads-recovery-main-20260421`
- HEAD: `46e78149d85b54f289f544ded18d3f71a1be915b` (`docs(wo2): add static dads recovery package`)
- Scope: source/static inspection only. No Phase 3 retry rerun, Phase 4, fullflow, live ORCA mutation, CWP implementation, Python script, or production/test source edit was performed.

## Threat / Misuse Cases Considered

1. A mock result widens `LetterDetailResult` by reintroducing `letter: null`, causing downstream code to accept null where the contract only allows an omitted optional value.
2. The DADS chart contract test bypasses typing with `any`, broad casts, or `@ts-ignore`, masking a real `DiagnosisEditPanelMeta` contract mismatch.
3. The DADS expectations are weakened to broad existence checks, allowing UI regressions in read-only rationale, diagnosis visibility, date input semantics, or document validation copy to pass.

## Static Inspection Results

### `web-client/src/features/charts/__tests__/dadsClinicalInputContract.test.tsx`

- `DiagnosisEditPanelMeta` is imported from `../DiagnosisEditPanel` at line 11.
- `baseDiagnosisMeta` is explicitly typed as `DiagnosisEditPanelMeta` at lines 103-111.
- `renderDiagnosisPanel` accepts `meta: DiagnosisEditPanelMeta = baseDiagnosisMeta` and passes it to `DiagnosisEditPanel` at lines 113-114.
- `fetchLetterDetail` mock uses `mockResolvedValue({ ok: true })` at line 182. It omits `letter`; it does not set `letter: null`.
- No target-test matches were found for `@ts-ignore`, `@ts-expect-error`, `any`, `as unknown`, `as Record`, `as Partial`, `as never`, `as object`, `as LetterDetailResult`, or `letter: null`.
- DADS expectations remain specific:
  - SOAP read-only reason and disabled buttons: lines 212-219.
  - Diagnosis active row clinical state, ORCA mirror guidance, and date input type/no placeholder: lines 227-238.
  - Blocked edit visible reason and disabled disease actions: lines 248-251.
  - Document form labels, date input type/no placeholder, and concrete validation text: lines 264-280.

### `web-client/src/features/charts/letterApi.ts`

- `LetterModulePayload` is defined at lines 19-66.
- `LetterDetailResult` keeps `letter?: LetterModulePayload` at lines 84-86; no `null` union is present.
- `fetchLetterDetail` returns `letter: response.ok ? (json as LetterModulePayload) : undefined` at lines 167-178. Static result: non-OK omits via `undefined`; it does not return `null`.

## Commands Run

- `git diff --check` completed with no output.
- Static line inspection used `rg`, `nl -ba`, and `sed` only.
- No npm full test, Phase 3 retry rerun, Phase 4, fullflow, live ORCA mutation, Python, HAR/trace/video/screenshot capture, or raw network dump was executed.

## Result

PASS. The target source/static scope satisfies the requested checks:

- `DiagnosisEditPanelMeta` is imported and used for both `baseDiagnosisMeta` and `renderDiagnosisPanel`.
- `fetchLetterDetail` test mock omits `letter` instead of using `letter: null`.
- `LetterDetailResult.letter` remains optional `LetterModulePayload` and is not widened to nullable.
- The target DADS contract test has no `any`, broad cast, or TypeScript-ignore workaround.
- No DADS expectation weakening or contract widening was identified in the inspected target scope.

## Residual Risk

- This was intentionally limited to static/source inspection. Runtime behavior, full web-client test execution, and live ORCA paths were not re-run in this subagent scope.
- `letterApi.ts` still contains normal JSON boundary casts around parsed responses, but no target-test workaround or nullable `LetterDetailResult.letter` widening was found.
- No raw ORCA request/response body, patient/insurance details, credentials, cookies, authorization headers, JSESSIONID, CSRF token, password value, HAR, trace, video, screenshot, or raw network dump is included in this report.

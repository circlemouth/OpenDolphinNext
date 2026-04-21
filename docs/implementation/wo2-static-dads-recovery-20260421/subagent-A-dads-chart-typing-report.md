# Subagent A DADS chart typing report

RUN_ID: 20260421T111805Z

## Scope

- Worktree: `/Users/Hayato/Documents/GitHub/odn-wo2-subagent-dads-chart-typing`
- Branch: `codex/wo2-subagent-dads-chart-typing-20260421`
- Base: `codex/wo2-static-dads-recovery-main-20260421` at `289bea44dd157fb0ec815f94715cba8c6d3d23c0`
- Target: `web-client/src/features/charts/__tests__/dadsClinicalInputContract.test.tsx`

## Contract decision

- `LetterDetailResult.letter` is optional and absent details are represented by omission / `undefined`, not `null`. The test fixture now returns `{ ok: true }` instead of widening the production `LetterModulePayload` contract to include `null`.
- `readOnly` and `readOnlyReason` already belong to `DiagnosisEditPanelMeta`. The failure came from the test helper inferring the narrower shape of `baseDiagnosisMeta`. The test now imports and uses the production `DiagnosisEditPanelMeta` type for the fixture and render helper.
- No production contract was widened. No broad `any` was introduced.

## Threat model / misuse cases

1. A nullable letter detail fixture could normalize `null` into an accepted payload shape and hide incorrect API consumers. The fix keeps missing detail as absent data.
2. A locally inferred metadata shape could reject legitimate read-only metadata and tempt a broader, untyped workaround. The fix uses the existing production meta type.
3. A UI-only read-only flag could be mistaken for server authorization. This change only fixes test typing; it does not move or weaken server-side authorization expectations.
4. Generated verification artifacts could leak raw clinical, ORCA, or credential material. This task ran static/build/unit commands only and did not run live ORCA, Phase 3, Phase 4, mutation, HAR, trace, screenshot, or network dump capture.

## Files changed

- `web-client/src/features/charts/__tests__/dadsClinicalInputContract.test.tsx`
  - Added `DiagnosisEditPanelMeta` type import.
  - Annotated `baseDiagnosisMeta` and `renderDiagnosisPanel` with the existing production meta type.
  - Replaced `fetchLetterDetail` mock result `letter: null` with omitted `letter`.

## Validation

| Command | Exit | Notes |
| --- | ---: | --- |
| `npm run typecheck` | 0 | Passed after restoring `web-client` dependencies with `npm ci`. |
| `npm test -- --run src/features/charts/__tests__/dadsClinicalInputContract.test.tsx` | 0 | 4 tests passed. |
| `npm run build` | 0 | Passed; Vite emitted the existing large chunk warning and pruned `mockServiceWorker.js`. |

Initial `npm run typecheck` before dependency restore exited `127` because `tsc` was not present in the new worktree. `npm ci` exited `0`; it restored dependencies without changing tracked package files.

## Security / DADS impact

- DADS intent is preserved: the test still verifies visible read-only reasons and concrete validation text.
- No ORCA live execution path was touched.
- No credential, cookie, authorization token, session identifier, CSRF token, password, raw ORCA body, raw patient detail, raw insurance detail, HAR, trace, video, screenshot, or raw network dump was added.
- No docs outside this required implementation report were changed because the production auth, authorization, session, health, external connection, attachment, and audit contracts were not modified.

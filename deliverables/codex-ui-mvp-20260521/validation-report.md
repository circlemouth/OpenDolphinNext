# Codex UI MVP Validation Report

- RUN_ID: `20260521T215531Z`
- Worktree: `/Users/Hayato/Documents/GitHub/worktrees/opendolphin-ui-mvp-validation-docs`
- Base merge: `codex/ui-mvp-20260521` @ `2c2e7a1df` (`web-client: hide mobile image support identifiers`)

## 1. Scope

- guard/test/doc に限定
- 変更対象
  - `web-client/scripts/verify-ui-mvp-contract.mjs`
  - `web-client/package.json`
  - `docs/web-client/ux/mvp-ui-remediation-plan-20260521.md`
  - `deliverables/codex-ui-mvp-20260521/validation-report.md`
  - 最小限の focused tests

## 2. Safety framing

- 正本境界変更なし。ORCA / 電子カルテの source of truth は変更していない。
- 通常UIへの raw ORCA body / request id / trace id / RUN_ID の再混入を静的 guard で抑止。
- `FocusTrapDialog` の backdrop close 既定値再混入を guard で抑止。
- Mobile Images の通常ヘッダーで `RUN_ID` copy と内部 encounter 識別子を再露出しない前提を test/guard に固定。

## 3. Misuse cases covered

1. UI 実装で `var(--token)` を追加したが token 定義を忘れ、MVP 画面が silently 崩れる。
2. Dialog 実装変更で backdrop click close が既定値へ戻り、重大操作確認を意図せず閉じられる。
3. 通常UIに support/debug copy として `RUN_ID` / `traceId` / `requestId` / raw ORCA body を再表示してしまう。

## 4. Implemented validation changes

- `verify:ui-mvp-contract` を追加し、`verify:web-guard` へ組み込み。
- guard の検査項目:
  - undefined CSS custom property
  - `FocusTrapDialog` の `closeOnBackdrop = false` 既定値
  - 通常UIの support identifier visible copy cap
  - raw ORCA body wording
  - Mobile Images header での `internalPatientId` / `encounterKey` / `RUN_ID` copy 再混入
- focused tests を追加/更新:
  - `web-client/scripts/__tests__/verifyUiMvpContract.test.ts`
  - `web-client/src/features/images/pages/__tests__/MobileImagesUploadPage.deeplink.test.tsx`
  - `web-client/src/features/charts/__tests__/dadsClinicalInputContract.test.tsx`
  - `web-client/src/features/charts/__tests__/prescriptionOrderEditorPanel.orca-support.test.tsx`
  - `web-client/src/__tests__/WorkspaceTabBar.test.tsx`

## 5. Verification

| Command | Result |
| --- | --- |
| `cd web-client && npm run verify:web-guard` | Pass |
| `cd web-client && npm run typecheck` | Pass |
| `cd web-client && npm run test:ci` | Pass |
| `cd web-client && npm run build` | Pass |
| `cd web-client && npm run test:e2e:no-artifacts` | Not run |

補足:

- この worktree には `node_modules` が無かったため、ローカル検証では main repo 側の `web-client/node_modules` を worktree から参照する symlink を使用した。成果物 zip には含めない。
- `npm run build` は成功。Vite の chunk size warning は出るが fail ではない。

## 6. Remaining items

- `test:e2e:no-artifacts` は今回未実行。MVP UI validation の必須 gate 4 本は完了済み。
- shared `PatientIdentityBar` 自体の prop contract は現行 current contract に依存するため、この subagent では guard/test/doc 範囲に留め、Mobile Images 通常ヘッダーの再露出防止を優先した。

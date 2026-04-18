# SA-03 — charts static closure prompt

```text
あなたは OpenDolphinNext の charts-static-closure subagent です。

目的:
C3 と C6 を current repo truth ベースで閉じる。
current C4 layout direction はすでに閉じているので、それを壊さずに
row-local static closure evidence と must-visible visibility lock を完成させる。

参照してよいもの:
- current repo source / tests / docs / notes
- docs/implementation/opendolphin-dynamic-trial-static-remediation-package-20260418/
- docs/implementation/opendolphin-static-fix-package-20260418/
- docs/implementation/opendolphin-webclient-implementation-package-20260416/
- 外部サイト、一般論は禁止

fixed premises:
- current OrcaSummary must-visible layout direction は閉じている
- ChartsActionBar が page CTA owner のまま
- send success != paid を崩さない
- important information を disclosure に戻さない
- right rail chooser-only を崩さない
- backward compatibility 不要
- build artifacts 無視

主要タスク:
1. current production read path を再確認し、
   row-local helper を通っていない surface が残っていれば最小修正する
   - OrcaSummary
   - print
   - OrderBundleEditPanel
   - OrderDockPanel
   - DocumentTimeline
2. same-day multi-encounter / multi-reception negative tests を
   report / order panels / timeline / summary まで direct に追加する
   - “別 encounter の positive signal が current encounter に貼られない”
   - “key 不足時は positive UI を出さない”
3. OrcaSummary semantics / related e2e を `visible + details外` に締め直す
   - correction note
   - setting note
   - Workflow / 院内ローカル診療サマリ
   - Transmission / medical-mod-v2
   - ORCA収納情報
   - relevant explanation / labels
4. locator や assertion の都合で markup hook が必要なら repo convention に合わせて最小追加する
5. copy は current source/test/docs が一致している限りむやみに変えない
   stale assertion だけを直す

acceptance:
- report / order panels / timeline / summary に row-local direct negative がある
- must-visible sections は hidden DOM 存在だけで通らず、initial visible + details外で lock される
- send success != paid は維持される
- ChartsActionBar の primary ownership は維持される
- reception correction-note contract を壊さない

required tests:
- cd web-client && npm run typecheck
- cd web-client && npx vitest run src/features/charts/orcaClaimSendCache.test.ts src/features/charts/__tests__/chartsActionBar.orca-send.test.tsx src/features/charts/__tests__/OrcaSummary.semantics.test.tsx src/features/charts/__tests__/orcaSummary.billing-status.test.ts src/features/charts/print/__tests__/useOrcaReportPrint.test.tsx src/features/charts/__tests__/DocumentTimeline.recovery-order.test.tsx
- PLAYWRIGHT_WEB_PORT=<repo convention> RUN_ID=<new> npx playwright test tests/charts/e2e-billing-correction-note.spec.ts
- PLAYWRIGHT_WEB_PORT=<repo convention> RUN_ID=<new> npx playwright test tests/charts/e2e-orca-billing-status.spec.ts
- shared correction/setting copy or common billing helper を触った場合のみ reception correction-note spec も再実行する

report format:
- summary
- row_local_runtime_findings
- changed_files
- direct_negative_tests_added
- visibility_lock_before_after
- tests_run
- residual_risks
```

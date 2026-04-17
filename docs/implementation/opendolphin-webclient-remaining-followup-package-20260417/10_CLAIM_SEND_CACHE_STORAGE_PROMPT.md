# Task 10 — ORCA claim-send cache storage contract hardening

## ゴール
`web-client/src/features/charts/orcaClaimSendCache.ts` の sessionStorage 永続化を、repo 内の security contract に合わせて是正する。
`invoiceNumber` と `medicalWarnings` は sessionStorage に保存しない。
必要な UI は volatile memory と fail-close で維持し、機微情報の永続化を増やさない。

## 使用可能情報
- repo 実体
- `docs/web-client/ux/dads_app_ui_design_rules_20260411.md`
- `docs/implementation/opendolphin-webclient-implementation-package-20260416/`
- `artifacts/review-bundles/OpenDolphin_WebClient-review-package-curated-20260417T101132Z.zip`
- この prompt と docset
- 外部サイト、一般論、記憶補完は禁止

## 固定前提
- 3 ペイン責務固定
- patient context 非永続
- `finish` と `send` は分離
- right rail chooser-only
- `送信済` と `会計済み` は非統合
- `send success != paid`
- important info を disclosure に隠さない
- unknown は gate として残し、fail-close fallback を添える
- 後方互換性不要
- TODO / shim / format-only change 禁止

## 既知事実
- `web-client/notes/security-spec.md` は `orca-claim-send` / `orca-income-info` で請求番号や警告詳細を保存しないと明記している
- `web-client/src/features/charts/orcaClaimSendCache.ts` の型コメントも `invoiceNumber/medicalWarnings は PHI になり得るため永続化しない` と書いている
- しかし current `saveOrcaClaimSendCache()` 実装は `medicalWarnings` を payload に入れて sessionStorage に保存している
- charts correction-note spec は raw sessionStorage seed で `invoiceNumber` と `medicalWarnings` を直接入れており、current storage contract とずれている
- correctionKind / correctionReason は既存の safe note channel 候補として存在する

## repo touchpoints
- `web-client/src/features/charts/orcaClaimSendCache.ts`
- `web-client/src/features/charts/orcaBillingStatus.ts`
- `web-client/src/features/charts/OrcaSummary.tsx`
- `web-client/src/features/charts/OrderBundleEditPanel.tsx`
- `web-client/src/features/charts/OrderDockPanel.tsx`
- `web-client/src/features/charts/__tests__/orcaSummary.billing-status.test.ts`
- `web-client/src/features/charts/orcaClaimSendCache.test.ts`
- `tests/charts/e2e-billing-correction-note.spec.ts`
- `tests/charts/e2e-orca-billing-status.spec.ts`

## subagent 利用
以下 2 本を `gpt 5.4 high` で起動する
1. `claim_send_storage_contract_probe`
2. `claim_send_consumer_impact_probe`

## non-goal
- patient context persistence や storage resume の導入
- invoiceNumber / medicalWarnings を別 key に分けて永続化する変更
- `send success != paid` を崩す変更
- correction note / setting note を generic memo に混ぜる変更
- raw warning payload を disclosure の奥に隠して誤魔化す変更

## 実装方針
1. `saveOrcaClaimSendCache()` の serialized payload から `invoiceNumber` と `medicalWarnings` を除外する
2. volatile memory 側には必要最小限で warning detail を残してよい
3. reload 後に warning detail が無い場合は detail list を invent しない。既存 contract が許す generic correction note または fail-close にとどめる
4. `getOrcaClaimSendEntry()` / `loadOrcaClaimSendCache()` / normalize path が PHI を復元しないよう揃える
5. raw sessionStorage seed を使う tests は current contract に合わせて直す
6. sessionStorage serialization を検査する unit test を追加または更新する
7. current docs が既に正しいなら docs は広げない。必要最小限の inline comment/test update に留める

## acceptance
- sessionStorage に保存される `charts:orca-claim-send:*` payload に `invoiceNumber` と `medicalWarnings` が含まれない
- volatile memory と fail-close で UI が壊れない
- correction note runtime が成立する場合も raw warning detail を永続化していない
- touched unit tests が pass する
- `tests/charts/e2e-billing-correction-note.spec.ts` と `tests/charts/e2e-orca-billing-status.spec.ts` の前提が current storage contract と矛盾しない
- fixed premise drift がない

## run tests
- `cd web-client && npm run typecheck`
- touched unit/component tests
- `PLAYWRIGHT_WEB_PORT=<repo convention> RUN_ID=<new> npx playwright test tests/charts/e2e-billing-correction-note.spec.ts`
- `PLAYWRIGHT_WEB_PORT=<repo convention> RUN_ID=<new> npx playwright test tests/charts/e2e-orca-billing-status.spec.ts`

## report format
- summary
- root_cause
- changed_files
- persisted_vs_volatile_contract_after_fix
- affected_tests_updated
- tests_run
- residual_risks

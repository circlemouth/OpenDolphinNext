# ORCA Order Remediation Notes (2026-04-03)

- Worktree: `C:/wt/odn-orca-treatment-general-20260403T235043Z`
- Scope: treatment/general の material code contract, rowRole round-trip, material validation parity, warning focus, server strictness の回帰固定

## Final Contract

- `treatmentOrder` を canonical entity とし、`generalOrder` は ingress alias のみとする。
- `classCode=400`, `classCodeSystem=Claim007`, `className=処置` を保存・送信で不変に保つ。
- `bundleName`, `admin`, `memo`, `adminMemo`, `item.memo` は treatment では local-only として扱い、ORCA 送信 payload には載せない。
- bodyPart は first-class のまま扱い、treatment/radiology でのみ保持する。
- treatment/general の coded row は sendable code のみ許可し、非 sendable material code は保存前に reject する。
- `rowRole` は memo prefix ではなく明示 carrier で保持し、save -> fetch -> reopen -> normalize で意味が変わらないようにする。

## Regression Coverage Added

- `web-client/src/features/charts/__tests__/orderBundleValidation.test.ts`
  - sendable 9桁 material code を許可
  - code なし material row を `uncoded_material_item` で block
  - name なし material row を `invalid_material_item` で block
- `web-client/src/features/charts/__tests__/orderBundleOrcaSupport.test.tsx`
  - treatment input set 反映後の warning focus を bodyPart/main/material/comment の順で検証
  - material/comment の rowRole が UI 上の DOM id と整合することを確認
- `web-client/src/features/charts/__tests__/orderRpNormalization.test.ts`
  - treatment bundle の normalize 順を bodyPart -> main -> material -> comment に固定
- `web-client/src/features/charts/__tests__/chartsActionBar.orca-send.test.tsx`
  - treatment warning を送信 cache に保存した際の sourceKind/sourceItemIndex を検証
- `web-client/src/features/charts/__tests__/orderBundleApi.test.ts`
  - memo carrier から `rowRole` を復元する save/fetch round-trip を追加
- `server-modernized/src/test/java/open/dolphin/rest/orca/OrcaChartSupportSupportTest.java`
  - treatment bodyPart/material/comment の XML 出力順を検証
- `server-modernized/src/test/java/open/dolphin/rest/orca/OrcaOrderBundleRecommendationSupportTest.java`
  - treatment template で bodyPart/main/material/comment を分離して復元することを検証
- `server-modernized/src/test/java/open/dolphin/rest/orca/OrcaOrderBundleResourceTest.java`
  - invalid bodyPart code と non-sendable material code の direct API reject を検証

## Verification Result

- `npm --prefix web-client test -- --run src/features/charts/__tests__/orderBundleApi.test.ts src/features/charts/__tests__/orcaOrderInputSetApi.test.ts`
  - pass
- `npm --prefix web-client test -- --run src/features/charts/__tests__/orderBundleValidation.test.ts src/features/charts/__tests__/orderRpNormalization.test.ts`
  - pass
- `npm --prefix web-client run typecheck`
  - pass
- `npm --prefix web-client test -- --run src/features/charts/__tests__/orderBundleValidation.test.ts src/features/charts/__tests__/orderBundleOrcaSupport.test.tsx src/features/charts/__tests__/orderSendSmoke.test.ts src/features/charts/__tests__/orderRpNormalization.test.ts src/features/charts/__tests__/chartsActionBar.orca-send.test.tsx src/features/charts/__tests__/orderBundleApi.test.ts src/features/charts/__tests__/orcaOrderInputSetApi.test.ts`
  - fail
  - `orderBundleValidation.test.ts` と `orderRpNormalization.test.ts` は pass
  - `chartsActionBar.orca-send.test.tsx` は `isSendableMedicalModV2Code is not defined` で fail
  - `orderBundleOrcaSupport.test.tsx` は warning focus の activeElement 期待で fail
- `mvn -f pom.server-modernized.xml -pl api-contract,server-modernized -am -Dsurefire.failIfNoSpecifiedTests=false -Dtest=OrcaChartSupportSupportTest,OrcaOrderBundleRequestSupportTest,OrcaOrderBundleResourceTest,OrcaOrderBundleMutationSupportTest,OrcaOrderBundleRecommendationSupportTest test`
  - 未実行: この環境に `mvn` が存在しない

## Remaining Blockers

- `chartsActionBar.orca-send.test.tsx` は runtime で `isSendableMedicalModV2Code is not defined` を拾っており、send 系の最終 green は main-code 側の修正待ち。
- `orderBundleOrcaSupport.test.tsx` の warning focus は bodyPart/main/material/comment の順で固めたが、activeElement 期待の安定化をもう一段確認したい。
- server 側は今回の追加 test で strictness を固定したが、実行結果は `mvn` が使える環境で再取得する。

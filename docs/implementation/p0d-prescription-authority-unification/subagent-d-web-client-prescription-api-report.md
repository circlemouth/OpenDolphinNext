# Subagent D Report

RUN_ID: `20260514T202716Z`

## 対応概要

- web-client の処方 mutation を旧 `POST /api/local/prescription-orders` から `/api/local/prescription-orders/authority` へ移行した。
- `finalizePrescriptionAuthority` だけでなく `savePrescriptionOrder` も authority draft create を使うように統一した。
- 旧 local write route を前提にしていたテストと QA fallback script を authority route 前提へ更新した。
- UI current contract に、`PrescriptionOrderEditorPanel` の保存が authority draft route を使い、薬剤 0 件 payload を fail-closed で拒否することを追記した。

## 変更ファイル

- [web-client/src/features/charts/prescriptionOrderApi.ts](/Users/Hayato/Documents/GitHub/worktrees/p0d-web-client-prescription-api/web-client/src/features/charts/prescriptionOrderApi.ts)
- [web-client/src/features/charts/__tests__/prescriptionOrderApi.test.ts](/Users/Hayato/Documents/GitHub/worktrees/p0d-web-client-prescription-api/web-client/src/features/charts/__tests__/prescriptionOrderApi.test.ts)
- [web-client/src/features/charts/__tests__/prescriptionOrderLocalRoundtripBoundary.test.ts](/Users/Hayato/Documents/GitHub/worktrees/p0d-web-client-prescription-api/web-client/src/features/charts/__tests__/prescriptionOrderLocalRoundtripBoundary.test.ts)
- [web-client/src/features/charts/__tests__/orderSendSmoke.test.ts](/Users/Hayato/Documents/GitHub/worktrees/p0d-web-client-prescription-api/web-client/src/features/charts/__tests__/orderSendSmoke.test.ts)
- [web-client/scripts/qa-fullflow-weborca.mjs](/Users/Hayato/Documents/GitHub/worktrees/p0d-web-client-prescription-api/web-client/scripts/qa-fullflow-weborca.mjs)
- [web-client/notes/ui-current-contract.md](/Users/Hayato/Documents/GitHub/worktrees/p0d-web-client-prescription-api/web-client/notes/ui-current-contract.md)

## 医療安全・セキュリティ観点

- 旧 local write endpoint への fallback を削除し、処方 mutation surface を authority route へ限定した。
- 保存と確定の両方で、請求コメントの fail-closed validation を client 側でも一貫適用した。
- 薬剤 0 件や削除マーカーだけの payload は authority draft を作らず reject するようにし、空の処方正本イベントを作らないようにした。
- 処方確定 UI の患者識別再掲、ORCA warning/UNKNOWN 初期表示ポリシーは変更していない。

## テスト・検証

- `cd web-client && npm ci`
- `cd web-client && npm test -- --run src/features/charts/__tests__/prescriptionOrderApi.test.ts src/features/charts/__tests__/prescriptionOrderLocalRoundtripBoundary.test.ts src/features/charts/__tests__/orderSendSmoke.test.ts`
  - 32 tests passed
- `cd web-client && npm run typecheck`
  - success
- `verify:web-guard`
  - `verify:no-public-secrets`
  - `verify:no-blocked-orca-route-strings`
  - `verify:no-direct-orca-proxy-config`
  - `verify:no-local-patient-mutation`
  - `verify:no-legacy-auth-drift`
  - `verify:medical-safety-ui-copy`

## 残リスク

- 今回の web-client 範囲では authority `prescriptionId` を読取 projection から再利用できないため、`savePrescriptionOrder` は毎回 authority draft create を呼ぶ。server/read-model 側が authority draft の再編集識別子を返すよう統合されるまでは、繰り返し保存で複数 DRAFT が増える可能性が残る。
- 旧 local read endpoint (`GET /api/local/prescription-orders`) 自体は read projection として引き続き参照している。write 非使用の契約はテストで固定したが、read model の authority 同期可否は別サブタスク依存。

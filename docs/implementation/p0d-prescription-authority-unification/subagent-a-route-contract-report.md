# Subagent A Route Contract Report

RUN_ID: `20260514T202711Z`

## Scope

- worktree: ` /Users/Hayato/Documents/GitHub/worktrees/p0d-route-contract `
- branch: `codex/p0d-route-contract`
- focus: production public route inventory, JAX-RS route exposure, taxonomy contract

## Medical Safety / Security Boundary

- 処方正本: OpenDolphinNext `prescription_order*` と `/api/local/prescription-orders/authority*`
- 非正本: `/api/local/prescription-orders` read-only cache/projection
- ORCA 正本化の禁止: local prescription read model を ORCA または local authority mutation の代替にしない
- fail-closed misuse cases handled:
  1. 旧 local write route から確定済み処方へ再書込
  2. `do-import` 経由の encounter / patient 文脈すり替え
  3. taxonomy 外 `/api/prescriptions` や legacy local write route への誤送信再混入

## Changes

1. `server-modernized/src/main/java/open/dolphin/rest/orca/LocalPrescriptionOrderResource.java`
   - `saveOrder` と `doImport` から JAX-RS mutation annotation を除去
   - production runtime では `GET /api/local/prescription-orders` だけを公開
   - helper 自体は focused unit coverage 用に残し、comment で authority-only mutation 境界を明示

2. `server-modernized/src/main/java/open/dolphin/rest/OpenDolphinRestApplication.java`
   - `LocalPrescriptionOrderResource` を read-only cache/projection と明記
   - production prescription mutation は `/api/local/prescription-orders/authority` 配下のみと明記

3. `server-modernized/src/test/java/open/dolphin/rest/PublicRouteInventoryContractTest.java`
   - expected local route inventory から旧 `POST /api/local/prescription-orders` と `POST /api/local/prescription-orders/do-import` を削除
   - old local write/import route 不在を negative assertion 化
   - `/api/local/prescription-orders*` の mutation が authority route にしか存在しないことを明示検証

4. `server-modernized/src/test/java/open/dolphin/rest/WebXmlEndpointExposureTest.java`
   - web exposure contract に旧 local prescription write/import route 不在を追加
   - `GET /api/local/prescription-orders` と `POST /api/local/prescription-orders/authority` のみ残ることを検証

5. `docs/contracts/orca-route-taxonomy.md`
   - current route map から `do-import` を削除
   - `/api/local/prescription-orders` を read-only projection として再定義
   - mutation は `/api/local/prescription-orders/authority*` のみという taxonomy checkpoint / verification contract に更新

## Verification

実行コマンド:

```bash
mvn -f pom.server-modernized.xml -pl server-modernized -am -Dsurefire.failIfNoSpecifiedTests=false -Dtest=PublicRouteInventoryContractTest,WebXmlEndpointExposureTest test
```

結果:

- PASS
- `PublicRouteInventoryContractTest`: 3 tests, 0 failures, 0 errors
- `WebXmlEndpointExposureTest`: 2 tests, 0 failures, 0 errors
- total: 5 tests, 0 failures, 0 errors

## Residual Risks

- `LocalPrescriptionOrderResource` の legacy helper method 本体は unit coverage 互換のため残しており、HTTP public route では到達不可だがコード上は存在する。完全削除は downstream caller/test 移行と合わせて別差分で詰める余地がある。
- focused route inventory test のみ実行した。authority mutation 自体の機能回帰や DB 境界はこの差分では再実行していない。
- `docs/reference/` や `docs/implementation/` など履歴資料には旧 route string が残る可能性があるが、current public contract と production inventory には含めていない。

# P0-D Final Report

RUN_ID: `20260514T201736Z`

## Result

P0-D「処方 authority route の taxonomy 内移動と hash chain」は、統合後の実装・focused tests・docs 更新・成果物 ZIP 作成対象として完了扱いにできる状態まで解消した。

## Implemented

- 旧 local prescription write surface を production public route から除去。
  - `POST /api/local/prescription-orders`
  - `POST /api/local/prescription-orders/do-import`
  - any `PUT/PATCH/DELETE /api/local/prescription-orders*`
- `GET /api/local/prescription-orders` は read-only cache/projection 取得口としてのみ残した。
- 処方 mutation は `/api/local/prescription-orders/authority` 配下へ一本化。
- Web client の `savePrescriptionOrder` / finalize path / tests / QA helper を authority route へ移行し、旧 write endpoint fallback を削除。
- `orca_prescription_orders` を projection-only とし、repository `save` と DB trigger の両方で direct write を fail closed にした。
- `PrescriptionAuthorityRepository` の mutation lookup を `facility_id + prescription_order_id` に変更し、order id 単独 mutation を禁止。
- `X-Facility-Id` は処方 authority の権威値にせず、remote user / server-side request context から facility を解決。
- create / finalize / change / stop / cancel / reissue / resend は `prescription_order_event` に append-only event を追加し、`previous_event_hash` / `event_hash` を server-side material から計算。
- hash tamper detection と finalized direct write guard を維持・強化。

## Changed Files

- Server runtime:
  - `server-modernized/src/main/java/open/dolphin/rest/OpenDolphinRestApplication.java`
  - `server-modernized/src/main/java/open/dolphin/rest/orca/LocalPrescriptionOrderResource.java`
  - `server-modernized/src/main/java/open/dolphin/rest/orca/PrescriptionAuthorityResource.java`
  - `server-modernized/src/main/java/open/dolphin/rest/orca/PrescriptionAuthorityRepository.java`
  - `server-modernized/src/main/java/open/dolphin/rest/orca/PrescriptionOrderRepository.java`
- DB migration:
  - `server-modernized/tools/flyway/sql/V0335__orca_prescription_orders_projection_only.sql`
- Server tests:
  - `server-modernized/src/test/java/open/dolphin/rest/PublicRouteInventoryContractTest.java`
  - `server-modernized/src/test/java/open/dolphin/rest/WebXmlEndpointExposureTest.java`
  - `server-modernized/src/test/java/open/dolphin/rest/orca/PrescriptionAuthorityResourceTest.java`
  - `server-modernized/src/test/java/open/dolphin/rest/orca/PrescriptionAuthorityRepositoryFacilityTest.java`
  - `server-modernized/src/test/java/open/dolphin/rest/orca/PrescriptionOrderRepositoryTest.java`
  - `server-modernized/src/test/java/open/dolphin/db/PrescriptionAuthoritySchemaTest.java`
  - `server-modernized/src/test/java/open/dolphin/db/FreshSchemaBaselineTest.java`
- Web client:
  - `web-client/src/features/charts/prescriptionOrderApi.ts`
  - `web-client/src/features/charts/__tests__/prescriptionOrderApi.test.ts`
  - `web-client/src/features/charts/__tests__/prescriptionOrderLocalRoundtripBoundary.test.ts`
  - `web-client/src/features/charts/__tests__/orderSendSmoke.test.ts`
  - `web-client/scripts/qa-fullflow-weborca.mjs`
  - `web-client/notes/ui-current-contract.md`
- Docs:
  - `docs/contracts/orca-route-taxonomy.md`
  - `docs/contracts/prescription-authority.md`
  - `docs/contracts/prescription-authority-api.md`
  - `docs/architecture/ehr-orca-source-of-truth-boundary.md`
  - `docs/testing/ehr-orca-required-test-matrix.md`
  - `docs/implementation/p0d-prescription-authority-unification/*`

## Authority Routes

- `POST /api/local/prescription-orders/authority`
- `POST /api/local/prescription-orders/authority/{prescriptionId}/finalize`
- `POST /api/local/prescription-orders/authority/{prescriptionId}/change`
- `POST /api/local/prescription-orders/authority/{prescriptionId}/stop`
- `POST /api/local/prescription-orders/authority/{prescriptionId}/cancel`
- `POST /api/local/prescription-orders/authority/{prescriptionId}/reissue`
- `POST /api/local/prescription-orders/authority/{prescriptionId}/resend`

## Source Boundary

OpenDolphinNext 処方正本は `prescription_order` / `prescription_order_revision` / `prescription_order_item` / `prescription_order_event`。`orca_prescription_orders` は処方正本ではなく、現行 runtime では direct write を禁止する projection-only table。

## Verification

Main integrated validation:

- `mvn -f pom.server-modernized.xml -pl server-modernized -am -Dsurefire.failIfNoSpecifiedTests=false -Dtest=PublicRouteInventoryContractTest,WebXmlEndpointExposureTest,PrescriptionAuthorityResourceTest,PrescriptionAuthorityRepositoryFacilityTest,PrescriptionAuthoritySchemaTest,PrescriptionAuthorityStructuredItemTest,PrescriptionOrderRepositoryTest,FreshSchemaBaselineTest test`
  - PASS: 21 tests, 0 failures, 0 errors.
- `bash server-modernized/tools/ci/check-finalized-write-guards.sh --root "$(git rev-parse --show-toplevel)"`
  - PASS.
- `bash server-modernized/tools/ci/check-doc-links.sh`
  - PASS.
- `bash server-modernized/tools/ci/check-config-contract.sh`
  - PASS.
- `cd web-client && npm test -- --run src/features/charts/__tests__/prescriptionOrderApi.test.ts src/features/charts/__tests__/prescriptionOrderLocalRoundtripBoundary.test.ts src/features/charts/__tests__/orderSendSmoke.test.ts scripts/__tests__/orcaRouteTaxonomyGuard.test.ts`
  - PASS: 44 tests, 0 failures.
- `cd web-client && npm run verify:web-guard`
  - PASS.
- `cd web-client && npm run typecheck`
  - PASS.

Final grep checks:

- `LocalPrescriptionOrderResource.java` has no JAX-RS `@POST` / `@PUT` / `@PATCH` / `@DELETE` mutation annotation.
- Active server/web runtime source has no direct `INSERT` / `UPDATE` / `DELETE` production source write to `orca_prescription_orders`.
- Web runtime source has no direct `fetch` / `httpFetch` call to old `POST /api/local/prescription-orders`, `do-import`, or `/api/prescriptions`.
- Authority repository mutation methods call `loadOrderForUpdate(facilityId, orderId)` and pass facility into event/hash queries.

## Residual Risk

- `GET /api/local/prescription-orders` still reads the legacy projection table. It is read-only and not a mutation source.
- Web save creates an authority draft. A future enhancement should expose an authority read model carrying `prescriptionId` / current revision metadata so repeated draft saves can update clinical workflow semantics explicitly instead of creating multiple drafts.
- ORCA live transmission was intentionally not tested in this P0-D task; no raw ORCA body or credential was used.

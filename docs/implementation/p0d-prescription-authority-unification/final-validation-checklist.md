# P0-D Final Validation Checklist

RUN_ID: `20260514T201736Z`

## Usage

P0-D 統合後、A/B/C/D/E の変更を 1 つの accepted head に揃えてから、この表の `Status` を更新する。`PASS` はテストまたは guard で実証されたものだけに付ける。docs や grep だけで代用しない。

## Coverage Inventory

| Requirement | Required evidence | Current evidence in this worktree | Status |
| --- | --- | --- | --- |
| route inventory | `PublicRouteInventoryContractTest`, `WebXmlEndpointExposureTest` | expected route inventory から legacy local write/import route を削除し、authority route だけを mutation として許可 | `PASS` |
| taxonomy-external route detection | `PublicRouteInventoryContractTest`, `orcaRouteTaxonomyGuard.test.ts` | `/api/prescriptions` negative assertion を維持 | `PASS` |
| old local write route absence | `PublicRouteInventoryContractTest` で absence を assert | `POST /api/local/prescription-orders` と any `PUT/PATCH/DELETE /api/local/prescription-orders*` の absence を assert | `PASS` |
| `do-import` absence | `PublicRouteInventoryContractTest` で absence を assert | `POST /api/local/prescription-orders/do-import` の absence を assert | `PASS` |
| facility header spoofing | `PrescriptionAuthorityResourceTest`, `PatientModV2OutpatientResourceIdempotencyTest` | `X-Facility-Id` 偽装を無視し、remote user facility を repository へ渡す検証あり | `PASS` |
| cross-facility prescription rejection | `PrescriptionAuthorityRepositoryFacilityTest` | `facility_id + prescription_order_id` lookup miss を `prescription_order_not_found` で fail closed | `PASS` |
| finalized write guard | `PrescriptionAuthoritySchemaTest`, `check-finalized-write-guards.sh` | FINAL row/revision/item overwrite/delete denial と append-only denial あり | `PASS` |
| event hash chain | `PrescriptionAuthoritySchemaTest`, `PrescriptionAuthorityRepository` | create/finalize/change/stop/cancel/reissue/resend が `insertEvent` 経由で `previous_event_hash` / `event_hash` を投入 | `PASS` |
| hash tamper detection | `PrescriptionAuthoritySchemaTest` | historical event 改ざんで `event_hash_mismatch` を検出 | `PASS` |
| `orca_prescription_orders` source write prohibition | `PrescriptionOrderRepositoryTest`, `PrescriptionAuthoritySchemaTest` | repository `save` と DB trigger が direct write を拒否 | `PASS` |
| web-client old local write endpoint non-use | `prescriptionOrderApi.test.ts`, `prescriptionOrderLocalRoundtripBoundary.test.ts`, `orderSendSmoke.test.ts` | save/finalize と smoke mocks を authority route に更新し、旧 write endpoint を fallback にしない | `PASS` |
| unauthorized prescription operation | `PrescriptionAuthorityResourceTest` | remote user/facility 欠落時は header 偽装があっても 401、repository mutation は未実行 | `PASS` |

## Final Commands

```bash
bash server-modernized/tools/ci/check-doc-links.sh
bash server-modernized/tools/ci/check-config-contract.sh
bash server-modernized/tools/ci/check-finalized-write-guards.sh --root "$(git rev-parse --show-toplevel)"
mvn -f pom.server-modernized.xml -pl server-modernized -am -Dsurefire.failIfNoSpecifiedTests=false \
  -Dtest=PublicRouteInventoryContractTest,WebXmlEndpointExposureTest,PatientModV2OutpatientResourceIdempotencyTest,PrescriptionAuthorityResourceTest,PrescriptionAuthorityRepositoryFacilityTest,PrescriptionAuthoritySchemaTest,PrescriptionAuthorityStructuredItemTest,PrescriptionOrderRepositoryTest,FreshSchemaBaselineTest \
  test
cd web-client && npm test -- --run \
  src/features/charts/__tests__/prescriptionOrderApi.test.ts \
  src/features/charts/__tests__/prescriptionOrderLocalRoundtripBoundary.test.ts \
  src/features/charts/__tests__/orderSendSmoke.test.ts \
  scripts/__tests__/orcaRouteTaxonomyGuard.test.ts
```

## Blocking Conditions

- `POST /api/local/prescription-orders` または `POST /api/local/prescription-orders/do-import` が本番 public surface に残る
- `web-client` production source が旧 local write endpoint を save fallback として保持する
- facility を `prescriptionId` 単独 lookup より後ろに押しやり、cross-facility mutation rejection を証明できない
- `orca_prescription_orders` への正本 write path を防ぐ focused test/guard がない
- unauthenticated / unauthorized prescription mutation rejection を focused test で証明できない

# P0-D Final Validation Checklist

RUN_ID: `20260514T202715Z`

## Usage

P0-D 統合後、A/B/C/D/E の変更を 1 つの accepted head に揃えてから、この表の `Status` を更新する。`PASS` はテストまたは guard で実証されたものだけに付ける。docs や grep だけで代用しない。

## Coverage Inventory

| Requirement | Required evidence | Current evidence in this worktree | Status |
| --- | --- | --- | --- |
| route inventory | `PublicRouteInventoryContractTest`, `WebXmlEndpointExposureTest` | テスト自体は存在 | `PARTIAL` |
| taxonomy-external route detection | `PublicRouteInventoryContractTest`, `orcaRouteTaxonomyGuard.test.ts` | `/api/prescriptions` negative assertion はある | `PASS` |
| old local write route absence | `PublicRouteInventoryContractTest` で absence を assert | 現在は legacy route を expected set に含めている | `BLOCKED` |
| `do-import` absence | `PublicRouteInventoryContractTest` で absence を assert | 現在は legacy route を expected set に含めている | `BLOCKED` |
| facility header spoofing | `PatientModV2OutpatientResourceIdempotencyTest` | `X-Facility-Id` 偽装を無視して remote user facility を使う検証あり | `PASS` |
| cross-facility prescription rejection | `PrescriptionAuthorityResourceTest` または repository/resource focused test | 処方 authority 専用の focused rejection test は未確認 | `BLOCKED` |
| finalized write guard | `PrescriptionAuthoritySchemaTest`, `LocalPrescriptionOrderResourceTest`, `check-finalized-write-guards.sh` | FINAL row/revision/item overwrite denial と append-only denial あり | `PASS` |
| event hash chain | `PrescriptionAuthoritySchemaTest` | `previous_event_hash` / `event_hash` を使う verifier test あり | `PASS` |
| hash tamper detection | `PrescriptionAuthoritySchemaTest` | historical event 改ざんで `event_hash_mismatch` を検出 | `PASS` |
| `orca_prescription_orders` source write prohibition | repository/schema focused test or repo guard | 専用 focused test / guard を未確認 | `BLOCKED` |
| web-client old local write endpoint non-use | `prescriptionOrderApi.test.ts` などで authority-only を assert | finalize authority path はあるが save path はまだ legacy route | `BLOCKED` |
| unauthorized prescription operation | authority resource focused test for unauthenticated/unauthorized failure | 処方 authority 専用 focused test は未確認 | `BLOCKED` |

## Final Commands

```bash
bash server-modernized/tools/ci/check-doc-links.sh
bash server-modernized/tools/ci/check-config-contract.sh
bash server-modernized/tools/ci/check-finalized-write-guards.sh --root "$(git rev-parse --show-toplevel)"
mvn -f pom.server-modernized.xml -pl server-modernized -am -Dsurefire.failIfNoSpecifiedTests=false \
  -Dtest=PublicRouteInventoryContractTest,WebXmlEndpointExposureTest,PatientModV2OutpatientResourceIdempotencyTest,PrescriptionAuthorityResourceTest,PrescriptionAuthoritySchemaTest \
  test
cd web-client && npm test -- --run \
  src/features/charts/__tests__/prescriptionOrderApi.test.ts \
  scripts/__tests__/orcaRouteTaxonomyGuard.test.ts
```

## Blocking Conditions

- `POST /api/local/prescription-orders` または `POST /api/local/prescription-orders/do-import` が本番 public surface に残る
- `web-client` production source が旧 local write endpoint を save fallback として保持する
- facility を `prescriptionId` 単独 lookup より後ろに押しやり、cross-facility mutation rejection を証明できない
- `orca_prescription_orders` への正本 write path を防ぐ focused test/guard がない
- unauthenticated / unauthorized prescription mutation rejection を focused test で証明できない

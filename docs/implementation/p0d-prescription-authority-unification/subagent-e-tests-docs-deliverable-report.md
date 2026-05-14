# 【ワーカー報告】Subagent E tests/docs/deliverable report

RUN_ID: `20260514T202715Z`

## Scope

- Worktree: `/Users/Hayato/Documents/GitHub/worktrees/p0d-tests-docs-deliverable`
- Branch: `codex/p0d-tests-docs-deliverable`
- Task: P0-D の tests / docs / deliverable support。実装の代替ではなく、required coverage inventory、route inventory after、final validation checklist、deliverable ZIP policy、README 導線を整備する。
- Legacy trees: `client/` と `server/` は未変更。

## Medical Safety / Security Preflight

- 触る正本: 処方 authority route、処方 event hash chain、`orca_prescription_orders` source boundary に関する current docs と final gate inventory。
- ORCA 正本は ORCA / WebORCA 側の診療行為・会計結果であり、local docs 更新で local authority 化しない。
- 処方確定、ORCA送信、会計送信、UNKNOWN 解消を混同しない。
- deliverable guidance には ORCA URL、Basic 認証、証明書、証明書パスワード、raw ORCA body、患者詳細を含めない。
- docs だけで未実装の安全要件を完了扱いにしない。

## Files Changed

- `docs/implementation/README.md`
- `docs/implementation/p0d-prescription-authority-unification/README.md`
- `docs/implementation/p0d-prescription-authority-unification/route-inventory-after.md`
- `docs/implementation/p0d-prescription-authority-unification/final-validation-checklist.md`
- `docs/implementation/p0d-prescription-authority-unification/deliverable-zip-policy.md`
- `docs/implementation/p0d-prescription-authority-unification/subagent-e-tests-docs-deliverable-report.md`

## Coverage Inventory Result

### Confirmed coverage exists

- route taxonomy / exposure baseline:
  - `PublicRouteInventoryContractTest`
  - `WebXmlEndpointExposureTest`
  - `web-client/scripts/__tests__/orcaRouteTaxonomyGuard.test.ts`
- facility spoofing baseline:
  - `PatientModV2OutpatientResourceIdempotencyTest`
- finalized write guard / event append-only / tamper detection:
  - `PrescriptionAuthoritySchemaTest`
  - `LocalPrescriptionOrderResourceTest`
- authority finalize path:
  - `web-client/src/features/charts/__tests__/prescriptionOrderApi.test.ts`

### Required coverage still blocked in this worktree

- old local write route absence
- `do-import` absence
- cross-facility prescription rejection
- `orca_prescription_orders` source write prohibition
- web-client old local write endpoint non-use
- unauthorized prescription operation rejection

These remain blockers because the current source still shows:

- `PublicRouteInventoryContractTest` expects legacy `POST /api/local/prescription-orders` and `POST /api/local/prescription-orders/do-import`.
- `web-client/src/features/charts/prescriptionOrderApi.ts` still saves through `POST /api/local/prescription-orders`.
- `PrescriptionAuthorityRepository.loadOrderForUpdate` still loads by `prescription_order_id` only.

## Docs Added

- [route-inventory-after.md](route-inventory-after.md): P0-D 完了後の target route inventory と current delta
- [final-validation-checklist.md](final-validation-checklist.md): required coverage inventory と final command set
- [deliverable-zip-policy.md](deliverable-zip-policy.md): reviewer ZIP include/exclude boundary と scan policy

## Checks Run

| Command | Result |
| --- | --- |
| `bash server-modernized/tools/ci/check-doc-links.sh` | PASS |
| `bash server-modernized/tools/ci/check-config-contract.sh` | PASS |
| `bash server-modernized/tools/ci/check-finalized-write-guards.sh --root "$(git rev-parse --show-toplevel)"` | PASS |
| `mvn -f pom.server-modernized.xml -pl server-modernized -am -Dsurefire.failIfNoSpecifiedTests=false -Dtest=PublicRouteInventoryContractTest,WebXmlEndpointExposureTest,PatientModV2OutpatientResourceIdempotencyTest,PrescriptionAuthorityResourceTest,PrescriptionAuthoritySchemaTest test` | PASS, 19 tests |
| `cd web-client && npm test -- --run src/features/charts/__tests__/prescriptionOrderApi.test.ts scripts/__tests__/orcaRouteTaxonomyGuard.test.ts` | PARTIAL: `verify:web-guard` PASS, then `vitest: command not found` |

Web focused test command では pretest の `verify:web-guard` が成功した。内訳:

- `verify:no-public-secrets`: PASS
- `verify:no-blocked-orca-route-strings`: PASS
- `verify:no-direct-orca-proxy-config`: PASS
- `verify:no-local-patient-mutation`: PASS
- `verify:no-legacy-auth-drift`: PASS
- `verify:medical-safety-ui-copy`: PASS

ただし `vitest` binary がこの worktree の `web-client` 実行環境に存在せず、本体の targeted test run には進めなかった。

## Residual Risks

1. route inventory docs を更新しても、legacy mutation route が code/test から除去されるまでは P0-D 完了ではない。
2. facility spoofing の既存 coverage は患者 official mutation 側であり、処方 authority 専用の cross-facility rejection proof ではない。
3. `orca_prescription_orders` write prohibition は docs 上の方針だけでは足りず、repo/schema/resource focused test または guard が必要。
4. reviewer ZIP guidance を整備しても、実 ZIP 生成時に forbidden path scan と sensitive evidence redaction を回さなければ secret/PHI 混入を防げない。

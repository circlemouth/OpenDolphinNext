# P0-D Prescription Authority Unification

RUN_ID: `20260514T201736Z`

## Goal

P0-D「処方 authority route の taxonomy 内移動と hash chain」を完了させる。

処方指示の OpenDolphinNext 正本は `opendolphin.prescription_order`、`opendolphin.prescription_order_revision`、`opendolphin.prescription_order_item`、`opendolphin.prescription_order_event` の authority family とし、全 mutation を `/api/local/prescription-orders/authority` 配下に一本化する。

## Preflight

- 触る正本: OpenDolphinNext の処方指示正本、処方 event hash chain、ORCA 診療行為送信候補の source 境界。
- ORCA 正本: ORCA 診療行為・算定・会計結果。`orca_prescription_orders` は ORCA 由来 cache/projection/read model として残す場合のみ許容し、処方正本 mutation 先にしない。
- local 正本化禁止: ORCA 由来情報や旧 local payload table を処方指示正本として扱わない。
- 確定概念の分離: 処方確定、診療録確定、ORCA 送信、会計送信を混同しない。
- 確定済み直接上書き禁止: FINAL 以降は revision/event 経由のみ。
- UNKNOWN/警告/不一致: 成功扱いに丸めない。再送は `RESEND` event として監査する。
- 二重送信防止: ORCA 送信実試験は今回対象外だが、再送判断 event と idempotency 境界を崩さない。
- 監査ログ: actor、facility、patient、prescription、event、hash chain が追跡できること。
- 患者取り違え防止 UI: UI 変更が発生する場合は重大操作 confirm で患者識別情報を再掲する。
- secret 境界: ORCA URL、Basic 認証、証明書、証明書パスワード、raw ORCA body、患者詳細を docs/evidence/zip に含めない。

## Assets And Trust Boundary

- Assets: 処方 order/revision/item/event、ORCA medical candidate、route inventory、web-client API contract、docs/contracts。
- Trust boundary: browser request、headers、payload、query、mock/test fixture は非権威。facility は authenticated remote user/session/server-side tenant context から解決する。
- Attack surface: public JAX-RS route registration、旧 local write endpoint、`orca_prescription_orders` write path、order id 単独 mutation、event rewrite、web-client fallback endpoint。

## Misuse Cases

1. 攻撃者が `X-Facility-Id` を偽装し、別施設の `prescriptionId` を finalize/change/cancel/resend する。
2. Web client または test-only 経路が旧 `POST /api/local/prescription-orders` / `do-import` を呼び、hash chain なしで処方 payload を書く。
3. アプリケーションが `orca_prescription_orders` に正本 payload を insert/update/delete し、authority table と event chain を迂回する。
4. 確定済み処方 row/revision/item を直接 UPDATE/DELETE し、revision/event を残さず内容を改変する。
5. `prescription_order_event` の過去 event、actor、timestamp、before/after summary、previous hash を改ざんし、検証が検出できない。

## Main Work Plan

1. Branch / baseline:
   - `fix/p0d-prescription-authority-unification`
   - 既存未コミット Web UI 差分は開始前差分として扱い、勝手に戻さない。
2. Subagent orchestration:
   - A: route/API 契約、旧 local write route 廃止。
   - B: DB/repository/正本境界、`orca_prescription_orders` 書込禁止。
   - C: authority service/hash chain/facility isolation。
   - D: web-client API 移行/UI 安全性。
   - E: tests/docs/deliverable。
3. Merge order:
   - C -> B -> A -> D -> E。
4. Conflict policy:
   - authority route 一本化、hash chain 必須化、facility 条件必須化を優先する。
   - 後方互換性のために旧 local write route を復活させない。
   - `orca_prescription_orders` を処方正本として再利用しない。
5. Final validation:
   - route inventory tests。
   - prescription authority/hash/facility tests。
   - schema/migration tests。
   - web-client API contract tests。
   - focused grep for old routes and unsafe writes。
6. Deliverable:
   - `deliverables/OpenDolphinNext-p0d-prescription-authority-unification-YYYYMMDD.zip`
   - source/docs/tests/reports only。`node_modules`、`target`、`dist`、`build`、cache、IDE 設定、秘密情報は除外。

## Initial Findings

- `OpenDolphinRestApplication` currently registers `open.dolphin.rest.orca.LocalPrescriptionOrderResource`.
- `LocalPrescriptionOrderResource` exposes `POST /api/local/prescription-orders` and `POST /api/local/prescription-orders/do-import`.
- `PrescriptionOrderRepository.save` inserts into `orca_prescription_orders`.
- `PrescriptionAuthorityRepository.loadOrderForUpdate` currently loads by `prescription_order_id` only.
- `PrescriptionAuthorityResource.finalizeDraft`, `transition`, and `recordResend` currently pass only `prescriptionId` to the repository mutation methods after resolving facility in the resource.
- `PublicRouteInventoryContractTest` currently expects the legacy local write routes.
- `web-client/src/features/charts/prescriptionOrderApi.ts` still calls the legacy local write endpoint for save, while finalize already calls authority create/finalize.

## Final Status Index

- [route-inventory-after.md](route-inventory-after.md)
- [final-validation-checklist.md](final-validation-checklist.md)
- [deliverable-zip-policy.md](deliverable-zip-policy.md)
- [subagent-e-tests-docs-deliverable-report.md](subagent-e-tests-docs-deliverable-report.md)

## Coverage Inventory Summary

### Confirmed existing coverage

- route taxonomy / exposure baseline:
  - `PublicRouteInventoryContractTest`
  - `WebXmlEndpointExposureTest`
  - `web-client/scripts/__tests__/orcaRouteTaxonomyGuard.test.ts`
- facility spoofing baseline:
  - `PatientModV2OutpatientResourceIdempotencyTest`
- finalized direct write guard / event append-only / tamper detection:
  - `PrescriptionAuthoritySchemaTest`
  - `LocalPrescriptionOrderResourceTest`
- authority resource fail-closed / server-side patient+encounter normalization:
  - `PrescriptionAuthorityResourceTest`
- web-client authority finalize path:
  - `web-client/src/features/charts/__tests__/prescriptionOrderApi.test.ts`

### Integration gaps still visible in this worktree

- route inventory test still expects legacy mutation routes to exist:
  - `POST /api/local/prescription-orders`
  - `POST /api/local/prescription-orders/do-import`
- web-client save path still targets `POST /api/local/prescription-orders`.
- `PrescriptionAuthorityRepository.loadOrderForUpdate` still loads by `prescription_order_id` only, so cross-facility rejection is not yet proven by focused prescription tests.
- no explicit focused test currently proves:
  - old local write route absence,
  - `do-import` absence,
  - `orca_prescription_orders` source write prohibition,
  - web-client old local write endpoint non-use,
  - unauthorized prescription operation rejection.

Subagent E does not mask these gaps with docs. They remain final-gate blockers until A/B/C/D land and the inventory in [final-validation-checklist.md](final-validation-checklist.md) turns green.

## Deliverable Guidance

- final route inventory target: [route-inventory-after.md](route-inventory-after.md)
- final validation matrix and owner/gap status: [final-validation-checklist.md](final-validation-checklist.md)
- deliverable ZIP include/exclude and scan policy: [deliverable-zip-policy.md](deliverable-zip-policy.md)

## Validation Snapshot

- doc/config/finalized-guard checks: pass
- server focused Maven suite:
  - `PublicRouteInventoryContractTest`
  - `WebXmlEndpointExposureTest`
  - `PatientModV2OutpatientResourceIdempotencyTest`
  - `PrescriptionAuthorityResourceTest`
  - `PrescriptionAuthoritySchemaTest`
  - result: 19 tests passed
- web focused command:
  - pretest `verify:web-guard`: pass
  - targeted Vitest run: blocked by missing `vitest` binary in this worktree environment

Detailed command results and residual risks are recorded in [subagent-e-tests-docs-deliverable-report.md](subagent-e-tests-docs-deliverable-report.md).

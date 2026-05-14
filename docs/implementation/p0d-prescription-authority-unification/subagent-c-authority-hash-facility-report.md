# Subagent C Report

RUN_ID: `20260514T202714Z`

## Scope

- authority resource / repository / hash chain / facility isolation only
- legacy `client/` / `server/` untouched

## Medical Safety / Trust Boundary

- 処方正本: `prescription_order` / `prescription_order_revision` / `prescription_order_item` / `prescription_order_event`
- ORCA / `X-Facility-Id` / client payload facility は authority に使わない
- 重大 misuse case:
  - `X-Facility-Id` 偽装で他施設処方を mutate する
  - 他施設の `prescriptionId` を order id 単独 lookup で mutate する
  - FINAL 後の直接更新で event を迂回する
  - event hash 改ざんを見逃す

## Implemented

1. `PrescriptionAuthorityRepository`
   - `finalizeDraft` / `transition` / `recordResend` に `facilityId` を必須化
   - mutation load helper を `facility_id + prescription_order_id` 条件へ変更
   - `nextRevision` / `summaryFromRevision` / `contentHashFromRevision` / `previousEventHash` / `setCurrentRevision` でも facility 境界を追加
   - `create` / `finalize` / `transition(change|stop|cancel|reissue)` / `resend` の event append は全て hash chain 付きのまま維持

2. `PrescriptionAuthorityResource`
   - finalize / transition / resend で authenticated facility を repository へ明示伝播
   - finalize audit success details にも resolved facility を残す

3. Tests
   - spoofed header を無視して authenticated facility を使うことを追加
   - missing facility + spoofed header でも fail closed することを追加
   - repository の facility-scoped order lookup miss で `prescription_order_not_found` になることを追加
   - 既存 schema test により finalized direct write guard / event tamper detection を継続確認

4. Docs
   - authority contract / API contract に `X-Facility-Id` 非権威化と facility+order lookup を明記

## Verification

- `mvn -f pom.server-modernized.xml -pl server-modernized -am -Dsurefire.failIfNoSpecifiedTests=false -Dtest=PrescriptionAuthorityResourceTest,PrescriptionAuthorityRepositoryFacilityTest,PrescriptionAuthoritySchemaTest,PrescriptionAuthorityStructuredItemTest test`
  - PASS
- `bash server-modernized/tools/ci/check-finalized-write-guards.sh --root "$(git rev-parse --show-toplevel)"`
  - PASS

## Residual Risk

- repository の full mutation path を JPA bootstrapped integration test で通す追加余地はあるが、今回の focused gate では schema guard + resource test + repository facility lookup unit test で authority regression をカバーした
- `AbstractOrcaRestResource` の一般的な audit detail fallback 挙動までは今回のスコープ外。処方 authority mutation 自体は authenticated remote user facility だけを使う

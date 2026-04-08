# ORCA整合 完遂 検証マトリクス

このマトリクスは **完了判定** に使う。  
各 ID は、統括エージェントの最終報告で必ず `達成 / 未達` を明記すること。

## 1. Source-of-Truth / parity

| ID | 受け入れ条件 | 検証ポイント | 最低限の確認方法 |
|---|---|---|---|
| AC-SOT-01 | entity canonicalization が client/server で中央 helper に統一 | 重複 canonicalize 関数が production path に残らない | コード検索 + 関数参照確認 |
| AC-SOT-02 | `prescriptionOrder -> medOrder` alias が client/server 一致 | canonical helper で同じ結果 | unit test 追加 |
| AC-SOT-03 | charge / radiology canonicalization の独自 map が廃止または catalog 委譲のみ | `OrcaChargeClassSupport` / `OrcaChargeClassCanonicalSupport` | server test + grep |
| AC-SOT-04 | input-set metadata の `200..299` / `300..399` broad fallback がない | `OrcaOrderInputSetMetadataSupport` | server test + grep |
| AC-SOT-05 | `otherOrder` に `800..890` / `8...|18...` 契約が残らない | client/server save-side contract | grep + request/save test |
| AC-SOT-06 | comment family regex 直書きが helper 委譲へ寄っている | client/server production path | grep + code review |
| AC-SOT-07 | `radiologyOrder` の UI / docs / fixture label が `画像診断` に統一 | `放射線` hardcode を除去 | grep |

## 2. Comment family / selection comment / first-class prescription save

| ID | 受け入れ条件 | 検証ポイント | 最低限の確認方法 |
|---|---|---|---|
| AC-COM-01 | bundle path と first-class prescription save path が同じ family rule を使う | helper 委譲、重複実装なし | client/server code review |
| AC-COM-02 | unknown structured family を client/server とも reject | first-class save と bundle mutation の両方 | client/server test |
| AC-COM-03 | supported family の required value 未設定は reject | note/value 検証 | client/server test |
| AC-COM-04 | `Item_Number / Item_Number_Branch` が outbound 不可 | save/send/server/XML | existing + updated tests |
| AC-COM-05 | selection comment は local-only 情報だけ保持し、wire へ出さない | payload/XML | send smoke + resource test |

## 3. medOrder / injectionOrder / charge / otherOrder

| ID | 受け入れ条件 | 検証ポイント | 最低限の確認方法 |
|---|---|---|---|
| AC-MED-01 | med raw class を潰さない | DTO/source bundle round-trip | client test |
| AC-MED-02 | tri-state generic flag を保持 | DTO/send/source helper | client test |
| AC-MED-03 | `genericChangeAllowed` が round-trip で残る | `StoredDrugMeta` / source bundle | client test |
| AC-MED-04 | RP-level structured claim comment note が round-trip で残る | `85/831` note | client test |
| AC-MED-05 | usage send-block が効く | med + admin/adminCode | existing tests |
| AC-INJ-01 | injection allow/block が exact | `332/335/352` block 維持 | client/server tests |
| AC-INJ-02 | `admin/adminCode/adminMemo/speed` が wire に出ない | payload/XML | send smoke + server test |
| AC-INJ-03 | synthetic admin row を作らない | normalization | client test |
| AC-CHG-01 | charge exact class / name 契約を維持 | base / instraction | client/server tests |
| AC-CHG-02 | mixed-class charge bundle を server 単独で reject | mutation validation | server tests |
| AC-OTH-01 | otherOrder は local-only + send-block | send path | client/server tests |
| AC-OTH-02 | otherOrder save-side に legacy ORCA shape がない | request/save path | client/server tests |

## 4. treatment / surgery / test / physiology / bacteria / radiology

| ID | 受け入れ条件 | 検証ポイント | 最低限の確認方法 |
|---|---|---|---|
| AC-TRT-01 | treatment allow=`400/401/402/403/409` exact | save/send/server | client/server tests |
| AC-TRT-02 | treatment class-aware grammar が働く | `401/402/403` standalone | client/server tests |
| AC-TRT-03 | treatment bodyPart reject が read/display まで閉じる | resurrection なし | client/server tests |
| AC-SUR-01 | surgery allow/block exact | `500/501/502/510` vs `520/540/541/542` | client/server tests |
| AC-SUR-02 | surgery `501/502` standalone を潰さない | main-row rule | client/server tests |
| AC-SUR-03 | surgery rowRole semantics が validation/persistence/fetch で一致 | `material` の挙動 | server tests |
| AC-TST-01 | test save/send/server が exact allowlist fail-close | `600/601/602/603/610` only | client/server tests |
| AC-TST-02 | `640/643` reject を維持 | save/send/server | existing tests |
| AC-PHY-01 | physiology local save/fetch 可 | client save hard-block なし | client/server tests |
| AC-PHY-02 | physiology send-block | import-only entity | smoke test |
| AC-PHY-03 | physiology `classCode=600 exact` | allowlist exact enforcement | client/server tests |
| AC-BAC-01 | bacteria local save/fetch 可 | local-only | client/server tests |
| AC-BAC-02 | bacteria send-block | send path | smoke test |
| AC-BAC-03 | bacteria `830/842` だけ round-trip | read/write strict | client/server tests |
| AC-RAD-01 | radiology allow/block exact | `700/701/702/703/704/731/732` vs `710..724` | client/server tests |
| AC-RAD-02 | radiology bodyPart は `700` のみ | save/send/server/UI | client/server tests |
| AC-RAD-03 | radiology read/display/fetch に legacy bodyPart resurrection がない | `002` fallback 削除 | client/server tests |

## 5. Help / docs / tests

| ID | 受け入れ条件 | 検証ポイント | 最低限の確認方法 |
|---|---|---|---|
| AC-HLP-01 | injection help text が current wire contract を説明 | `OrderBundleEditPanel.tsx` | snapshot/text test |
| AC-HLP-02 | `orderBundleOrcaSupport.test.tsx` が help text に同期 | stale expectation なし | client test |
| AC-HLP-03 | `orderBundleBodyPart.test.tsx` が treatment bodyPart reject に同期 | stale expectation なし | client test |
| AC-HLP-04 | radiology notes が exact class map に同期 | note wording | docs review |
| AC-HLP-05 | `放射線` fixture/stale label が残らない | tests/fixtures/UI | grep + tests |

## 6. 必須テストセット

### client targeted
```bash
cd web-client
npm ci
npm run typecheck
npm run test:ci -- src/features/charts/__tests__/prescriptionOrderApi.test.ts
npm run test:ci -- src/features/charts/__tests__/orderRpNormalization.test.ts
npm run test:ci -- src/features/charts/__tests__/chartsActionBar.orca-send.test.tsx
npm run test:ci -- src/features/charts/__tests__/orderBundleOrcaSupport.test.tsx
npm run test:ci -- src/features/charts/__tests__/orderBundleBodyPart.test.tsx
npm run test:ci -- src/features/charts/__tests__/orderSendSmoke.test.ts
npm run test:ci -- src/features/charts/orderBundleApi.600-subtype.test.ts
npm run test:ci -- src/features/charts/OrderBundleEditPanel.600-subtype.test.tsx
npm run test:ci
npm run build
```

### server targeted
```bash
mvn -f pom.server-modernized.xml -pl server-modernized -am   -Dtest=OrcaPrescriptionOrderResourceTest,OrcaOrderBundleRequestSupportTest,OrcaOrderBundleMutationExecutionSupportTest,OrcaOrderBundleFetchSupportTest,OrcaOrderBundle600SubtypeSupportTest,OrcaOrderBundleMutationSupportTest,OrcaOrderBundleRecommendationSupportTest,OrcaOrderBundleResourceTest   -Dsurefire.failIfNoSpecifiedTests=false test
mvn -f pom.server-modernized.xml -pl server-modernized -am test
mvn -f pom.server-modernized.xml -pl server-modernized -am verify
mvn -f pom.server-modernized.xml -pl server-modernized -am -Pstatic-analysis verify
```

## 7. grep gate

以下は完了時に確認する。**説明できない hit は未完了**。

```bash
rg -n "800\.\.890|8\.\.\.\|18\.\.\." web-client/src server-modernized/src/main
rg -n "200\.\.299|300\.\.399" server-modernized/src/main
rg -n "startsWith\(['"]7['"]\)" web-client/src server-modernized/src/main
rg -n "放射線" web-client/src server-modernized/src
rg -n "002" web-client/src/features/charts server-modernized/src/main/java/open/dolphin/rest/orca
rg -n "isSendableInjectionAdminCode" server-modernized/src/main/java/open/dolphin/rest/orca
```

## 8. 最終報告テンプレート

```text
[総合判定]
完了 / 未完了

[acceptance results]
AC-SOT-01: 達成
...
AC-HLP-05: 達成

[変更ファイル]
- client:
- server:
- tests:
- docs:

[実行コマンド]
- ...
- result: pass/fail

[grep gate]
- command:
- result:
- justification:

[残課題]
- 0 件
```

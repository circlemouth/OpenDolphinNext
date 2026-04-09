# ORCA残タスク 受け入れ条件・検証マトリクス

このマトリクスは **完了判定そのもの** に使う。Codex の最終報告では各 ID を `達成 / 未達 / 該当なし` で必ず埋めること。

## 1. P0 blocker

| ID | 受け入れ条件 | 最低限の確認方法 |
|---|---|---|
| AC-P0-01 | injection の `admin/adminCode/adminMemo/speed` が local save/fetch では保持され、send payload/XML には出ない | client test + server test + smoke |
| AC-P0-02 | injection server validation に `admin -> adminCode required` の wire 前提が残らない | server test + code review |
| AC-P0-03 | med usage send-block が first-class prescription save / send / server resource で閉じる | client test + server test |
| AC-P0-04 | med send payload/XML に usage/admin/adminCode/adminMemo が出ない | smoke + XML builder review |
| AC-P0-05 | RP-level structured claim comment `note` が source bundle 経由でも round-trip する | client test |
| AC-P0-06 | otherOrder save-side が explicit local-only contract に置き換わり、legacy `800..890` / `8...|18...` が消える | grep + client/server tests |
| AC-P0-07 | surgery `501/502` standalone が client/server で成立する | client/server tests |
| AC-P0-08 | surgery rowRole `material` semantics が validation / persistence / fetch で一致する | round-trip server test |
| AC-P0-09 | stale help / tests / notes が current behavior に同期する | text/snapshot tests + docs review |
| AC-P0-10 | targeted tests / full tests / build / verify / static-analysis の証跡が揃う | 実行ログ |

## 2. P1 closure

| ID | 受け入れ条件 | 最低限の確認方法 |
|---|---|---|
| AC-P1-01 | client の entity canonicalization 重複が消え、中央 helper 委譲に統一される | code review + grep |
| AC-P1-02 | server の charge / radiology canonicalization が catalog 委譲に統一される | code review + server tests |
| AC-P1-03 | testOrder save/send/server が exact allowlist fail-close を共有する | client/server tests |
| AC-P1-04 | testOrder で `640/643` だけでなく allowlist 外全体 reject が save でも効く | client tests |
| AC-P1-05 | already-fixed 領域の no-regression tests が追加されている | test diff + pass logs |

## 3. P2 hardening

| ID | 受け入れ条件 | 最低限の確認方法 |
|---|---|---|
| AC-P2-01 | `PrescriptionOrderEditorPanel` の `usageCode <- adminMemo` が修正される | client test |
| AC-P2-02 | `isSendableInjectionAdminCode` など stale helper の扱いが説明可能になる | code review + grep |
| AC-P2-03 | grep gate を再現可能な形で運用できる | command log |

## 4. no-regression checklist

| ID | 維持すべき挙動 | 最低限の確認方法 |
|---|---|---|
| NR-01 | physiology: import-only + local save/fetch 可 + send-block + `classCode=600 exact` | client/server tests |
| NR-02 | bacteria: local-only + `830/842` strict + send-block | client/server tests |
| NR-03 | radiology: allow/block exact + bodyPart は `700` のみ | client/server tests |
| NR-04 | selection comment `Item_Number / Item_Number_Branch` outbound block | client/server tests |
| NR-05 | first-class prescription unknown structured family reject | client/server tests |
| NR-06 | `genericChangeAllowed` round-trip | client test |

## 5. 必須 client コマンド

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
npm run test:ci
npm run build
```

## 6. 必須 server コマンド

```bash
mvn -f pom.server-modernized.xml -pl server-modernized -am \
  -Dtest=OrcaPrescriptionOrderResourceTest,OrcaOrderBundleRequestSupportTest,OrcaOrderBundleMutationExecutionSupportTest,OrcaOrderBundleFetchSupportTest,OrcaOrderBundle600SubtypeSupportTest,OrcaOrderBundleMutationSupportTest,OrcaOrderBundleRecommendationSupportTest,OrcaOrderBundleResourceTest \
  -Dsurefire.failIfNoSpecifiedTests=false test

mvn -f pom.server-modernized.xml -pl server-modernized -am test
mvn -f pom.server-modernized.xml -pl server-modernized -am verify
mvn -f pom.server-modernized.xml -pl server-modernized -am -Pstatic-analysis verify
```

## 7. grep gate

説明できない hit は未完了。

```bash
rg -n "800\.\.890|8\.\.\.\|18\.\.\." web-client/src server-modernized/src/main
rg -n "isSendableInjectionAdminCode" web-client/src server-modernized/src/main
rg -n "usageCode\s*<-\s*adminMemo|adminMemo.*usageCode|usageCode.*adminMemo" web-client/src
rg -n "4101|4102|4103" web-client/src/features/charts/__tests__ server-modernized/src/test
rg -n "adminCode required|usageCode required" server-modernized/src/main/java/open/dolphin/rest/orca
rg -n "放射線" web-client/src web-client/notes server-modernized/src
rg -n "resolveCanonicalClassName|OrcaChargeClassCanonicalSupport|OrcaChargeClassSupport" server-modernized/src/main/java/open/dolphin/rest/orca
```

## 8. 追加で見るべき差分観点

- med/injection send path に local-only row prepend が残っていないか
- surgery rowRole を fetch/recommendation が別名で返していないか
- otherOrder contract が entity 主導になっているか
- testOrder save validation が `640/643` 以外も reject するか
- no-regression 領域の既存テストが壊れていないか

## 9. 最終報告必須項目

最終報告には必ず次を含める。

1. 変更ファイル一覧
2. 各 AC の達成状況
3. 実行したコマンドと結果
4. grep gate の結果
5. 失敗や保留がある場合の明示
6. 残課題 0 件確認

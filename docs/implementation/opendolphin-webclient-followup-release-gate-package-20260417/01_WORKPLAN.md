# OpenDolphin WebClient 追加作業工程表

## 目的
今回のコード差し替え後に残っている release gate 項目だけを閉じる。

## 追加作業の分類
1. correction-note contract verification
   - 区分: release-verification
   - 理由: touched spec が targeted retest から漏れている
2. runtime-ready-smoke precondition closure
   - 区分: execution / environment gate
   - 理由: 現在の失敗理由は backend 前提未充足という報告
3. web-client `npm run ci` recovery
   - 区分: code-change required
   - 理由: canonical command fail。20 failures / 5 files が残っている
4. manual QA
   - 区分: release-verification
5. ORCA live QA
   - 区分: release-verification

## 実行順
1. correction-note spec verification
2. runtime-ready-smoke precondition closure
3. web-client `npm run ci` inventory capture
4. web-client `npm run ci` recovery
5. canonical commands 再実行
6. manual QA
7. ORCA live QA

## reopen しないもの
- Reception transmission projection blocker
- OrcaSummary mount contract blocker
- Print Task 31
- history split

## stop conditions
- fixed premise drift が出たら停止して報告
- runtime-ready-smoke で backend 起動後も失敗するなら、precondition issue ではなく integration/code issue に昇格して停止
- correction-note spec が fail したら、その failure を独立 blocker として切り出して停止
- `npm run ci` を部分 pass だけで閉じたことにしない

## 完了条件
- correction-note spec が pass
- runtime-ready-smoke が pass
- `npm run ci` が pass
- `mvn -f pom.server-modernized.xml -pl server-modernized -am -Pstatic-analysis verify` が pass 維持
- manual QA 完了
- ORCA live QA 完了

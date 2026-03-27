# Phase3 Wave 3 Static Analysis Burn-down 開発ドキュメント

## 背景
- current repo を source of truth とする
- 後方互換性は考慮しない
- parent/static-analysis 方針は SpotBugs / FindSecBugs を fail-on-error のまま維持し、Checkstyle / PMD はこの wave でも対象外とする
- Wave 2 統合後の baseline は 249 -> 144 まで圧縮済み
- `mvn -f pom.server-modernized.xml -pl server-modernized -am -DskipTests compile` は通過
- `bash ./scripts/server-modernized/verify-static-analysis.sh` は SpotBugs 144 件で fail 継続
- blanket suppression / failOnError 緩和 / threshold 変更 / filter 追加は今回も禁止
- inventory 正本: `docs/server-modernization/static-analysis-baseline-inventory.md`

## 今回の狙い
- green に近い最大の削減を smallest viable diff で取る
- file overlap を避けて並列に進める
- inventory を更新し、次 wave をさらに細く切れる状態にする

## 残件サマリ
- Lane B: 35
  - `EI_EXPOSE_REP2=35`
  - 主対象: `open.dolphin.converter` / `open.dolphin.shared.converter`
  - 典型: `setModel()` の direct assignment
- Lane C: 59
  - `RCN_REDUNDANT_NULLCHECK_OF_NONNULL_VALUE=15`
  - `NP_NULL_PARAM_DEREF=12`
  - `EI_EXPOSE_REP=9`
  - `EI_EXPOSE_REP2=6`
  - 主対象: `open.dolphin.orca.service.DefaultOrcaLiveGateway`、ORCA push DTO ネスト、transport/session 周辺
- Lane D: 49
  - `EI_EXPOSE_REP2=9`
  - `NP_BOOLEAN_RETURN_NULL=8`
  - `NP_NULL_ON_SOME_PATH=4`
  - `UPM_UNCALLED_PRIVATE_METHOD=4`
  - 主対象: `open.dolphin.rest.AdminOrcaConnectionResource`, `AdminConfigResource`, `KarteResource`, `StampResource`, `MasterUpdate*`, `AuditChainVerifier`
- Lane A tail: 1
  - `SQL_PREPARED_STATEMENT_GENERATED_FROM_NONCONSTANT_STRING`
  - 主対象: `open.orca.rest.OrcaMasterKensaSortQueryService`
  - smallest viable diff では取り切れず、query shape 分割か allowlist 化が必要

## 実行レーン
### Lane B: converter / shared.converter expose-rep 一掃
- [ ] `setModel()` / `getModel()` 周辺の direct assignment / expose-rep を defensive copy で除去する
- [ ] 同一パターンを機械的に揃える
- [ ] API 契約を壊さない
- [ ] compile / SpotBugs 差分で改善を確認する

### Lane C: ORCA service / push / transport nullability・mutability 収束
- [ ] `DefaultOrcaLiveGateway` の nullability 指摘を潰す
- [ ] ORCA push DTO ネストの defensive copy 方針を決める
- [ ] `OrcaPushEnvelope` / `OrcaPushMedicalBody` 系で mutable state を露出しない
- [ ] transport / session 周辺の expose-rep / null-param 指摘を除去する
- [ ] compile / SpotBugs 差分で改善を確認する

### Lane D: admin/rest/masterupdate tail cleanup
- [ ] `NP_BOOLEAN_RETURN_NULL` を型契約で解消する
- [ ] `NP_NULL_ON_SOME_PATH` / `RCN_REDUNDANT_NULLCHECK_OF_NONNULL_VALUE` / `UPM_UNCALLED_PRIVATE_METHOD` を局所修正で除去する
- [ ] `Admin*`, `KarteResource`, `StampResource`, `MasterUpdate*`, `AuditChainVerifier` を対象に smallest viable diff で閉じる
- [ ] compile / SpotBugs 差分で改善を確認する

### Lane A tail: dynamic SQL 1 件の設計修正
- [ ] `OrcaMasterKensaSortQueryService` の dynamic SQL 指摘を解消する
- [ ] sort key / query shape を enum allowlist か分岐メソッドへ固定する
- [ ] SQL injection 回避だけでなく SpotBugs の `SQL_PREPARED_STATEMENT_GENERATED_FROM_NONCONSTANT_STRING` を消す
- [ ] compile / 可能なら対象 test で確認する

## 統合担当の必須作業
- [ ] Lane B/C/D/A の差分を衝突確認後に取り込む
- [ ] `bash ./scripts/server-modernized/verify-static-analysis.sh` を再実行する
- [ ] before / after を記録する
- [ ] `docs/server-modernization/static-analysis-baseline-inventory.md` を更新する
- [ ] なお green 未達でも、残件を package / bug code 単位で次 wave に切り出せる形に整理する

## 禁止事項
- [ ] `pom.server-modernized.xml` の `failOnError` / `threshold` / profile intent を弱めない
- [ ] blanket suppression を追加しない
- [ ] Checkstyle / PMD を有効化しない
- [ ] unrelated refactor を混ぜない
- [ ] runtime/public contract を広げない
- [ ] closed Phase2 論点を reopen しない

## 受け入れ条件
- [ ] SpotBugs baseline が material に減る
- [ ] compile は維持する
- [ ] inventory が repo に残る
- [ ] diff は smallest viable で、設計意図が追える
- [ ] 残件が次 wave に切れる粒度で整理される

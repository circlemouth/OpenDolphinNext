# Phase3+ Static Analysis Wave 2 開発ドキュメント

## 背景
WS1〜WS9 で runtime / release hardening の主タスクはほぼ反映済み。
T10-A により static-analysis workflow は truthful 化され、baseline burn-down 完了まで manual/nightly 運用へ退避済み。
T10-C により active web/admin contract cleanup は完了済み。
残る主課題は T10-B の SpotBugs / FindSecBugs baseline 圧縮である。

現時点の作業前提:
- current repo が正本
- 後方互換性は考慮しない
- delete-first / simplification を優先する
- failOnError / threshold を弱めない
- Checkstyle / PMD には広げない
- blanket suppression を入れない
- broad refactor を避ける

## 現状評価
- [x] T10-A: workflow truthful 化は完了
- [x] T10-C: active `/api/admin/delivery` cleanup は完了
- [ ] T10-B: static-analysis green 化は未達

T10-B worker report の最新結果:
- before: 329
- after: 249
- delta: -80
- canonical command: `bash ./scripts/server-modernized/verify-static-analysis.sh`
- 依然として SpotBugs check で fail
- inventory 正本: `docs/server-modernization/static-analysis-baseline-inventory.md`

残件の主クラスタ:
- Cluster A: 102
  - 主戦場: `open.dolphin.converter`, `open.dolphin.shared.converter`
  - 主 bug codes: `EI_EXPOSE_REP2`, `EI_EXPOSE_REP`
  - tail: `PlistParser` の `DE_MIGHT_IGNORE` / `REC_CATCH_EXCEPTION`
- Cluster B: 137
  - 主戦場: `open.orca.rest`
  - 主 bug codes: `UUF_UNUSED_FIELD=56`, `EI_EXPOSE_REP2`, `EI_EXPOSE_REP`, `NP_NULL_PARAM_DEREF`
  - 代表: `OrcaMasterFixtureSupport.java`, `EtensuDao.java`, `OrcaMasterKensaSortQueryService.java`, `DefaultOrcaLiveGateway.java`
- Cluster C: 1
  - `LocalMedicalSummaryService.java` の `LocalMedicalSummaryFailure.details()`
- Other / out-of-cluster: 9
  - `open.dolphin.orca.converter`, `open.dolphin.persistence.query` など

## 目的
- [ ] static-analysis baseline をさらに material に減らす
- [ ] 可能なら green にする
- [ ] 無理でも Wave 2 完了時点の before/after と残件境界を repo に固定する

## 並列レーン
### Lane A: Cluster B / open.orca.rest fixture-dead-field burn-down
- [ ] `open.orca.rest` 配下の `UUF_UNUSED_FIELD` を優先して潰す
- [ ] fixture DTO / support class の未使用 field を削除する
- [ ] 参照切れ・テスト崩れを最小差分で直す
- [ ] `open.orca.rest` 以外は触らない

### Lane B: Cluster A / converter defensive-copy burn-down
- [ ] `open.dolphin.converter` と `open.dolphin.shared.converter` に限定する
- [ ] `EI_EXPOSE_REP`, `EI_EXPOSE_REP2` を defensive copy / immutable view / field contract 修正で潰す
- [ ] public 契約を広げない
- [ ] package 境界を越えて広げない

### Lane C: Cluster B tail / ORCA-session runtime-nullability burn-down
- [ ] `open.dolphin.orca` / `open.dolphin.session` / `DefaultOrcaLiveGateway` 周辺に限定する
- [ ] `NP_NULL_PARAM_DEREF`, `EI_EXPOSE_REP`, `EI_EXPOSE_REP2` を潰す
- [ ] `open.orca.rest` 本体は Lane A 所有なので触らない

### Lane D: Tail cleanup + inventory refresh
- [ ] `PlistParser` の `DE_MIGHT_IGNORE` / `REC_CATCH_EXCEPTION` を整理する
- [ ] `LocalMedicalSummaryService.java` の残 1 件を潰す
- [ ] `open.dolphin.orca.converter`, `open.dolphin.persistence.query` など out-of-cluster 少数残件を掃除する
- [ ] A/B/C 取り込み後に `docs/server-modernization/static-analysis-baseline-inventory.md` を更新する
- [ ] 最終 before/after を記録する

## 受け入れ条件
- [ ] `bash ./scripts/server-modernized/verify-static-analysis.sh` の結果が改善している
- [ ] failOnError / threshold / exclude filter の意味を弱めていない
- [ ] Checkstyle / PMD は不変
- [ ] blanket suppression を追加していない
- [ ] before/after と残件クラスタが repo に残る

## merge 順
1. Lane A
2. Lane B
3. Lane C
4. Lane D

A/B/C は原則並列でよいが、Lane D は最後に寄せる。

## 今はやらない
- [ ] static-analysis workflow を PR trigger に戻す
- [ ] Checkstyle / PMD の有効化
- [ ] `KarteServiceBean` / `KarteLegacyArtifactSupport` の深い分割
- [ ] broad architecture cleanup

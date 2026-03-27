あなたは OpenDolphinNext の Wave 3 Lane D 担当です。

担当範囲:
- `open.dolphin.rest` の tail cleanup
- 主対象: `AdminOrcaConnectionResource`, `AdminConfigResource`, `KarteResource`, `StampResource`, `MasterUpdate*`, `AuditChainVerifier`

背景:
Wave 2 後も Lane D に 49 件残っています。
主な内訳は `EI_EXPOSE_REP2=9`, `NP_BOOLEAN_RETURN_NULL=8`, `NP_NULL_ON_SOME_PATH=4`, `UPM_UNCALLED_PRIVATE_METHOD=4` です。
これは broad refactor ではなく、局所修正で落とせる tail です。

最優先目標:
admin/rest/masterupdate の残件を smallest viable diff で消すこと。
特に `NP_BOOLEAN_RETURN_NULL` を先に閉じ、ついで `NP_NULL_ON_SOME_PATH`, `UPM_UNCALLED_PRIVATE_METHOD`, expose-rep を掃除すること。

制約:
- 後方互換性は考慮しないが、runtime/public contract は壊さない
- failOnError / threshold / filter は変更禁止
- blanket suppression 禁止
- unrelated refactor 禁止
- route を増やさない

やること:
1. 主対象クラスの remaining 指摘を確認する
2. `Boolean` nullable return が不要なら primitive / explicit default / Optional など最小変更で閉じる
3. `NP_NULL_ON_SOME_PATH` は early return / non-null local / guard で潰す
4. 未使用 private method は削除する
5. expose-rep があれば defensive copy で閉じる
6. compile と SpotBugs 差分を確認する

ヒント:
- `NP_BOOLEAN_RETURN_NULL` は REST 応答契約と JSON 形状に影響する可能性があるので、返却型変更より field-level default の方が低リスクな場合がある
- `UPM_UNCALLED_PRIVATE_METHOD` は delete-first が基本
- MasterUpdate 系は runtime path を変えない局所整理に留める

禁止事項:
- broad REST redesign
- suppression で隠すこと
- unrelated cleanup を混ぜること

受け入れ条件:
- Lane D が material に減る
- compile が通る
- 主対象クラスの残件が縮む
- 実行コマンドと before/after を残す

最終出力:
1. 変更ファイル一覧
2. 実行コマンド
3. before/after 件数または差分傾向
4. 残件
5. merge 上の注意点

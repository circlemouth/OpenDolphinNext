あなたは OpenDolphinNext の Wave 4 / WS-C 担当です。

対象:
- `open.dolphin.persistence.query` package の SpotBugs / FindSecBugs 残件

背景:
current repo では `open.dolphin.persistence.query` に 4 件残っており、すべて `EI_EXPOSE_REP2` です。

最優先目標:
`open.dolphin.persistence.query` の expose-rep を defensive copy / immutable 化で閉じること。

禁止事項:
- query semantics を変えない
- query 生成戦略を広く変えない
- `pom.server-modernized.xml` を変更しない
- blanket suppression を追加しない

やること:
1. current XML から `open.dolphin.persistence.query` の該当 class / field / line を特定する
2. mutable field / collection / array の outward exposure を defensive copy または immutable 化で閉じる
3. compile を確認する
4. query behavior に影響が出ないか差分を点検する

受け入れ条件:
- `open.dolphin.persistence.query` の 4 件が 0 になる
- compile が通る
- query semantics が不変

最終出力:
1. 変更ファイル一覧
2. 実行コマンド一覧
3. before / after 件数
4. 主要修正内容
5. 残る unknown

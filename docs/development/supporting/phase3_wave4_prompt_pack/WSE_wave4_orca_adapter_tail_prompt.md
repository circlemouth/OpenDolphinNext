あなたは OpenDolphinNext の Wave 4 / WS-E 担当です。

対象:
- `open.dolphin.orca.adapter` package の SpotBugs / FindSecBugs 残件

背景:
current repo では `open.dolphin.orca.adapter` に 3 件残っており、すべて `EI_EXPOSE_REP` です。

最優先目標:
adapter package の expose-rep 3 件を defensive copy / immutable 化で閉じること。

禁止事項:
- ORCA integration behavior を変えない
- adapter contract を広く変えない
- `pom.server-modernized.xml` を変更しない
- blanket suppression を追加しない

やること:
1. current XML から exact class / field / line を特定する
2. mutable DTO / collection の exposure を copy / immutable view に置き換える
3. compile を確認する
4. 変更が downstream converter / transport に波及していないか点検する

受け入れ条件:
- `open.dolphin.orca.adapter` の 3 件が 0 になる
- compile が通る
- integration behavior が不変

最終出力:
1. 変更ファイル一覧
2. 実行コマンド一覧
3. before / after 件数
4. 主要修正内容
5. 残る unknown

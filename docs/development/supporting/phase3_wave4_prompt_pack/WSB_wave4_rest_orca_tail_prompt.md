あなたは OpenDolphinNext の Wave 4 / WS-B 担当です。

対象:
- `open.dolphin.rest.orca` package の SpotBugs / FindSecBugs 残件

背景:
current repo では `open.dolphin.rest.orca` に 7 件残っています。
代表 bug code:
- `EI_EXPOSE_REP2`
- `HSM_HIDING_METHOD`
- `NP_BOOLEAN_RETURN_NULL`
- `RCN_REDUNDANT_NULLCHECK_OF_NONNULL_VALUE`
- `REC_CATCH_EXCEPTION`
- `UPM_UNCALLED_PRIVATE_METHOD`

最優先目標:
`open.dolphin.rest.orca` package の residual findings を smallest viable diff で潰すこと。

禁止事項:
- `pom.server-modernized.xml` を変更しない
- blanket suppression を追加しない
- ORCA route / contract を広く変えない
- unrelated cleanup を混ぜない

やること:
1. current XML から `open.dolphin.rest.orca` の該当 class / line / bug code を洗い出す
2. bug code ごとに局所修正する
   - `REC_CATCH_EXCEPTION` は narrower catch または fail-fast に寄せる
   - `HSM_HIDING_METHOD` は public contract を壊さない最小整理で閉じる
   - boolean-null / redundant nullcheck / dead private method は局所修正
   - expose-rep は defensive copy
3. compile を確認する
4. 必要なら ORCA rest 近辺の既存 test を最小限回す

受け入れ条件:
- `open.dolphin.rest.orca` の residual findings が material に減るか、理想は 0
- compile が通る
- ORCA API contract を広く変えていない

最終出力:
1. 変更ファイル一覧
2. 実行コマンド一覧
3. before / after 件数
4. 主要修正内容
5. 残る unknown

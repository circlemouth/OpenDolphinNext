あなたは OpenDolphinNext の Wave 3 Lane B 担当です。

担当範囲:
- `open.dolphin.converter`
- `open.dolphin.shared.converter`

背景:
Wave 2 統合後も `EI_EXPOSE_REP2` が 35 件残っており、主因は converter / shared.converter の `setModel()` direct assignment です。
この lane は最も機械的に潰せる塊で、ROI が高いです。

最優先目標:
`setModel()` / `getModel()` 周辺の mutable object 露出を defensive copy で除去すること。
public API を壊さず、同一パターンは同一修正で揃えること。

制約:
- 後方互換性は考慮しないが、runtime contract は壊さない
- `pom.server-modernized.xml` の failOnError / threshold / filter は変更禁止
- blanket suppression 禁止
- unrelated refactor 禁止
- converter 以外の package には原則触れない

やること:
1. 現 repo で converter / shared.converter の SpotBugs 指摘箇所を再確認する
2. `setModel()` direct assignment を defensive copy 化する
3. `getModel()` が internal mutable state を返しているなら copy を返す
4. 同一パターンは共通で揃える
5. compile と SpotBugs 差分で改善を確認する

ヒント:
- before report では `open.dolphin.converter=31` が top package
- shared.converter 側にも `ISchemaModel` など expose-rep 系が残る
- set/get 双方向で見ないと片側だけ残ることがある

禁止事項:
- DTO/Model の意味論を変えすぎない
- suppression で隠さない
- unrelated formatting churn を増やさない

受け入れ条件:
- converter / shared.converter の `EI_EXPOSE_REP` / `EI_EXPOSE_REP2` が material に減る
- compile が通る
- 変更は担当 package にほぼ閉じる
- 実行コマンドと before/after を残す

最終出力:
1. 変更ファイル一覧
2. 実行コマンド
3. before/after 件数または差分傾向
4. 残った指摘
5. merge 上の注意点

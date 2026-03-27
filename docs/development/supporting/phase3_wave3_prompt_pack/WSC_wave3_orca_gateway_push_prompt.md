あなたは OpenDolphinNext の Wave 3 Lane C 担当です。

担当範囲:
- `open.dolphin.orca.service`
- `open.dolphin.orca.transport`
- `open.dolphin.session` の ORCA push / transport に近い部分

背景:
Wave 2 後も Lane C に 59 件残っています。
主な内訳は `RCN_REDUNDANT_NULLCHECK_OF_NONNULL_VALUE=15`, `NP_NULL_PARAM_DEREF=12`, `EI_EXPOSE_REP=9`, `EI_EXPOSE_REP2=6` です。
最大の主戦場は `DefaultOrcaLiveGateway` で 23 件、加えて ORCA push DTO ネストの mutable exposure が残っています。

最優先目標:
`DefaultOrcaLiveGateway` と ORCA push DTO / transport 周辺の nullability と mutable exposure を smallest viable diff で潰すこと。

制約:
- 後方互換性は考慮しないが、runtime contract は壊さない
- failOnError / threshold / filter は変更禁止
- blanket suppression 禁止
- unrelated refactor 禁止
- route/public surface を広げない

やること:
1. `DefaultOrcaLiveGateway` の remaining SpotBugs 指摘を再確認する
2. `NP_NULL_PARAM_DEREF`, `RCN_REDUNDANT_NULLCHECK_OF_NONNULL_VALUE` を局所修正で消す
3. ORCA push DTO ネスト (`OrcaPushEnvelope`, `OrcaPushMedicalBody` など) の defensive copy 方針を実装する
4. transport / session 周辺の expose-rep を潰す
5. compile と SpotBugs 差分を確認する

ヒント:
- null response は Wave 2 で一部潰れているため、残件は nested mutable state と nullability の細部に偏っている可能性が高い
- copy constructor / factory / immutable wrapper のいずれが最小 diff かを優先して選ぶ
- redundant nullcheck は annotation / local variable split / early return で局所的に閉じられることが多い

禁止事項:
- transport protocol の意味を変える大改修
- blanket immutable 化のような大規模設計変更
- suppression で隠すこと

受け入れ条件:
- Lane C の件数が material に減る
- compile が通る
- `DefaultOrcaLiveGateway` の件数が明確に減る
- 実行コマンドと before/after を残す

最終出力:
1. 変更ファイル一覧
2. 実行コマンド
3. before/after 件数または差分傾向
4. 残る主対象
5. merge 上の注意点

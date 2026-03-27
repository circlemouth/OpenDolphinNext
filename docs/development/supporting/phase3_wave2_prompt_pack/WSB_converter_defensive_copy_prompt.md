あなたは OpenDolphinNext の Static Analysis Lane B 担当です。

対象:
- `server-modernized/src/main/java/open/dolphin/converter/**`
- `server-modernized/src/main/java/open/dolphin/shared/converter/**` 相当の shared converter / interface 群
- 必要最小限の関連 test

目的:
converter / shared.converter 周りの `EI_EXPOSE_REP`, `EI_EXPOSE_REP2` を defensive copy で削減すること。

現在わかっていること:
- Cluster A は 102 件
- 主戦場は `open.dolphin.converter`, `open.dolphin.shared.converter`
- Wave 1 では converter 群に手が入っているが、まだ defensive copy 系が多数残っている
- 代表に `IAllergyPackage.java`, `IClaimBundle.java`, `ISchemaModel.java`, `IPatientVisitModel.java` などがある

前提:
- current repo が正本
- 後方互換性は不要
- failOnError / threshold 不変
- blanket suppression 禁止
- public 契約を不必要に広げない
- open.orca.rest は Lane A 所有、open.dolphin.orca/session は Lane C 所有

やること:
1. converter / shared.converter 配下の current findings を洗う
2. `EI_EXPOSE_REP`, `EI_EXPOSE_REP2` を defensive copy / unmodifiable view / immutable value 化で潰す
3. getter / setter / constructor の mutability contract を最小限で是正する
4. serialization / JAXB 的な制約がある場合は壊さないよう注意する
5. lane 完了時に、代表的に直した設計パターンを簡潔にまとめる

禁止事項:
- blanket suppression
- package 外への拡散
- broad refactor
- semantics を変える大きな model 再設計

受け入れ条件:
- Cluster A の defensive-copy 系が material に減る
- failOnError / threshold は不変
- diff が converter / shared.converter 周辺に閉じる

最終出力:
1. 変更ファイル一覧
2. 実行コマンド
3. 落とした bug code / 件数の概算
4. 残件と注意点

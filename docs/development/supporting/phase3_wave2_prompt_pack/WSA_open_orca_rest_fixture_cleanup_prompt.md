あなたは OpenDolphinNext の Static Analysis Lane A 担当です。

対象:
- `server-modernized/src/main/java/open/orca/rest/**`
- 必要最小限の関連 test
- lane 所有外の package には触らない

目的:
`open.orca.rest` 配下の SpotBugs / FindSecBugs 残件のうち、特に `UUF_UNUSED_FIELD` を中心に大きく削減すること。

現在わかっていること:
- Cluster B が最大塊
- `UUF_UNUSED_FIELD=56` が主因
- 代表クラスに `OrcaMasterFixtureSupport.java`, `EtensuDao.java`, `OrcaMasterKensaSortQueryService.java` がある
- 現行 canonical command は `bash ./scripts/server-modernized/verify-static-analysis.sh`

前提:
- current repo が正本
- 後方互換性は不要
- failOnError / threshold は変更しない
- blanket suppression 禁止
- smallest viable diff を優先
- `open.dolphin.orca` や `open.dolphin.session` は Lane C 所有なので原則触らない

やること:
1. `open/orca/rest` 配下の current findings を特定する
2. `UUF_UNUSED_FIELD` の出ている fixture DTO / support class を優先して整理する
3. 明らかに未使用の field / helper / constructor parameter を削る
4. defensive copy や nullability が必要な箇所だけ局所修正する
5. package 内の test があれば最小限更新する
6. lane 完了時に、どの bug code を何件落としたかメモする

禁止事項:
- `pom.xml` の変更
- `spotbugs-exclude.xml` の変更
- unrelated cleanup
- `open/orca/rest` 以外への拡散

受け入れ条件:
- `open/orca/rest` 所有範囲で baseline が material に減る
- UUF_UNUSED_FIELD を主に圧縮できている
- failOnError / threshold は不変
- diff が package 内に概ね閉じている

最終出力:
1. 変更ファイル一覧
2. 実行コマンド
3. 落とした bug code / 件数の概算
4. 残件と次の論点

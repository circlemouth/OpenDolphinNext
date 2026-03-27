あなたは OpenDolphinNext の Static Analysis Lane C 担当です。

対象:
- `server-modernized/src/main/java/open/dolphin/orca/**`
- `server-modernized/src/main/java/open/dolphin/session/**` の ORCA 関連クラス
- `DefaultOrcaLiveGateway.java`, `OrcaPatientSyncStateStore.java`, `OrcaPatientAdapter.java`, `OrcaMasterDaoTypes.java`, `OrcaMasterResource.java`, `StringTool.java` など
- 必要最小限の関連 test

目的:
ORCA/session 周辺の `NP_NULL_PARAM_DEREF`, `EI_EXPOSE_REP`, `EI_EXPOSE_REP2` を局所修正で削減すること。

現在わかっていること:
- Cluster B の tail に live-ish ORCA/session クラスが残る
- representative として `DefaultOrcaLiveGateway.java` などが報告済み
- `open/orca/rest/**` は Lane A 所有なので原則触らない

前提:
- current repo が正本
- 後方互換性は不要
- failOnError / threshold 不変
- blanket suppression 禁止
- smallest viable diff

やること:
1. 所有範囲の current findings を特定する
2. `NP_NULL_PARAM_DEREF` を中心に nullability contract を補強する
3. defensive copy 必要箇所は局所修正する
4. live runtime path を壊さないよう、該当 test を最小限で更新する
5. Lane A 所有の `open/orca/rest/**` には触らない

禁止事項:
- `pom.xml` / filter 変更
- broad redesign
- blanket suppression
- open.orca.rest への拡散

受け入れ条件:
- 所有範囲の nullability / expose-rep findings が material に減る
- failOnError / threshold は不変
- diff が ORCA/session 周辺に閉じている

最終出力:
1. 変更ファイル一覧
2. 実行コマンド
3. 落とした bug code / 件数の概算
4. 残件と次の論点

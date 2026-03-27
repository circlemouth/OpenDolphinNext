あなたは OpenDolphinNext の Wave 4 / WS-A 担当です。

対象:
- `open.dolphin.rest` package の SpotBugs / FindSecBugs 残件

背景:
current repo では static-analysis 残件 35 件のうち、`open.dolphin.rest` に 13 件残っています。
代表 bug code:
- `DLS_DEAD_LOCAL_STORE`
- `NP_BOOLEAN_RETURN_NULL`
- `RCN_REDUNDANT_NULLCHECK_OF_NONNULL_VALUE`
- `AT_STALE_THREAD_WRITE_OF_PRIMITIVE`
- `DB_DUPLICATE_BRANCHES`
- `EI_EXPOSE_REP`
- `EI_EXPOSE_REP2`
- `MS_EXPOSE_REP`
- `NP_LOAD_OF_KNOWN_NULL_VALUE`
- `URF_UNREAD_FIELD`

代表クラス候補:
- `open.dolphin.rest.AdminConfigResource`
- `open.dolphin.rest.AdminOrcaConnectionResource`
- `open.dolphin.rest.KarteResource`
- `open.dolphin.rest.StampResource`
- `open.dolphin.rest.masterupdate.*`

最優先目標:
`open.dolphin.rest` package の residual findings を smallest viable diff で 0 に近づけること。

禁止事項:
- `pom.server-modernized.xml` を変更しない
- blanket suppression を追加しない
- broad API redesign をしない
- unrelated cleanup を混ぜない

やること:
1. current XML から `open.dolphin.rest` package の該当 class / bug code / line を特定する
2. bug code ごとに最小修正を入れる
   - boolean-null は本当に tri-state が必要か確認し、不要なら primitive / 明示 2 値へ寄せる
   - redundant nullcheck / duplicate branches / dead local store は局所整理で閉じる
   - expose-rep は defensive copy / immutable / unmodifiable view で閉じる
   - stale thread write / unread field / known-null load は race や意味を変えずに閉じる
3. compile を確認する
4. 可能なら package 限定の spotbugs 再実行で自 package の件数減少を確認する

受け入れ条件:
- `open.dolphin.rest` の residual findings が material に減るか、理想は 0
- compile が通る
- behavior 変更が最小
- inventory 更新に必要な before / after を報告できる

最終出力:
1. 変更ファイル一覧
2. 実行コマンド一覧
3. before / after 件数
4. 主要修正内容
5. 残る unknown

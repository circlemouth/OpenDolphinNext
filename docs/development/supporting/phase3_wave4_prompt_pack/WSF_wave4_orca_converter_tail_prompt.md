あなたは OpenDolphinNext の Wave 4 / WS-F 担当です。

対象:
- `open.dolphin.orca.converter` package の SpotBugs / FindSecBugs 残件

背景:
current repo では `open.dolphin.orca.converter` に 1 件残っており、`IT_NO_SUCH_ELEMENT` です。
代表クラス候補:
- `open.dolphin.orca.converter.OrcaXmlMapper`

最優先目標:
iterator / collection 走査の empty case を正しく扱い、この 1 件を潰すこと。

禁止事項:
- converter 全体を再設計しない
- parse semantics を必要以上に変えない
- `pom.server-modernized.xml` を変更しない
- blanket suppression を追加しない

やること:
1. current XML から exact location を特定する
2. `IT_NO_SUCH_ELEMENT` を fail-safe な empty handling / presence check に置き換える
3. compile を確認する
4. 可能なら該当 converter を使う既存 test を回す

受け入れ条件:
- `open.dolphin.orca.converter` の 1 件が 0 になる
- compile が通る
- parse semantics が不必要に変わっていない

最終出力:
1. 変更ファイル一覧
2. 実行コマンド一覧
3. before / after 件数
4. 主要修正内容
5. 残る unknown

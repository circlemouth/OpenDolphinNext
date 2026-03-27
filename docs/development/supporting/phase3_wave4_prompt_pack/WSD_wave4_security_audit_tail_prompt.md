あなたは OpenDolphinNext の Wave 4 / WS-D 担当です。

対象:
- `open.dolphin.security.audit` package の SpotBugs / FindSecBugs 残件

背景:
current repo では `open.dolphin.security.audit` に 3 件残っています。
代表 bug code:
- `EI_EXPOSE_REP`
- `EI_EXPOSE_REP2`
- `NM_SAME_SIMPLE_NAME_AS_INTERFACE`

代表クラス候補:
- `open.dolphin.security.audit.AuditChainVerifier`

最優先目標:
audit semantics を変えずに残件 3 件を smallest viable diff で閉じること。

禁止事項:
- audit behavior / verification semantics を変えない
- `pom.server-modernized.xml` を変更しない
- blanket suppression を追加しない
- unrelated cleanup を混ぜない

やること:
1. current XML から audit package の exact findings を特定する
2. expose-rep を copy / immutable 化で閉じる
3. name 衝突は public contract を壊さない最小 rename または局所整理で閉じる
4. compile を確認する

受け入れ条件:
- `open.dolphin.security.audit` の 3 件が 0 になる
- compile が通る
- audit semantics が不変

最終出力:
1. 変更ファイル一覧
2. 実行コマンド一覧
3. before / after 件数
4. 主要修正内容
5. 残る unknown

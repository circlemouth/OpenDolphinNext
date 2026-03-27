あなたは OpenDolphinNext の Wave 4 / WS-G 担当です。

対象:
- `open.dolphin.runtime`
- `open.dolphin.runtime.config`
- `open.dolphin.security.integrity`
- `open.dolphin.security.totp`

背景:
current repo では上記 package 群に合計 4 件残っています。
代表 bug code:
- `NP_BOOLEAN_RETURN_NULL`
- `UPM_UNCALLED_PRIVATE_METHOD`
- `CT_CONSTRUCTOR_THROW`

最優先目標:
startup / runtime-config / integrity / totp semantics を変えずに 4 件を smallest viable diff で閉じること。

禁止事項:
- startup / integrity / totp の product contract を変えない
- `pom.server-modernized.xml` を変更しない
- blanket suppression を追加しない
- broad refactor をしない

やること:
1. current XML から exact class / line / bug code を特定する
2. boolean-null は tri-state が不要なら 2 値へ寄せる
3. dead private method は削除または reachable にする
4. constructor throw は必要なら factory 化や input validation で smallest viable diff に寄せる
5. compile を確認する

受け入れ条件:
- 対象 4 件が 0 になる
- compile が通る
- runtime / security semantics が不変

最終出力:
1. 変更ファイル一覧
2. 実行コマンド一覧
3. before / after 件数
4. 主要修正内容
5. 残る unknown

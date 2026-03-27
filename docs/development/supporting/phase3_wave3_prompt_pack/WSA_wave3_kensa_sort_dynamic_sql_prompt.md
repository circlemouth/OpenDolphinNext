あなたは OpenDolphinNext の Wave 3 Lane A tail 担当です。

担当範囲:
- `open.orca.rest.OrcaMasterKensaSortQueryService`

背景:
Wave 2 後の Lane A 残件は 1 件だけです。
内容は `SQL_PREPARED_STATEMENT_GENERATED_FROM_NONCONSTANT_STRING` で、`OrcaMasterKensaSortQueryService` の dynamic SQL が原因です。
smallest viable diff では取り切れず、query shape の分割か allowlist 化が必要と報告されています。

最優先目標:
query behavior を壊さずに、SpotBugs の dynamic SQL 指摘を消すこと。

制約:
- 後方互換性は考慮しないが、runtime behavior は極力維持する
- failOnError / threshold / filter は変更禁止
- suppression 禁止
- unrelated refactor 禁止
- SQL injection 回避だけでなく、SpotBugs 上も constant-ish な組み立てに寄せる

やること:
1. `OrcaMasterKensaSortQueryService` の query build 箇所を確認する
2. sort key や query shape を enum allowlist / switch / 分岐メソッドに落とし込む
3. 非定数文字列の連結で `PreparedStatement` を生成しない構成へ寄せる
4. compile と SpotBugs 差分を確認する
5. もし smallest viable diff で無理なら、具体的な設計代替案を 2 案まで示す

ヒント:
- order/sort の自由度が高すぎると SpotBugs は消えない
- ユーザー入力由来の可変部を SQL 定数群の選択へ落とし込めれば片付く可能性が高い
- 1 file に閉じるなら enum/switch が最小 diff になりやすい

禁止事項:
- ORM や DAO レイヤー全面置換
- suppression で隠すこと
- unrelated SQL cleanup を広げること

受け入れ条件:
- `OrcaMasterKensaSortQueryService` の dynamic SQL 指摘が消える、または消えない理由が code-level に明確化される
- compile が通る
- diff は 1 file 近辺に閉じる

最終出力:
1. 変更ファイル一覧
2. 実行コマンド
3. before/after
4. 採った設計方針
5. それでも残る場合の代替案

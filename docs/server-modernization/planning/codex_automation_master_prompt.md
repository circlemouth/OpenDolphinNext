# 目的
`docs/server-modernization/planning/codex_automation_workplan_revised.md` を進捗判定の第一正本として扱い、
`common` と `server-modernized` を対象に、server modernization 関連タスクを未完了の先頭から順番に進める。

`docs/server-modernization/planning/server_modernization_wbs_detailed.md` は参考資料として扱う。
このファイルのチェック状態は、進捗判定の第一基準には使わない。

# 必ず最初に読むファイル
- `docs/server-modernization/planning/codex_automation_workplan_revised.md`
- `docs/server-modernization/planning/codex_automation_prompts_revised.md`
- `docs/server-modernization/planning/server_modernization_wbs_detailed.md`

# 進捗判定の正本
進捗判定は、必ず以下の優先順位で行うこと。

1. `docs/server-modernization/planning/codex_automation_workplan_revised.md`
2. `docs/server-modernization/planning/server_modernization_wbs_detailed.md`

以下のルールを厳守すること。

- まず `codex_automation_workplan_revised.md` を読み、未完了タスクの先頭を特定すること
- `codex_automation_workplan_revised.md` に未完了タスクが存在する限り、`server_modernization_wbs_detailed.md` のチェック状態は進捗判定に使わないこと
- `server_modernization_wbs_detailed.md` は、背景、依存関係、全体像の参考資料としてのみ扱うこと
- 両者の記載が矛盾する場合は、`codex_automation_workplan_revised.md` を優先すること
- 矛盾を見つけた場合は、今回の実行結果にその内容を記録すること
- `codex_automation_workplan_revised.md` 側が欠落または破損している場合のみ、`server_modernization_wbs_detailed.md` を補助的に参照してよい

# 対象範囲
- `common`
- `server-modernized`

# 作業の基本方針
- 未完了タスクを上から順に処理すること
- タスクの順番は飛ばさないこと
- 各回の実行では、開始時点の未完了先頭タスクから着手すること
- 1回の実行で扱う作業量は、GPT 5.4 high で 2 時間以内に終わる範囲に制限すること
- 同一実行内で次タスクへ進んでよいのは、現在タスクが完了し、かつ開始から 100 分未満で、次タスクも安全に着手できる場合だけとする
- 現在タスクを完了し、blocker がなく、開始から 100 分未満で、次タスクの必要ファイルと確認方法をその場で特定できるなら、次タスクへ進むことを原則とする
- 特に 20 分以上の作業余力が残っている場合は、次タスクへ進まない理由が明確にある場合を除き、調査着手または実装着手まで進めること
- 次タスクへ進まないで停止する場合は、実行結果に「なぜ今回は次タスクへ進まなかったか」を必ず明記すること
- 開始から 100 分を超えたら、新規タスク着手を禁止すること
- 開始から 120 分以内に作業を打ち切ること
- 部分的にしか終わらない場合は、完了扱いにせず、進捗メモを残して停止すること
- 推測で仕様を追加しないこと
- 不明な場合は止まること

# blocker ルール
以下のいずれかに当てはまったら、その時点で作業を止めること。
止めたうえで、どこが blocker か、何が不足しているか、次に人間が判断すべきことは何かを明記すること。

- 必要な source が存在しない
- 変更が source のないモジュールに波及する
- `target/` 配下の生成物を編集しないと前に進めない
- 仕様が不足していて、コードと既存ドキュメントだけでは合理的に確定できない
- 既存の受け入れ条件どうしが矛盾している
- DB migration の正本が不明瞭になる
- テスト失敗の原因が今回の変更範囲外にあり、安全に切り分けできない
- 既存 API 契約を切るか残すかの判断が文書化されていない
- ORCA 実連携前提の判断が必要なのに、コードと既存資料だけでは確定できない

blocker が発生した場合は、その実行ではそれ以上の新規作業をしないこと。

# 絶対ルール
- `target/` 配下は編集しないこと
- ビルド生成物、zip 展開ゴミ、`__MACOSX` は編集対象にしないこと
- `tools/flyway/sql` を migration の正本として扱うこと
- `src/main/resources/db/migration` は `tools/flyway/sql` と整合させること
- `common` と `server-modernized` を同じ workspace で扱うこと
- 後方互換性は考慮しなくてよい
- 古い互換コードを温存するための実装はしないこと
- ただし、作業工程表で明示的に据え置きとされている項目は勝手に触らないこと
- 変更は、そのタスクの完了条件を満たす最小十分範囲にとどめること
- 無関係な整形、広範囲な rename、ついでの大規模整理はしないこと

# 実行手順
1. まず上記 3 ファイルを読む
2. `codex_automation_workplan_revised.md` から未完了タスクの先頭を特定する
3. 該当タスク ID に対応する指示が `codex_automation_prompts_revised.md` にあれば参照する
4. そのタスクに必要なコード、関連テスト、関連 migration、関連ドキュメントだけを追加で読む
5. 変更前に、完了条件、変更対象ファイル、確認方法を自分の中で明確化する
6. 実装、テスト、必要なドキュメント更新を行う
7. 完了条件を満たした場合のみ、そのタスクを完了扱いにする
8. 余力があり、かつ開始から 100 分未満なら、次の未完了タスクへ進むことを原則とする。進まない場合は理由を記録する
9. 実行終了時に、今回の実施内容、変更ファイル、テスト結果、未解決事項、次に着手すべきタスクをまとめる

# 工程表更新ルール
作業後は必ず、工程表または計画書の該当箇所を更新すること。

更新対象の優先順位:
1. `docs/server-modernization/planning/codex_automation_workplan_revised.md`
2. 必要なら `docs/server-modernization/planning/server_modernization_wbs_detailed.md`

最低限更新する内容:
- 完了したタスクのチェック
- 完了できなかった場合の進捗メモ
- blocker がある場合の内容
- 次に着手すべきタスク
- 必要なら具体ファイル名、実装補足、注意点

`server_modernization_wbs_detailed.md` は参考資料なので、こちらの全チェック状態を理由に作業完了と判断してはならない。

# テストと確認
各タスクでは、変更に見合う確認を必ず行うこと。
可能な限り、変更箇所に近い粒度で確認すること。

確認の例:
- 単体テスト
- 契約テスト
- repository / service テスト
- migration 整合確認
- コンパイル確認
- 既存テストの再実行

テストが存在しない場合:
- 最小限の安全確認を追加する
- ただし、今回の変更範囲を超えた大規模テスト整備はしない

# この automation で優先してよい観点
以下は既存レビューを踏まえた高優先観点である。
ただし、必ず `codex_automation_workplan_revised.md` の順序を優先すること。

- ORCA transport の `HttpClient` 長寿命化
- ChartEventHistory の purge を配信経路から外す
- `initializePvtList` / `addPvt` の DB 往復削減
- `/docinfo/all` と全患者取得 API のページング前提化
- 添付、画像、外部取得の `byte[]` 偏重の削減
- 患者同期 upsert の一括化
- ORCA マスタ検索の重い `LIKE` / `count` の見直し
- 通知基盤の二重化整理
- 書き込み頻度の高い共有メモリ構造の見直し
- 巨大クラスの責務分割

# 実装時の注意
- 旧実装と新実装が並立している場合は、旧実装温存ではなく、新実装側へ寄せる方向で整理すること
- ただし、一度に広げすぎず、そのタスクの完了条件に必要な範囲で止めること
- 1 タスク内で責務分割まで含める場合も、2 時間以内に収まる粒度を守ること
- コメントだけで済ませず、コード、テスト、ドキュメントをそろえて前進させること

# 出力ルール
実行の最後に、必ず以下を簡潔にまとめること。

- 今回完了したタスク番号と名称
- 変更した主なファイル
- 実施したテストと結果
- blocker の有無
- 次回の先頭タスク番号と名称

# 開始
まず `docs/server-modernization/planning/codex_automation_workplan_revised.md` を読み、
未完了タスクの先頭を特定し、そのタスクだけに必要なファイルを読み込んで作業を開始すること。

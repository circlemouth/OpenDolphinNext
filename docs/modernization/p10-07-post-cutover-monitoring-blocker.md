# P10-07 切替後集中監視の blocker 記録

- 更新日: 2026-03-15
- RUN_ID: 20260315T020039Z
- 対象: `server-modernized`

## 結論
- `P10-07` は **未完了**。
- 現在ある証跡は `P10-06` の validation 環境での稼働確認までで、WBS が要求する「切替後 3 日の集中監視記録、是正一覧、クローズ条件」を満たしていない。

## blocker の内容
- 切替後監視の前提となる実運用の監視ログ、エラーログ、問い合わせ記録、ORCA 連携結果の日次観測が存在しない。

## 根拠
- `docs/server-modernization/planning/codex_automation_workplan_revised.md` は全タスク完了済みで、追加の未完了タスクを提示していない。
- `docs/server-modernization/planning/server_modernization_wbs_detailed.md` では `P10-07` が未着手のまま残っている。
- `docs/modernization/p10-05-cutover-checklist-modernized.md` と `docs/modernization/p10-06-cutover-execution-blocker.md` は、`pvtQueue.workerStatus=DISABLED`、`otel-collector` name 解決警告、患者画像一覧 API の実運用観察を `P10-07` へ引き継ぐ watch item として記録している。
- 現時点では validation 環境の疎通確認しかなく、「切替後」の 1日目〜3日目監視を示す一次記録がない。

## その場で止める理由
- このタスクは実環境または切替後相当の監視運用を伴うため、コードと既存ドキュメントだけでは完了条件を合理的に満たせない。
- 推測で監視結果や是正一覧を作ると、実績のない運用記録を捏造することになる。

## 次に人間が判断すべきこと
1. `P10-07` を開始する監視対象環境を確定する。
2. 監視期間の起点日と、1日目/2日目/3日目で回収する証跡の保管先を決める。
3. 問い合わせ窓口、ORCA 連携エラーの確認経路、監視ログ参照権限を用意する。
4. `pvtQueue.workerStatus=DISABLED`、`otel-collector` name 解決警告、患者画像一覧 API の watch item を、監視対象として残すか事前是正するか判断する。

## 次回ワーカー向けメモ
- 進捗判定は引き続き `docs/server-modernization/planning/codex_automation_workplan_revised.md` を第一正本とする。
- そのうえで未完了の実作業は WBS `P10-07` が先頭。
- 監視証跡が揃わない限り、`P10-07` は完了扱いにしない。

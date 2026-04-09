# ORCA 残タスク 最終報告テンプレート

## 1. 総合判定
- 完了 / 未完
- RUN_ID
- 3〜6 行要約

## 2. Phase 0 decision table
各 disputed point について:
- status
- file:line evidence
- action taken
- locking test added?（yes/no）

## 3. 実施した変更の要約
### med usage
### structured claim comment
### speed overclaim
### canonicalization / radiology fallback
### null classCode fail-close
### disputed family fixes
### help / tests / notes

## 4. 変更ファイル一覧
### client
### server
### tests
### notes/docs

## 5. acceptance results
`04_acceptance_matrix.md` の AC / NR を 1 行ずつ
- ID: 達成 / 未達
- 根拠

## 6. 実行コマンドと結果
### client
- command
- result
### server
- command
- result

## 7. grep gate
- command
- result
- 説明付き hit がある場合は妥当性

## 8. 削除した fallback / dead code / overclaim
- 箇条書き

## 9. 残課題
- 0 件でなければ未完

## 10. Final Auditor メモ
- AC pass/fail summary
- blocker 0 件か

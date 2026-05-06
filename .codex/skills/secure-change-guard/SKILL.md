---
name: secure-change-guard
description: Analyze git diff and output mandatory security checks plus misuse-case test prompts for web-client/server-modernized changes. Use when a task includes auth, authorization, session, health, error handling, external connection, attachment, or storage behaviors.
---

# Secure Change Guard

`web-client/` と `server-modernized/` の差分から、セキュリティ観点の必須確認項目を自動で抽出する。

## 使いどころ
- 認証/認可/セッション/ヘルスチェック/外部接続/添付保存/API エラー応答に変更があるとき。
- 実装前のレビュー観点整理、実装後の検証漏れ防止。

## 実行手順
リポジトリルートで以下を実行する。

```bash
.codex/skills/secure-change-guard/scripts/run.sh
```

## 出力
- `tmp/secure-change-guard-report.md`
  - 差分対象ファイル
  - 検出されたセキュリティ領域
  - 必須チェック項目
  - misuse case（最低3件）

## フォールバック
- `git diff` が空の場合、最新コミット (`HEAD~1..HEAD`) を対象に再実行する。

## 注意事項
- 判定はキーワードベースのため、最終判断は必ず人間が行う。
- クライアント改修のみでも、サーバー側 enforcement を確認する。

---
name: spec-delta-doc-updater
description: Detect spec-impacting changes from git diff and propose documentation updates under docs/ and web-client/notes/.
---

# Spec Delta Doc Updater

コード差分から仕様変更の可能性を検知し、更新すべき解説用 md を提案する。

## 実行コマンド

```bash
.codex/skills/spec-delta-doc-updater/scripts/run.sh
```

## 出力
- `tmp/spec-delta-doc-plan.md`
  - 仕様変更候補
  - 影響領域
  - 更新候補ドキュメント
  - 追記テンプレート

## 判定ルール
- API contract 変更（request/response/status/validation）
- 認証/認可/セッションの挙動変更
- 外部連携・接続先制約変更
- 添付保存/URI生成/所有権チェック変更

## 注意事項
- README を根拠にせず、`docs/` と `web-client/notes/` の実仕様文書を更新対象にする。

# Webクライアント / server-modernized 開発向け スキル整備案（RUN_ID: 20260503T063819Z）

## 目的
本リポジトリでの Web クライアント（`web-client/`）とモダナイズ版サーバー（`server-modernized/`）開発を高速化しつつ、
以下を標準化する。

- セキュリティを後付けにしない設計・実装フロー
- 変更時の検証漏れ（lint/typecheck/test/build/セキュリティ観点）の削減
- 仕様変更時のドキュメント更新漏れ防止

## 整備優先度（結論）

### P0（最優先）
1. **secure-change-guard**
   - 認証/認可/セッション/health/error/CORS/外部接続/添付保存に関わる変更を検知し、
     「必須チェックリスト」と「最低限必要な異常系テスト」を自動提示するスキル。
2. **full-stack-verify-web-server**
   - `web-client` と `server-modernized` の lint/typecheck/test/build を一括実行し、
     失敗時に次アクションを提案するスキル。
3. **spec-delta-doc-updater**
   - 仕様変更に該当する差分を検知し、`docs/` 配下の更新候補を提案し、更新漏れを防ぐスキル。

### P1（高優先）
4. **api-contract-drift-checker**
   - API の request/response・HTTP status・validation 変更を抽出し、
     クライアント／サーバーの契約ズレを一覧化するスキル。
5. **threat-model-seed-generator**
   - 変更内容から misuse case（最低3件）を自動起案し、設計レビューの起点を作るスキル。
6. **release-gate-quick-audit**
   - リリース前の必須確認（機能/セキュリティ/監査ログ/運用設定）をテンプレ化して実施するスキル。

### P2（あると便利）
7. **migration-impact-assistant**
   - 既存ユーザー影響（設定移行、互換性、ロールバック）をチェックし、運用向け差分を要約するスキル。
8. **incident-safe-log-checker**
   - ログ・エラー応答に秘密情報や内部実装情報が漏れていないかを確認するスキル。

---

## 各スキル案（詳細）

## 1) secure-change-guard（P0）
- **解決したい課題**
  - 実装者ごとにセキュリティ確認の粒度がブレる。
- **想定入力**
  - git diff（変更ファイル一覧 + 差分）。
- **主な処理**
  - 変更ファイルから影響領域を分類（認証/認可/セッション/API/外部接続/添付/health など）。
  - 領域ごとに必須チェックを提示。
  - fail-closed 原則に反する差分候補を警告。
- **期待成果物**
  - 「実装前チェック」「実装後チェック」「異常系テスト項目」の3点セット。

## 2) full-stack-verify-web-server（P0）
- **解決したい課題**
  - 手動実行で検証漏れが起きる。
- **想定入力**
  - 実行対象ディレクトリ（`web-client`, `server-modernized`）。
- **主な処理**
  - `web-client`: lint / typecheck / test / build
  - `server-modernized`: test / build / 静的解析（プロジェクト標準）
  - 実行ログを集約し、失敗時の再試行順序を提示。
- **期待成果物**
  - 成否サマリー、失敗箇所、次の修正アクション。

## 3) spec-delta-doc-updater（P0）
- **解決したい課題**
  - 仕様変更がコードだけ反映され、ドキュメントが陳腐化する。
- **想定入力**
  - 差分、更新した API/画面/設定の要点。
- **主な処理**
  - 変更内容から「仕様変更」判定。
  - 更新すべき解説 md 候補を提示。
  - 変更サマリー草案を生成（人間が最終確認）。
- **期待成果物**
  - 「どのmdを、何の理由で、どう更新すべきか」の差分案。

## 4) api-contract-drift-checker（P1）
- **目的**
  - クライアントとサーバーの齟齬を早期発見。
- **出力例**
  - エンドポイント単位の breaking / non-breaking 判定。

## 5) threat-model-seed-generator（P1）
- **目的**
  - 開発開始前に misuse case を最低3件用意する運用を補助。
- **出力例**
  - 未認証アクセス、権限昇格、SSRF、情報漏えいの観点で想定攻撃手順。

## 6) release-gate-quick-audit（P1）
- **目的**
  - リリース判断に必要な証跡を揃える。
- **出力例**
  - テスト実行結果、設定確認、残リスク、ロールバック可否。

## 7) migration-impact-assistant（P2）
- **目的**
  - 既存ユーザー影響の見落とし防止（設定移行・運用手順変更）。
- **出力例**
  - 影響対象一覧、移行手順、段階導入プラン。

## 8) incident-safe-log-checker（P2）
- **目的**
  - 監査/障害対応ログの安全性担保。
- **出力例**
  - 秘密情報漏えい候補、マスキング不足、改善提案。

---

## 実装テンプレート（推奨）
各スキルは以下構成を統一すると保守しやすい。

- `.codex/skills/<skill-name>/SKILL.md`
- `.codex/skills/<skill-name>/scripts/`（必要な自動化スクリプト）
- `.codex/skills/<skill-name>/references/`（チェックリストや出力テンプレート）

`SKILL.md` の共通セクション例:
1. 対象範囲
2. 入力
3. 実行手順
4. 出力形式
5. 失敗時のフォールバック
6. セキュリティ注意事項

## 導入順（現実的プラン）
1. **Week 1**: `secure-change-guard`, `full-stack-verify-web-server`
2. **Week 2**: `spec-delta-doc-updater`, `api-contract-drift-checker`
3. **Week 3**: `threat-model-seed-generator`, `release-gate-quick-audit`
4. **Week 4以降**: `migration-impact-assistant`, `incident-safe-log-checker`

## 完了条件（この提案を採用する場合）
- P0スキル3点が実装され、主要開発フローで1回以上利用されている。
- 仕様変更のあるPRで、関連ドキュメント更新の有無を機械的に確認できる。
- セキュリティ関連変更で、最低3件の misuse case が記録される。

## 実装状況（2026-05-03）
- 実装済み（P0）
  - `.codex/skills/secure-change-guard/SKILL.md`
  - `.codex/skills/full-stack-verify-web-server/SKILL.md`
  - `.codex/skills/spec-delta-doc-updater/SKILL.md`
- 付属スクリプト
  - `secure-change-guard/scripts/run.sh`
  - `full-stack-verify-web-server/scripts/run.sh`
  - `spec-delta-doc-updater/scripts/run.sh`
- 生成成果物（実行時）
  - `tmp/secure-change-guard-report.md`
  - `tmp/full-stack-verify-report.md`
  - `tmp/spec-delta-doc-plan.md`

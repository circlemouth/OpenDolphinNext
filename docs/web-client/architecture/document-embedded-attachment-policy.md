# Document埋め込み運用ポリシー（暫定/恒久/廃止条件）

Status: reference-only
Canonical source: `docs/managerdocs/03_web_current_contract_summary.md`, `web-client/notes/ui-current-contract.md`

RUN_ID: 20260121T063526Z

## 目的
- 画像/添付 API が未整備な期間に、`PUT /karte/document` へ添付データを埋め込み送信する運用の基準を明確化する。

## 暫定運用の基準
- **対象**: 画像アップロード API が未提供、または安定性/監査要件を満たさない期間。
- **送信方式**: `DocumentModel.attachment[]` に base64 画像を埋め込み、`PUT /karte/document` で送信。
- **バリデーション**: 最大 5MB、許可拡張子・contentType 一致チェックを必須とする。

## 恒久運用の基準
- **前提**: 専用の upload API が提供され、監査ログ・trace/runId 伝搬・SLA が保証される。
- **送信方式**: upload API で保管し、`DocumentModel` には参照情報のみを連携。
- **移行**: Document 埋め込みは段階的に停止し、一定期間はフォールバックを許可する。

## 廃止条件
- 本番/検証の両環境で upload API が安定運用され、Document 埋め込み運用の実行ログが一定期間（例: 30日）検出されないこと。
- 監査ログで `action=image_api_call` の `operation=document` が連続未発生であること。

## 監査ログ要件
- `action=image_api_call` を必須。
- `details` に以下を含める:
  - `operation=document`
  - `endpoint=/karte/document`
  - `runId` / `traceId`
  - `attachmentsSent`
  - `documentId`
- 失敗時は `outcome=error` とし、理由（HTTP status / validation error）を記録する。

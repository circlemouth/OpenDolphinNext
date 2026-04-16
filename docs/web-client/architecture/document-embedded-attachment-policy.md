# Document埋め込み運用ポリシー（暫定/恒久/廃止条件）

Status: current
Canonical source: `web-client/notes/document-image-lifecycle.md`, `web-client/notes/ui-current-contract.md`

RUN_ID: 20260121T063526Z

## 目的
- 画像/添付 API が未整備な期間に、`PUT /karte/document` へ添付データを埋め込み送信する運用の基準を明確化する。

## Current 運用の基準
- **対象**: 患者画像 asset は `/patients/{patientId}/images` で保存済みであること。
- **送信方式**: `DocumentModel.attachment[]` には asset id から server が再解決した reference row だけを保存する。
- **禁止**: base64 埋め込み、client 提供の `uri` / `digest` / `storageKey` 採用、preview state の storage restore。
- **fail-close**: reference backend contract が成立しない場合は document attach action を feature-off に倒す。

## Delete Scope
- history delete は reference remove only。
- patient image asset hard delete は gate 閉鎖まで UI 非表示。
- reference row 削除で object storage 上の asset 実体を delete しない。

## 監査ログ要件
- `action=image_api_call` を必須。
- `details` に以下を含める:
  - `operation=document`
  - `endpoint=/karte/document`
  - `runId` / `traceId`
  - `attachmentsSent`
  - `documentId`
- 失敗時は `outcome=error` とし、理由（HTTP status / validation error）を記録する。

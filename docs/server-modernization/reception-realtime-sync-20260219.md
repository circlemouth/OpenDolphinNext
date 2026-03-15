# Reception リアルタイム同期（SSE）実装メモ

- RUN_ID: `20260219T210316Z`
- 更新日: 2026-02-20

## 概要
- Reception 一覧の他端末同期を SSE で実装。
- クライアントの 15 秒ポーリング短縮ではなく、サーバー配信を主経路に変更。
- 既存の 90 秒自動更新はフォールバックとして維持。

## サーバー側
- SSE エンドポイント: `GET /realtime/reception`
- Content-Type: `text/event-stream`
- セッション認証を利用（`@SessionOperation`）
- 配信イベント:
  - `reception.updated`
  - `reception.replay-gap`
  - `reception.keepalive`（20 秒間隔）
- `reception.updated` の payload:
  - `type`
  - `facilityId`
  - `date`（可能時）
  - `patientId`（可能時）
  - `requestNumber`
  - `revision`（単調増加）
  - `updatedAt`（ISO）
  - `runId`
- 発火条件:
  - `POST /orca/visits/mutation` 成功時（`Api_Result` 成功かつ requestNumber が `00` 以外）

## クライアント側
- `EventSource` で `/api/realtime/reception` を購読。
- 受信時の動作:
  - `queryKey: ['outpatient-appointments']` を invalidate（対象日一致または replay-gap）
  - `queryKey: ['orca-queue']` を invalidate
  - `receptionDailyState` の status override を日付/患者単位で解除し、サーバー最新表示を優先
- UI 表示:
  - Reception メタバーに `RT同期` ステータス（接続中/接続済み/再接続中/停止/未対応）を追加

## 既知の制約
- SSE ブロードキャストは `server-modernized` 単一インスタンス前提の in-memory 実装。
- 将来の水平分割時は Redis pub/sub など外部ブローカーへ置換が必要。

## cleanup / replay 契約
- facility context と in-memory history は、購読中 client が 1 件以上いる間だけ保持する。
- client が 0 件になった時点で、facility context と in-memory history は破棄してよい。
- `publishReceptionUpdate` は、購読中 client がいない facility のために新しい context を作らない。
- 接続中だけ、現行の `HISTORY_LIMIT` 件ぶんの in-memory replay を許可する。
- cleanup 後に `Last-Event-ID` 付きで再接続した場合、server-side replay は行わず `reception.replay-gap` を返し、クライアントは一覧再取得へ倒す。
- cleanup 済み facility に対しては、publish 時も full context / full history を再作成しない。
- 追加の保持時間は設けない。

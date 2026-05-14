# Prescription Authority API Contract

## Route Boundary

処方 authority API は OpenDolphinNext 正本の local mutation surface として `/api/local/prescription-orders/authority` 配下だけに公開する。

旧 `/api/prescriptions` は taxonomy 外 route であり、alias / shim / fallback として再公開しない。

## Routes

| Method | Route | Event | Notes |
| --- | --- | --- | --- |
| `POST` | `/api/local/prescription-orders/authority` | `CREATE` | server-side facility / patient / encounter context で draft order を作成する。 |
| `POST` | `/api/local/prescription-orders/authority/{prescriptionId}/finalize` | `FINALIZE` | 保存済み current revision から content hash を計算して確定する。 |
| `POST` | `/api/local/prescription-orders/authority/{prescriptionId}/change` | `CHANGE` | 理由と新 structured item revision を必須にする。 |
| `POST` | `/api/local/prescription-orders/authority/{prescriptionId}/stop` | `STOP` | 理由必須。既存 content を直接上書きしない。 |
| `POST` | `/api/local/prescription-orders/authority/{prescriptionId}/cancel` | `CANCEL` | 理由必須。既存 content を直接上書きしない。 |
| `POST` | `/api/local/prescription-orders/authority/{prescriptionId}/reissue` | `REISSUE` | 理由と新 structured item revision を必須にする。 |
| `POST` | `/api/local/prescription-orders/authority/{prescriptionId}/resend` | `RESEND` | ORCA UNKNOWN / 再送判断の audit event。処方 content と status は変更しない。 |

全 route の facility は認証済み remote user / session / server-side tenant context からだけ解決する。`X-Facility-Id` を含む client header は authority に使わない。

## Hash Chain

`prescription_order_event` は append-only とし、全 event に `previous_event_hash` と `event_hash` を必須投入する。`event_hash` は少なくとも order id、revision id、event type、actor、occurred at、before payload hash、after payload hash、previous hash を含む server-side material から計算する。

初回 event の `previous_event_hash` は 64 桁の `0` とする。client 提供の digest、facility、owner、role、patient、encounter、ORCA identifier は hash chain の権威値にしない。

finalize / change / stop / cancel / reissue / resend の order lookup は facility id と prescriptionId を組にして server-side で解決する。order id 単独 lookup で他施設 order を mutation しない。

## Verification

`PrescriptionOrderEventHashChainVerifier` は order 単位で event を発生順に再計算し、次を検出する。

- `previous_event_hash` が直前 event の `event_hash` と一致しない。
- event payload、actor、timestamp、event type、revision id、event hash が改ざんされた。
- DB trigger を迂回して過去 event が更新された。

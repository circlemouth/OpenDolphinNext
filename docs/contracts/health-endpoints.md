# Health Endpoint 契約

## 目的
ヘルス系 API から内部構成を漏らさず、監視と運用診断の両方を両立する。

## エンドポイント一覧

### 1. 匿名 liveness
- `GET /api/health`
- 認証不要
- 応答例
```json
{
  "status": "UP",
  "service": "server-modernized"
}
```
- 依存先疎通は確認しない。
- URL / host / port / mode / stack trace を含めない。

### 2. 匿名 readiness（最小公開）
- `GET /api/health/readiness`
- 認証不要
- 応答例
```json
{
  "status": "UP"
}
```
- `status` 以外のフィールドを返さない。
- component 名、URL、statusCode、error、message、詳細設定値を返さない。

### 3. 認証付き operations readiness
- `GET /api/operations/readiness`
- 認証必須
- 応答例
```json
{
  "status": "UP",
  "checks": {
    "database": {"status": "UP"},
    "orca": {
      "status": "UP",
      "mode": "weborca",
      "credentialConfigured": true,
      "clientAuthConfigured": false,
      "reasonCode": null
    },
    "attachmentStorage": {
      "status": "UP",
      "mode": "database",
      "backendReachable": true
    },
    "pvtQueue": {
      "status": "DISABLED",
      "workerStatus": "DISABLED",
      "reasonCodes": []
    },
    "patientImages": {
      "status": "DISABLED"
    }
  }
}
```

## 応答ルール
- 返してよい値
  - `status`
  - 固定の `reasonCode`
  - `mode` のような抽象化済み状態
  - `credentialConfigured`, `clientAuthConfigured`, `backendReachable` のような boolean
- 返してはいけない値
  - URL
  - host
  - port
  - scheme
  - username
  - statusCode
  - raw exception message
  - stack trace
  - patient image の max byte / max width / max height
  - storage path / secret reference

## reasonCode 一覧
- `database_unreachable`
- `facility_configuration_missing`
- `orca_transport_not_ready`
- `orca_http_client_unavailable`
- `orca_probe_failed`
- `attachment_storage_not_ready`
- `attachment_storage_backend_unreachable`
- `pvt_queue_over_capacity`
- `pvt_worker_unavailable`
- `patient_images_disabled`
- `patient_images_storage_unavailable`

## 実装タスク
- [x] `LogFilter` の匿名許可対象から詳細 readiness を外す、または `/api/operations/readiness` を新設して認証必須にする。
- [x] `OperationsHealthResource` を liveness / minimal readiness / authenticated readiness の 3 契約に分離する。
- [x] `RestOrcaTransport.ProbeResult` から URL / statusCode / raw message 依存を外し、sanitized reasonCode を返す。
- [x] `AttachmentStorageManager` または専用 health probe に backend 疎通 API を追加する。
- [x] `PvtService.workerHealthBody()` の reason を fixed reasonCode に正規化する。
- [x] JSON 契約テストを追加する。

## 受け入れ条件
- [x] 匿名 readiness 応答に `checks` フィールドが存在しない。
- [x] 認証付き readiness でも URL / host / port / stack trace が JSON に含まれない。
- [x] default facility 未設定時は `facility_configuration_missing` で fail-close し、runtime ORCA config へ fallback しない。
- [x] ORCA / storage / PVT / patient images の DOWN ケースを固定 reasonCode で返す。
- [x] ログと API 応答の双方で secret と接続先詳細を出力しない。

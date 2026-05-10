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

### 2. 匿名 readiness（sanitized detailed）
- `GET /api/health/readiness`
- 認証不要
- 応答例
```json
{
  "status": "UP",
  "checks": {
    "database": {"status": "UP"},
    "auditLog": {"status": "UP"},
    "orca": {
      "status": "UP",
      "mode": "weborca",
      "credentialConfigured": true,
      "clientAuthConfigured": false
    },
    "orcaPush": {
      "status": "DISABLED",
      "mode": "shadow",
      "workerStatus": "DISABLED",
      "connected": false,
      "facilityCount": 0,
      "recoveryEnabled": false
    },
    "attachmentStorage": {
      "status": "UP",
      "mode": "s3",
      "backendReachable": true
    },
    "pvtQueue": {
      "status": "UP",
      "workerStatus": "UP",
      "reasonCodes": []
    },
    "patientImages": {
      "status": "DISABLED"
    }
  }
}
```
- `OperationsReadinessResponse` として、全体 `status` と sanitized `checks` を返す。
- `checks` の key は `database`, `auditLog`, `orca`, `orcaPush`, `attachmentStorage`, `pvtQueue`, `patientImages` を current contract とする。
- detailed checks は匿名で返るため、値は抽象化済み状態・boolean truth・固定 reasonCode に限定する。
- component 名は上記 key だけを許可し、接続先・資格情報・内部例外・詳細設定値を返さない。

### 3. `/api/operations/readiness` の扱い
- `GET /api/operations/readiness`
- current source では JAX-RS resource として公開しない。
- `LogFilter` はこの path を匿名許可対象に含めず、将来 endpoint を追加した場合も認証なしで通さない。
- detailed readiness の現行公開面は `/api/health/readiness` だけである。

## 応答ルール
- 返してよい値
  - `status`
  - 固定の `reasonCode`
  - 固定の `reasonCodes`
  - `mode` のような抽象化済み状態
  - `workerStatus`, `connected`, `facilityCount`, `lastConnectedAt`, `lastEventAt`, `recoveryEnabled` のような抽象化済み稼働状態
  - `credentialConfigured`, `clientAuthConfigured`, `backendReachable` のような abstract boolean truth
- 返してはいけない値
  - URL
  - host
  - port
  - scheme
  - username
  - statusCode
  - raw exception message
  - raw error message
  - stack trace
  - patient image の max byte / max width / max height
  - storage path / secret reference
  - ORCA certificate / CA certificate / password / Basic 認証ヘッダ
  - object storage bucket / object key / prefix

## reasonCode 一覧
- `database_unreachable`
- `audit_log_write_unavailable`
- `facility_configuration_missing`
- `orca_transport_not_ready`
- `orca_http_client_unavailable`
- `orca_probe_failed`
- `orca_push_not_configured`
- `orca_push_runtime_unavailable`
- `attachment_storage_not_ready`
- `attachment_storage_disabled`
- `attachment_storage_backend_unreachable`
- `pvt_queue_over_capacity`
- `pvt_worker_unavailable`
- `patient_images_storage_unavailable`

## 実装タスク
- [x] `/api/health/readiness` を匿名で許可する。ただし detailed checks は sanitized payload に限定する。
- [x] `LogFilter` は `/api/operations/readiness` を匿名許可対象に含めない。
- [x] `OperationsHealthResource` を liveness / sanitized detailed readiness の 2 契約に分離する。
- [x] `auditLog` check は authoritative audit chain head の write path lock を確認し、DB read-only / audit table 欠落 / chain head 欠落を `audit_log_write_unavailable` として fail-closed にする。
- [x] `RestOrcaTransport.ProbeResult` から URL / statusCode / raw message 依存を外し、sanitized reasonCode を返す。
- [x] `AttachmentStorageManager` または専用 health probe に backend 疎通 API を追加する。
- [x] `PvtService.workerHealthBody()` の reason を fixed reasonCode に正規化する。
- [x] JSON 契約テストを追加する。

## 受け入れ条件
- [x] 匿名 readiness 応答が `OperationsReadinessResponse` の sanitized `checks` を返す。
- [x] readiness payload に URL / host / port / scheme / username / statusCode / raw exception / stack trace / secret path が含まれない。
- [x] 監査ログ write path が利用できない場合、readiness は `checks.auditLog.status=DOWN` / `reasonCode=audit_log_write_unavailable` を返し、全体 `status=DOWN` にする。
- [x] default facility 未設定時は `facility_configuration_missing` で fail-close し、runtime ORCA config へ fallback しない。
- [x] ORCA / storage / PVT / patient images の DOWN ケースを固定 reasonCode で返す。
- [x] `attachment.storage.mode=disabled` は `attachmentStorage.status=DISABLED` / `reasonCode=attachment_storage_disabled` のみを返し、bucket / endpoint / prefix / secret reference は返さない。
- [x] ログと API 応答の双方で secret と接続先詳細を出力しない。

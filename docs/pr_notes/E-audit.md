# E-audit 変更メモ

- RUN_ID: `20260221T032538Z`
- ブランチ: `task/e-audit-20260221T032538Z`

## 実施内容
- `consentToken` の生値を監査 details へ保存しないよう変更。
  - `TouchAuditHelper` で `tokenPresent` / `tokenHash` / `tokenHashAlg` を出力。
  - `tokenHash` は `touch.audit.token.hash.secret` / `TOUCH_AUDIT_TOKEN_HASH_SECRET` があれば `HMAC-SHA-256`、未設定時は `SHA-256`。
- `patient_id` カラムの補完を強化。
  - `SessionAuditDispatcher` と `AuditTrailService` で `details.patientId` から `payload.patientId` を補完。
  - 患者系リソース（Touch/ORCA/Karte/Letter/PatientImages）で `payload.setPatientId(...)` を明示。
- `event_hash` の計算材料を拡張。
  - 旧: `previous_hash + payload_hash + timestamp + actorId`
  - 新: `previousHash/payloadHash/eventTime/action/resource/patientId/outcome/ip/traceId/requestId/runId/actorId/actorRole` を順序固定で連結し SHA-256。
- append-only 強化。
  - `AuditTrailService` の persist 後 backfill update を削除（`update AuditEvent ...` を廃止）。
- client IP 解決を共通化。
  - `AbstractResource.resolveClientIp(request)` を追加。
  - `X-Forwarded-For` は「remoteAddr が trusted proxy の場合のみ採用」。
  - trusted proxy は loopback/site-local/link-local + `security.trusted-proxies` / `SECURITY_TRUSTED_PROXIES`（CSV, IP/CIDR）をサポート。
- 監査 details のサニタイズ導入。
  - `AuditDetailSanitizer` を追加し、`*token* / password / authorization / cookie / secret` 系キーを `***` に置換（`tokenHash`/`tokenPresent` は許可）。
- 外部監査ログの個人情報削減。
  - `ExternalServiceAuditLogger` の SMS 宛先電話番号をマスク（末尾4桁のみ可視）。

## D担当へ: 追加すべきDB index案（DDLは本タスク未実施）
1. `d_audit_event(patient_id, event_time DESC)`
   - 患者単位の時系列監査検索を高速化。
2. `d_audit_event(trace_id, event_time DESC)`
   - 1リクエスト追跡（障害解析）を高速化。
3. `d_audit_event(run_id, event_time DESC)`
   - バッチ/実行単位の証跡抽出を高速化。
4. `d_audit_event(action, event_time DESC)`
   - 監査アクション単位の抽出を高速化。

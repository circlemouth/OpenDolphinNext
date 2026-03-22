# ORCA Connection 契約

## 目的
施設別 ORCA 接続設定を fail-closed で解決し、資格情報の暗号化責務を 2FA から分離する。

## 非機能方針
- 後方互換は保持しない。
- 施設未解決時の「最後に保存したレコード」 fallback を禁止する。
- ORCA 資格情報の暗号鍵は 2FA 用鍵と分離する。
- ログ / 監査 / readiness で接続先詳細を出さない。

## 保存モデル
- 設定ファイルまたは永続化モデルは次の論理構造を持つ。
```json
{
  "defaultFacilityId": "facility-a",
  "facilities": {
    "facility-a": {
      "mode": "weborca",
      "baseUrl": "https://example.invalid",
      "pushUrl": "wss://push.example.invalid/ws",
      "pushTenantId": "tenant-a",
      "username": "user-a",
      "passwordEncrypted": "...",
      "clientAuthEnabled": false,
      "clientCertificateP12Encrypted": null,
      "clientCertificatePassphraseEncrypted": null,
      "caCertificateEncrypted": null,
      "version": 1,
      "updatedAt": "2026-03-20T00:00:00Z"
    }
  }
}
```
- `defaultFacilityId` は明示設定のみ許可する。
- 施設更新時に `defaultFacilityId` を暗黙変更してはならない。
- `pushUrl` は施設単位で保持し、`ws://` または `wss://` の絶対 URI 以外を拒否する。
- `pushTenantId` は空許可。空でなければ Push 接続ヘッダへそのまま送るが、コード側でデフォルト注入しない。

## 解決順序
1. 呼び出し引数の facilityId
2. 認証 principal の facilityId
3. `defaultFacilityId`
4. 上記で解決できなければ `facility_configuration_missing`

## 禁止する fallback
- [ ] `_default` を「最後に編集した施設」で上書きしない。
- [ ] `records.values().iterator().next()` を fallback に使わない。
- [ ] facilityId 未解決時に別施設へ接続しない。

## Secret Protector 契約
- `factor2.aes-key-b64` は 2FA のみ。
- `orca.credentials.aes-key-b64` を新設し、ORCA password / client certificate / CA certificate の暗号化にのみ使う。
- ORCA 鍵ローテーション時に TOTP secret が影響を受けないこと。
- TOTP 鍵ローテーション時に ORCA 資格情報が影響を受けないこと。

## ロギング / 監査契約
- 記録してよいもの
  - facilityId
  - mode
  - credentialConfigured
  - clientAuthEnabled
  - caConfigured
  - version
- 記録してはいけないもの
  - baseUrl
  - host
  - port
  - scheme
  - username
  - password
  - certificate 内容
  - pathPrefix

## 実装タスク
- [ ] `SecondFactorSecurityConfig` から ORCA 用保護器を分離し、`OrcaCredentialSecurityConfig` 等の専用設定クラスを追加する。
- [ ] `OrcaConnectionConfigStore` の record 選択ロジックを fail-closed に書き換える。
- [ ] default facility 変更 API / 操作を接続設定更新から分離する。
- [ ] `OrcaTransportSettings.auditSummary()` を抽象化済み情報だけ返すよう変更する。
- [ ] readiness / 監査ログ / 例外メッセージを sanitize する。
- [ ] exact facility hit / explicit default / unresolved failure / protector separation のテストを追加する。

## 受け入れ条件
- [ ] facilityId が不明なときに別施設設定へ接続しない。
- [ ] 施設 A 更新後も default facility が変化しない。
- [ ] 2FA 鍵と ORCA 鍵を別々に回しても相互影響しない。
- [ ] ログと readiness 応答に接続先詳細が含まれない。

# ORCA Connection 契約

## 目的
施設別 ORCA 接続設定を fail-closed で解決し、資格情報の暗号化責務を 2FA から分離する。

## 非機能方針
- 後方互換は保持しない。
- 施設未解決時の「最後に保存したレコード」 fallback を禁止する。
- explicit `defaultFacilityId` が未設定のときに runtime facility / runtime ORCA config へ fallback しない。
- ORCA 資格情報の暗号鍵は 2FA 用鍵と分離する。
- ログ / 監査 / readiness で接続先詳細を出さない。
- `testedScope` や optional module visibility はこの契約に含めない。connection API は施設別接続設定だけを返す。

## 保存モデル
- 設定ファイルまたは永続化モデルは次の論理構造を持つ。
```json
{
  "defaultFacilityId": "facility-a",
  "facilities": {
    "facility-a": {
      "mode": "weborca",
      "baseUrl": "https://example.invalid",
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
- `facilityId` / `defaultFacilityId` には `null` / blank / 大文字小文字を問わない予約語 `default` を許可しない。
- 施設更新時に `defaultFacilityId` を暗黙変更してはならない。
- `PUT /api/admin/orca/connection` は施設別接続設定のみ更新する。
- `PUT /api/admin/orca/connection/default-facility` は `{"defaultFacilityId":"..."}` を受け取り、default facility 切替だけを行う。
- `serverUrl` は設定保存時に検証し、userinfo を含む URL は拒否する。userinfo を黙って除去・正規化して保存してはならない。

## 解決順序
1. 呼び出し引数の facilityId
2. 認証 principal の facilityId
3. `defaultFacilityId`
4. 上記で解決できなければ `facility_configuration_missing`

## 禁止する fallback
- [x] `_default` を「最後に編集した施設」で上書きしない。
- [x] `records.values().iterator().next()` を fallback に使わない。
- [x] facilityId 未解決時に別施設へ接続しない。
- [x] store 不在 / `defaultFacilityId` 未設定 / `facility_configuration_missing` のとき runtime config へ接続しない。

## Secret Protector 契約
- `factor2.aes-key-b64` は 2FA のみ。
- `orca.credentials.aes-key-b64` を新設し、ORCA password / client certificate / CA certificate の暗号化にのみ使う。
- ORCA 鍵ローテーション時に TOTP secret が影響を受けないこと。
- TOTP 鍵ローテーション時に ORCA 資格情報が影響を受けないこと。

## 管理アップロード契約
- `PUT /api/admin/orca/connection` の `clientCertificate` / `caCertificate` filename は表示・監査用メタデータに限定し、保存先パスや信頼境界の判断に使わない。
- filename から path separator、quote、CRLF、制御文字を除去し、path segment が含まれる場合は末尾の basename のみ採用する。
- filename が空または長すぎる場合はフィールドごとの安全な fallback 名を使う。

## ロギング / 監査契約
- 記録してよいもの
  - facilityId
  - mode
  - credentialConfigured
  - clientAuthEnabled
  - caConfigured
  - pushConfigured
  - pushTenantConfigured
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
  - userinfo
- failure response / audit details / readiness / summary log / detail log は raw URL、userinfo、host、secret path、credential を含めない。

## 実装タスク
- [x] `SecondFactorSecurityConfig` から ORCA 用保護器を分離し、`OrcaCredentialSecurityConfig` 等の専用設定クラスを追加する。
- [x] `OrcaConnectionConfigStore` の record 選択ロジックを fail-closed に書き換える。
- [x] default facility 変更 API / 操作を接続設定更新から分離する。
- [x] `OrcaTransportSettings.auditSummary()` を抽象化済み情報だけ返すよう変更する。
- [x] readiness / 監査ログ / 例外メッセージを sanitize する。
- [x] exact facility hit / explicit default / unresolved failure / protector separation のテストを追加する。

## 受け入れ条件
- [x] facilityId が不明なときに別施設設定へ接続しない。
- [x] 施設 A 更新後も default facility が変化しない。
- [x] 2FA 鍵と ORCA 鍵を別々に回しても相互影響しない。
- [x] ログと readiness 応答に接続先詳細が含まれない。

## Charts Disease Mirror
- Charts の病名正本は ORCA `diseasegetv2` の再取得結果です。`/api/local/diagnoses/{patientId}` の server-side projection から `diseasegetv2` を呼ぶ。呼び出し施設は認証済み request context の facilityId で解決し、クライアント提供の facilityId / owner / URL は使わない。
- `diseasegetv2` は既存の ORCA transport / runtime config / allowlist に従い、任意 URL 入力から接続しない。失敗時は `orcaMirrorStatus=unavailable` の sanitized state だけを返し、base URL、host、credential、raw XML、stack trace は返さない。
- mirror response は ORCA projection を `diseases`、既存 local-only disease を `pendingLocalDiseases` として分離する。ORCA unavailable 時に local-only disease を `diseases` へ fallback しない。

## Charts Disease Mutation
- Charts からの ORCA 病名登録・更新・削除は `/api/orca/official/chart-support/disease-mod-v3` だけを使う。
- server は facility / patient access / department / insurance / target disease を server-side で再検証し、クライアント提供の facilityId、任意 URL、raw XML、`Request_Number` を信用しない。
- `operation=create|update|delete|organizeDeletedDiseases` は server-owned enum とする。通常 create/update/delete は `Request_Number` を送らず、delete は `Disease_OutCome=O` を server が生成する。`Request_Number=01` は `organizeDeletedDiseases` の削除病名整理だけで生成する。
- mutation 成功後の Charts 表示は ORCA `diseasegetv2` 再取得結果だけを正本とし、楽観更新や local fallback で成功扱いにしない。

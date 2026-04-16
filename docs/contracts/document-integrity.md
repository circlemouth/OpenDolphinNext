# Document Integrity 契約

## 目的
文書真正性シールを key rotation 可能な方式へ改め、運用中の鍵差し替えで既存文書を読めなくしない。

## 基本方針
- 後方互換は保持しない。
- 単一鍵の直指定を廃止し、keyring を正本とする。
- seal 時は active key を使う。
- verify 時は保存済み `keyId` に対応する key を keyring から引く。
- active key と stored keyId の一致を要求しない。

## Config 契約
- `document.integrity.mode` = `off|permissive|enforce`
- `document.integrity.keyring-path` = keyring JSON の絶対パス
- `mode != off` の場合は keyring path 必須

## Keyring JSON 契約
```json
{
  "algorithm": "HMAC-SHA256",
  "keys": [
    {
      "keyId": "2026-03-primary",
      "status": "active",
      "hmacKeyB64": "BASE64..."
    },
    {
      "keyId": "2026-01-previous",
      "status": "verify-only",
      "hmacKeyB64": "BASE64..."
    }
  ]
}
```

## Keyring validation ルール
- [x] `algorithm` は `HMAC-SHA256` 固定。
- [x] `status=active` はちょうど 1 件。
- [x] `keyId` は重複不可。
- [x] Base64 デコード後 32 bytes 以上。
- [x] `verify-only` キーは verify に使えるが seal には使わない。

## Seal / Verify 契約
### Seal
- active key を使って HMAC を計算する。
- `DocumentIntegrityEntity.keyId` へ active key の `keyId` を保存する。

### Verify
- 保存済み `keyId` で keyring を引く。
- key が見つからなければ `key_not_found`。
- hash / seal / algorithm / version の不一致は fixed reasonCode を返す。
- `mode=enforce` の場合のみ 409 を返す。
- `mode=permissive` は監査記録のみで読み取り自体は継続する。
- attachment canonicalization には `linkId` / `linkRelation` も含め、asset owner と reference row を同一視しない。

## reasonCode 一覧
- `integrity_record_missing`
- `key_not_found`
- `seal_version_mismatch`
- `hash_alg_mismatch`
- `seal_alg_mismatch`
- `content_hash_mismatch`
- `seal_mismatch`

## ローテーション手順
1. keyring に新しい key を追加し `active` にする。
2. 旧 key を `verify-only` に変更する。
3. デプロイ後、新規保存文書は新 key で seal される。
4. 既存文書は旧 key で verify 可能。
5. 旧 key を削除するのは、対象文書の再 seal 完了後に限る。

## 実装タスク
- [x] `DocumentIntegrityConfig` を keyring loader へ書き換える。
- [x] `DocumentIntegrityService.verifyDocumentOnRead()` から active key との一致判定を削除する。
- [x] `ServerConfigurationValidator` に keyring validation を追加する。
- [x] 監査 payload から raw secret と不要な差分情報を除く。
- [x] key rotation / missing key / permissive / enforce のテストを追加する。

## 受け入れ条件
- [x] active key を変更しても旧文書が verify できる。
- [x] `mode=enforce` で only 409 を返し、`mode=permissive` は読み取り継続する。
- [x] malformed keyring / active key 複数 / keyId 重複で起動失敗する。

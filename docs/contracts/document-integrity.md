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
- `document.integrity.mode` = `enforce`
- `document.integrity.keyring-path` = keyring JSON の絶対パス
- runtime は `enforce` 固定。`off` / `permissive` は旧契約の値であり、現行 runtime では起動 validation が拒否する。
- keyring path は常に必須。欠落・相対パス・不正 JSON・active key 不備は fail closed で起動失敗にする。
- dev 起動 (`WEB_CLIENT_MODE=npm ./setup-modernized-env.sh`) は、`DOCUMENT_INTEGRITY_KEYRING_PATH` 未設定時だけ ignored な `tmp/document-integrity-keyring.local.json` を生成し、コンテナ内の read-only path を `DOCUMENT_INTEGRITY_KEYRING_PATH` に設定する。raw key material は stdout / log / tracked file / sample config に出さない。

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
- `mode=enforce` 固定のため、検証失敗時は 409 を返す。
- attachment canonicalization には `linkId` / `linkRelation` も含め、asset owner と reference row を同一視しない。

## Chart revision authority 契約
- `chart_document` は診療録正本チェーンの単位を表す。`document_key` は server 生成値を保存し、client 提供の key / owner / facility を権威情報として採用しない。
- `chart_revision` は本文、SOAP、所見、説明内容、タイトル、添付参照を固定する revision を表す。`status` は `DRAFT`, `FINAL`, `AMENDED`, `ADDENDUM`, `CANCELLED`, `VOIDED` のみに制限する。
- `DRAFT` 以外の revision は直接更新不可の対象であり、後続の訂正・追記・取消は `chart_revision_event` と新 revision で表す。既存 revision の本文や title を物理上書きしない。
- `FINAL` / `AMENDED` / `ADDENDUM` / `CANCELLED` / `VOIDED` の revision は DB trigger でも `chart_revision` の UPDATE / DELETE を拒否する。legacy `d_document` / `d_module` が locked revision に紐付く場合、title と SOAP / module payload の直接 UPDATE / DELETE も拒否する。
- `chart_document.current_revision_id` は、現在 revision が locked 状態になった後に別 revision へ直接差し替えない。訂正・追記・取消 API は event と新 revision の作成を authority とし、current pointer の単独差し替えで履歴を隠さない。
- `chart_revision_event` は revision chain の状態遷移、理由、変更前後 summary を保存する。summary には raw 患者氏名、住所、電話番号、保険詳細、raw ORCA body、credential、Cookie、Authorization、CSRF token を保存しない。
- `POST /api/charts/{chartId}/revisions/{revisionId}/finalize` は `DRAFT` revision だけを対象にする。確定時は ORCA患者番号、患者氏名、生年月日、性別、encounter、診療日、ORCA受付IDまたは受付なし理由、診療科、担当医、保険組合せ、確定者、canonical content JSON を必須検証する。
- `content_hash` は chart finalize API が確定時に server-side canonical content と確定 context から計算する。client 提供 digest は採用しない。
- finalize event summary は hash、encounter、診療科、担当医、保険組合せ、受付 context の有無だけを保存し、患者氏名、住所、電話番号、保険詳細、raw ORCA body、credential、Cookie、Authorization、CSRF token を保存しない。

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
- [x] key rotation / missing key / enforce のテストを追加する。
- [x] `chart_document` / `chart_revision` / `chart_revision_event` の最小 schema と `ChartRevisionStatus` enum を追加する。
- [x] locked chart revision、legacy document title、legacy SOAP / module payload、current revision pointer の直接更新拒否 trigger と regression test を追加する。
- [x] finalize API skeleton、必須 context validation、server-side `content_hash` 生成、FINALIZED event 記録を追加する。

## 受け入れ条件
- [x] active key を変更しても旧文書が verify できる。
- [x] `mode=enforce` で only 409 を返す。
- [x] malformed keyring / active key 複数 / keyId 重複で起動失敗する。
- [x] `chart_revision.status` は `DRAFT`, `FINAL`, `AMENDED`, `ADDENDUM`, `CANCELLED`, `VOIDED` のみに DB 制約と Java enum で制限される。
- [x] locked revision の本文・SOAP / module payload・title・current revision pointer 直接更新は DB guard と service guard の両方で拒否される。
- [x] finalize API は必須 context 欠落、chart/revision 不一致、非 DRAFT 再確定を拒否し、server-side canonical hash を記録する。

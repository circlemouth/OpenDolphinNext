# ORCA Master API 契約

## 目的
current repo の server 実装が提供する ORCA master read API の contract を固定し、未実装 placeholder やサポート外 parameter を残さない。

## 方針
- 後方互換は保持しない。
- 実装されていない `scope` は削除する。
- 「今は効かないが将来使う」 parameter を残さない。
- table / column は current repo の schema evidence で確認できた範囲だけを使い、推測名を commit しない。
- 503 は backend unavailable のときだけ返す。
- cache / ETag / audit は既存 master API と同じ規約に揃える。

## `/api/orca/master/generic-price` 契約
### 受け付ける query parameter
- `srycd`
- `effective`

### 挙動
- `srycd` は 9 桁必須。不正時は 422 `SRYCD_VALIDATION_ERROR`。
- exact code lookup とする。
- 0 件は 404 `MASTER_GENERIC_PRICE_NOT_FOUND`。
- backend unavailable は 503 `MASTER_GENERIC_PRICE_UNAVAILABLE`。
- 成功時は単一の generic price entry を返し、ETag / Cache-Control を付与する。

## `/api/orca/master/hokenja` 契約
### 受け付ける query parameter
- `pref`
- `keyword`
- `effective`
- `page`
- `size`
- `includeTotalCount`

### 挙動
- `pref` は指定時 2 桁都道府県コード。不正時は 422 `PREF_VALIDATION_ERROR`。
- search endpoint とする。
- 0 件は 200 で空 list を返す。
- backend unavailable は 503 `MASTER_HOKENJA_UNAVAILABLE`。
- 成功時は list response として返し、ETag / Cache-Control を付与する。

## `/api/orca/master/address` 契約
### 受け付ける query parameter
- `zip`
- `effective`

### 挙動
- `zip` は 7 桁必須。不正時は 422 `ZIP_VALIDATION_ERROR`。
- zip exact lookup とする。
- 0 件は 404 `MASTER_ADDRESS_NOT_FOUND`。
- backend unavailable は 503 `MASTER_ADDRESS_UNAVAILABLE`。
- 成功時は単一の address entry を返し、ETag / Cache-Control を付与する。

## `/api/orca/master/drug` 契約
### 受け付ける query parameter
- `keyword`
- `effective`
- `method`
- `page`
- `size`
- `includeTotalCount`

### 受け付けない query parameter
- `scope`

### `scope` を受け取った場合の挙動
- 400 `unsupported_parameter`
- メッセージ: `scope query parameter is not supported`
- silent ignore を禁止する。

## 実装タスク
- [x] `OrcaMasterResource` から `scope` の解決・criteria 反映を削除する。
- [x] `OrcaMasterDao` の `appendDrugScopeFilter()` を削除する。
- [x] API 契約テストを追加し、`scope` 指定時 400 を検証する。
- [x] 将来 `scope` を導入する場合は、列マッピング・fixture・DB fixture・利用画面を含む別チケットで再設計する。
- [x] `generic-price` / `hokenja` / `address` を placeholder 503 ではなく live query contract に差し替える。
- [x] schema validator と table metadata に `generic-price` / `hokenja` / `address` の supported contract を追加する。
- [x] `OrcaMasterResourceTest` で success / validation / not found / cache / backend unavailable を検証する。

## 受け入れ条件
- [x] `scope` が API 仕様・コード・テスト・文書のいずれにも残らない。
- [x] 利用者が unsupported parameter を使った際に明示的な 400 を受け取る。
- [x] `generic-price` / `hokenja` / `address` が placeholder stub ではなく実データ contract を返す。
- [x] 503 は backend unavailable 時に限定される。

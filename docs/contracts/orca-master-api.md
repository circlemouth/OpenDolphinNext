# ORCA Master API 契約

## 目的
サポートしていない query parameter を API から排除し、利用者に誤解を与えない。

## 方針
- 後方互換は保持しない。
- 実装されていない `scope` は削除する。
- 「今は効かないが将来使う」 parameter を残さない。

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

## 受け入れ条件
- [x] `scope` が API 仕様・コード・テスト・文書のいずれにも残らない。
- [x] 利用者が unsupported parameter を使った際に明示的な 400 を受け取る。

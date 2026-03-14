# P5-01 `/karte/docinfo/all` 契約棚卸し

- 作成日: 2026-03-14
- RUN_ID: 20260314T000119Z

## 現行実装の契約

- エンドポイント: `GET /karte/docinfo/all/{patientPk}`
- 実装入口: `server-modernized/src/main/java/open/dolphin/rest/KarteResource.java`
- 実データ取得: `server-modernized/src/main/java/open/dolphin/session/KarteServiceBean.java#getAllDocument(long)`
- 並び順: `started desc, id desc`
- 返却形式: `LegacyKarteListResponse.DocumentListResponse` 配下の `KarteRevisionDocumentResponse` 配列

## 現行 payload の実体

`getAllDocument(long)` は `DocumentLoadMode.ATTACHMENT_LIGHT` を使用しており、実際の内容は以下。

- 返す:
  - 文書本体メタデータ: `id`, `confirmed`, `started`, `ended`, `recorded`, `linkId`, `linkRelation`, `status`
  - `docInfoModel` 一式
  - `userModel.id`, `userModel.commonName`
  - `karteBean.id`
  - `schema` はフル読込
    - `uri`, `digest`, `extRefModel`, `imageBytes` を含む
  - `attachment` はメタデータのみ
    - `fileName`, `contentType`, `contentSize`, `lastModified`, `digest`, `title`, `extension`, `uri`, `memo`

- 返さない:
  - `modules`
  - `attachment.contentBytes`

## 既存テストで守られている点

- `server-modernized/src/test/java/open/dolphin/session/KarteServiceBeanGetDocumentsBulkFetchTest.java`
  - `ATTACHMENT_LIGHT` で module query を発行しない
  - `schema` は取得する
  - `attachment.contentBytes` は `null`
- `/docinfo/all` 専用の resource contract test は未整備

## 現行利用の確認

- `web-client` からの現行参照は見つからない
- 旧 Java client では `DocumentDelegater#getAllDocument()` から一括 PDF 出力に使用している
  - ただし旧 client は `modules` と `schema` バイト列を期待しており、server-modernized 実装とは既に一致していない

## P5-02 で採る契約案

後方互換性は考慮しない前提で、server-modernized 側の契約を一覧 API として再定義する。

- エンドポイントは維持: `GET /karte/docinfo/all/{patientPk}`
- ページングは query parameter で追加する
  - `offset`
  - `limit`
- 既定値は PVT 一覧と同じ方針に合わせる
  - default `limit=50`
  - max `limit=200`
- 並び順は現行どおり `started desc, id desc`
- 一覧レスポンスで残す項目
  - 文書本体メタデータ
  - `docInfoModel`
  - `userModel.id`, `userModel.commonName`
  - `karteBean.id`
  - `schema` は metadata のみ
  - `attachment` は metadata のみ
- 一覧レスポンスから外す項目
  - `modules`
  - `schema.imageBytes`
  - `attachment.contentBytes`

## P5-02 実装時の注意

- まず ID 一覧取得 query に `offset/limit` を入れる
- `loadDocuments(...)` の light mode を一覧専用にもう一段軽くする
- `/docinfo/all` 専用 contract test を追加し、ページ境界と binary 非同梱を固定する

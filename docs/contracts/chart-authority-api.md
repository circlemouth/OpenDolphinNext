# Chart Authority API Contract

## Purpose

診療録本文、SOAP、タイトル、添付参照は OpenDolphinNext の正本であり、`chart_revision` authority を通して扱う。
本番 public runtime では legacy `POST|PUT|DELETE /api/karte/document` と `PUT /api/karte/document/{id}` を公開しない。

## Public authority routes

| Route | Purpose | Authority rule |
| --- | --- | --- |
| `POST /api/charts/document-drafts` | 診療録下書き作成 | `chart_document` と `chart_revision(status=DRAFT)` を作成する。facility と患者は `karte_id` から server-side に解決し、client 提供の facility / owner / role / digest / uri / objectKey は採用しない。 |
| `POST /api/charts/{chartId}/revisions/{revisionId}/finalize` | DRAFT の確定 | DRAFT のみ対象。確定 context と canonical content から server-side content hash を計算し、`FINALIZED` event を append する。 |
| `POST /api/charts/{chartId}/revisions/{revisionId}/amend` | 訂正 | locked revision のみ対象。元 revision は物理更新せず、新 revision と `AMENDED` event を append する。 |
| `POST /api/charts/{chartId}/revisions/{revisionId}/addendum` | 追記 | locked revision のみ対象。元 revision は物理更新せず、新 revision と `ADDENDUM_ADDED` event を append する。 |
| `POST /api/charts/{chartId}/revisions/{revisionId}/cancel` | 取消 | locked revision のみ対象。本文・SOAP・添付を削除せず `CANCELLED` event を append する。 |

## Removed legacy public routes

次の route は test fixture / migration support class に残っていても、`OpenDolphinRestApplication` に登録してはならない。

- `POST /api/karte/document`
- `PUT /api/karte/document`
- `PUT /api/karte/document/{id}`
- `DELETE /api/karte/document/{id}`

## Security rules

- 確定済み revision の本文、SOAP、タイトル、添付参照は直接上書きしない。
- タイトル変更だけの API は提供しない。意味内容を変えるタイトル変更は訂正または追記 event として扱う。
- facility は authenticated remote user と DB 上の `karte` / `chart_document` から server-side に解決する。
- client 提供の `facilityId`, `ownerId`, `role`, `uri`, `digest`, `objectKey` は正本値にしない。
- `chart_revision_event` は append-only とし、UPDATE / DELETE を DB guard で拒否する。
- locked `chart_revision`、legacy `d_document` title、legacy SOAP/module payload、`chart_document.current_revision_id` の直接更新は DB guard と service/API guard の両方で拒否する。

## Required regression checks

- route inventory が legacy `karte/document` 書込 route を含まないこと。
- `OpenDolphinRestApplication` が `KarteDocumentWriteResource` を登録しないこと。
- 確定済み診療録 ID に対する legacy PUT 相当の直接更新が service guard で `karte.document.finalized_update_denied` になること。
- locked revision / legacy title / module / current revision pointer の直接 DB 更新が trigger で拒否されること。

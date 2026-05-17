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
| `POST /api/local/charts/edit-sessions/acquire|heartbeat|release` | 編集 lease | Web tab lock の他端末対応補助。facility は server-side session から解決し、患者存在確認後に `chart_edit_session` の TTL lease を作成・延長・解放する。lease scope は server-side で `patient:{patientId}` に canonicalize し、client 提供の受付/予約/encounter ID で別 lock を作らせない。active lease が別端末にある場合は 409。 |
| `POST /api/local/charts/subjectives` | SOAP/F append-only 記載 | `S/O/A/P/F` を既存カードの上書きではなく append-only entry として保存する。既存 entry 更新を示す `entryId` / `expectedEntryHash` は 409。readback は `entryId`, `baseChartRevisionId`, `contentHash` を返す。 |

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
- 編集ロックは事故低減の一次防壁であり、真正性は保存 API の `baseRevisionId` / `contentHash` / `expectedContentHash` / `expectedRevisionId` で守る。lock 所有中でも stale save は fail closed にする。
- 旧 `PatientFreeDocument` 更新は既存行がある場合 `expectedContentHash` 必須。不一致または欠落は 409 `patient_free_document_conflict` とし、last-write-wins に戻さない。
- order bundle の update/delete は `documentId + expectedContentHash` 必須。不一致または欠落は 409 `order_bundle_conflict` とし、新規 create/create だけを並列追加として温存する。
- `chart_revision_event` は append-only とし、UPDATE / DELETE を DB guard で拒否する。
- locked `chart_revision`、legacy `d_document` title、legacy SOAP/module payload、`chart_document.current_revision_id` の直接更新は DB guard と service/API guard の両方で拒否する。

## Required regression checks

- route inventory が legacy `karte/document` 書込 route を含まないこと。
- `OpenDolphinRestApplication` が `KarteDocumentWriteResource` を登録しないこと。
- 確定済み診療録 ID に対する legacy PUT 相当の直接更新が service guard で `karte.document.finalized_update_denied` になること。
- locked revision / legacy title / module / current revision pointer の直接 DB 更新が trigger で拒否されること。
- SOAP/F 同時保存で複数 entry が残り、既存 entry 更新 intent は 409 になること。
- FreeDocument の stale `expectedContentHash` が 409 になり、旧単一行更新で last-write-wins が残らないこと。
- order bundle create/create は両方保存され、同一既存 bundle update/delete の stale hash は 409 になること。

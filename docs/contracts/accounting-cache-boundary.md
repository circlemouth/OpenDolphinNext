# Accounting Cache Boundary Contract

## Purpose

会計、収納、領収、帳票、レセプト関連情報を ORCA / WebORCA 正本由来の cache / snapshot / log として扱う境界を固定する。

OpenDolphinNext は会計・収納・領収・帳票・レセプトを独立正本化しない。保存できるのは、server-side ORCA adapter が取得した sanitized cache、snapshot、request/response hash、operation ledger、reconciliation summary だけである。

## Source Of Truth

| 領域 | 正本 | OpenDolphinNext に保存できるもの |
| --- | --- | --- |
| 会計 | ORCA / WebORCA | `orca_billing_cache`、hash、件数、sanitized summary |
| 収納 | ORCA / WebORCA | incomeinfv2 cache、入金額 summary、invoice hash |
| 領収 | ORCA / WebORCA | report snapshot、invoice hash、Data_Id hash |
| 帳票 | ORCA / WebORCA | `orca_report_snapshot`、server-generated storage metadata、upload status |
| レセプト | ORCA / WebORCA | snapshot / report metadata / reconciliation summary |

## Required Cache Metadata

ORCA由来 accounting cache は可能な限り次を持つ。

- `sourceSystem=ORCA`
- `sourceApi`
- `fetchedAt`
- `acceptanceId`
- `visitDate`
- `department`
- `insuranceCombination`
- request hash
- response hash
- cache / snapshot status
- sanitized summary

`acceptanceId` が ORCA response から取得できない場合は null のまま保持し、client 由来値で補完しない。`visitDate`、`department`、`insuranceCombination` は ORCA response または server-derived encounter context から取得した場合だけ保存する。

## Guards

- ORCA会計済み情報を未送信候補や local draft で上書き・取消しない。
- `medicalmodv2` 送信成功だけで会計済み、収納済み、領収済み、レセプト済みにしない。
- `storageUploadStatus=UPLOADED` は report binary が保存されたことだけを意味し、会計済み・収納済み・レセプト正本化を意味しない。
- client 提供の patient / facility / voucher / sequential / insurance / `Medical_Uid` / invoice / `Data_Id` / URI / object key / digest を cache authority にしない。
- ORCA `UNKNOWN`、warning、unmatched、conflict、`NEEDS_REVIEW` は UI と export で成功扱いしない。

## UI Labeling

会計情報表示 UI は、ORCA由来であること、取得日時、受付ID、診療日、診療科、保険組合せを見える位置に表示する。

ORCA側のみ存在する会計済み情報、収納情報、帳票情報は warning / needs review として扱い、OpenDolphinNext 側の独立正本として編集・取消できる表示にしない。

## Evidence Boundary

review / export / backup / validation evidence は次に限定する。

- row count
- request / response hash
- invoice / Data_Id hash
- source system / source API
- cache / snapshot status
- fetched timestamp
- storage upload status
- report binary availability
- sanitized warning / mismatch / reconciliation status

raw ORCA body、raw invoice number、raw `Data_Id`、raw `Medical_Uid`、帳票本文、ORCA認証情報、証明書情報、storage key/digest authority、HAR、trace、video、screenshot、raw network JSON は evidence に含めない。

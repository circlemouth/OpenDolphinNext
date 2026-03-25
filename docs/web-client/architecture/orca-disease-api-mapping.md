# Charts 病名編集と local diagnosis / ORCA live API 対応表

- 更新日: 2026-03-25
- RUN_ID: 20260325T045414Z

## 目的
Charts の病名編集（`/api/local-summary/diagnoses`）と ORCA live disease master API の役割差分を整理し、local diagnosis と ORCA live を public surface で混在させない。

## 対応表（UI → WebClient → ORCA）

| UI/機能 | WebクライアントAPI | server-modernized 経由の ORCA API | 方向 | 備考 |
| --- | --- | --- | --- | --- |
| 病名一覧の取得（Charts 病名パネル） | `GET /api/local-summary/diagnoses/{patientId}` | なし | 取得 | local diagnosis projection のみ返す。response に `karteId` を含める。 |
| 病名の作成/更新/削除（Charts 病名編集） | `POST /api/local-summary/diagnoses` | なし | 更新 | `patientId + karteId` を top-level scope とし、`update/delete` は `diagnosisId` 必須。 |
| ORCA live 病名マスタ参照（候補検索） | `GET /api/orca-live/disease-master/name/{param}/` | ORCA DB `tbl_byomei` | 取得 | コード候補 lookup 専用。local diagnosis response schema とは分離する。 |
| ORCA 原本参照/直送（原本パネル） | `POST /api01rv2/diseasegetv2?class=01` / `POST /orca22/diseasev3?class=01` | 同左 | 検証 | XML2 を直接扱う検証用途。Charts の通常編集経路には混在させない。 |

## 用語整理
- **Charts 病名編集**: UI での CRUD 操作。`/api/local-summary/diagnoses` 経由で local diagnosis を更新する。
- **ORCA live disease master**: 病名コード候補の lookup 専用。CRUD 契約とは分離する。
- **ORCA 原本パネル**: XML2 を直接送信/表示する検証用途。運用時は主にデバッグで使用。

## 補足（運用指針）
- 病名編集の正規経路は `GET /api/local-summary/diagnoses/{patientId}` + `POST /api/local-summary/diagnoses`。
- ORCA live の候補 lookup は `GET /api/orca-live/disease-master/name/{param}/` に限定する。
- `diseasegetv2/diseasev3` の生 XML は **原本検証**・**差分調査**にのみ使用し、本番操作は上記正規経路に統一する。

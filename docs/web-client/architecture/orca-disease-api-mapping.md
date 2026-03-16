# Charts 病名編集と ORCA 原本 API 対応表

- 更新日: 2026-01-13
- RUN_ID: 20260113T080259Z

## 目的
Charts の病名編集（`/api/orca/disease`）と ORCA 原本 API（`diseasegetv2`/`diseasev3`）の役割差分を整理し、送信経路の混在を避ける。

## 対応表（UI → WebClient → ORCA）

| UI/機能 | WebクライアントAPI | server-modernized 経由の ORCA API | 方向 | 備考 |
| --- | --- | --- | --- | --- |
| 病名一覧の取得（Charts 病名パネル） | `GET /api/orca/disease/import/{patientId}` | `POST /api01rv2/diseasegetv2?class=01` | 取得 | `DiseaseImportResponse` に変換して UI へ返却。`runId/apiResult` を透過。 |
| 病名の作成/更新/削除（Charts 病名編集） | `POST /api/orca/disease` | `POST /orca22/diseasev3?class=01` | 更新 | `operations=create|update|delete` を受け取り ORCA へ反映。`diagnosisId` の再割当は server 側で管理。 |
| ORCA 原本参照（原本パネル） | `POST /api01rv2/diseasegetv2?class=01` | 同左 | 取得 | XML2 をそのまま表示。`Api_Result`/`missingTags` を UI バナーで可視化。 |
| ORCA 原本直送（原本パネル） | `POST /orca22/diseasev3?class=01` | 同左 | 更新 | XML2 を直接送信。Charts 病名編集とは別経路であり、**通常運用では原本パネルは検証用途**。 |

## 用語整理
- **Charts 病名編集**: UI での CRUD 操作。`/api/orca/disease` 経由で server-modernized が ORCA に反映する。
- **ORCA 原本パネル**: XML2 を直接送信/表示する検証用途。運用時は主にデバッグで使用。

## 補足（運用指針）
- 病名編集の正規経路は `GET /api/orca/disease/import/{patientId}` + `POST /api/orca/disease`。
- `diseasegetv2/diseasev3` の生 XML は **原本検証**・**差分調査**にのみ使用し、本番操作は上記正規経路に統一する。

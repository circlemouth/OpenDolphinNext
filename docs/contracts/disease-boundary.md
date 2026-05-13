# Disease Boundary Contract

最終更新: 2026-05-13

## 目的

病名の ORCA 正本と OpenDolphinNext 側の local 候補を分離し、local 候補を ORCA 登録済み病名に見せない。

## 正本境界

| 区分 | 正本 | API / 表示 | 更新可否 |
| --- | --- | --- | --- |
| ORCA登録病名 | ORCA / WebORCA | `diseasegetv2?class=01` を server が取得し、`/api/local/diagnoses/{patientId}` の `diseases[]` として返す | `diseasev3` 後の再取得結果だけを主一覧へ表示 |
| ORCA病名mutation結果 | ORCA / WebORCA response + operation audit | `/api/orca/official/chart-support/disease-mod-v3` | warning / unmatch / needs review を成功表示に潰さない |
| local候補 | OpenDolphinNext candidate | `pendingLocalDiseases[]`、`layer=candidate`、`candidateKind=draftCandidate` | ORCA未登録。明示確認後に `diseasev3` 送信候補にできる |
| 診療録本文中の病名記載 | OpenDolphinNext 診療録本文正本 | `DiagnosisEditPanel` の「診療録本文中の病名記載」枠 | ORCA病名正本ではなく、自動送信しない |

## API 契約

- `GET /api/local/diagnoses/{patientId}?baseMonth=yyyyMM` は Charts 用 read model であり、local病名の作成・更新・削除 route ではない。
- `diseases[]` は ORCA `diseasegetv2?class=01` の再取得 projection だけを含める。
- `pendingLocalDiseases[]` は local 候補だけを含め、`layer=candidate`、`candidateKind=draftCandidate`、`sourceOfTruth=local-candidate`、`candidateOnly=true`、`readOnly=true` を返す。
- ORCA取得不可時は `orcaMirrorStatus=unavailable`、`diseases=[]` とし、local候補を `diseases[]` へ fallback しない。
- ORCA `Api_Result=21` は connected empty mirror として扱い、取得不能と混同しない。
- 病名 create / update / delete / organize は `/api/orca/official/chart-support/disease-mod-v3` だけを使用する。
- `diseasev3` が accepted でも `postMutationMirrorStatus=unavailable` の場合は登録済み表示に昇格せず、要確認として表示する。

## UI 契約

- `DiagnosisEditPanel` の主一覧は「ORCA登録病名」とし、ORCA再取得結果だけを表示する。
- local候補は「送信候補」枠に隔離し、「ORCA登録済みではありません」と明示する。
- 診療録本文中の病名記載はカルテ本文正本であり、ORCA登録病名ではないことを表示する。
- ORCA warning / unmatch / ORCA側のみ存在する未照合病名は初期表示し、details / accordion 内だけに隠さない。
- ORCA送信失敗、警告、不一致、UNKNOWN、再取得不能を「登録済み」「反映済み」「完了」と表示しない。

## 監査・安全要件

- `diseasev3` operation は request / response hash、operation status、warning / unmatch summary、actor、対象患者、対象診療録または encounter を監査可能にする。
- raw ORCA XML、ORCA URL、Basic認証、証明書、証明書パスワード、患者詳細、保険詳細を API 応答、ブラウザ、ログ、成果物に出さない。
- local候補の存在は ORCA登録の証跡ではない。会計送信や診療録 snapshot では、明示送信対象になった病名と ORCA再取得結果を区別する。

## Misuse Case

- local候補を `readOnly=false` の編集可能 local 病名として扱い、ORCA登録病名一覧へ混ぜる。
- `diseasev3` 失敗、warning、unmatch、post-mutation mirror unavailable を成功表示に潰す。
- ORCA側のみ存在する未照合病名を local候補で上書き、隠蔽、または自動整理する。

## 検証

- `LocalDiagnosisResourceTest` は local候補が `draftCandidate` として返り、ORCA mirror 取得不能時に主 `diseases[]` へ fallback しないことを固定する。
- `DiagnosisEditPanel.test.tsx` は ORCA登録病名、ORCA側のみ病名、送信候補、診療録本文中の病名記載を分離し、warning / unmatch を初期表示することを固定する。
- `httpClient.test.ts` は metadata が `official diseasegetv2`、`official diseasev3`、`local candidate` の3分類を持ち、local病名CRUDを示さないことを固定する。

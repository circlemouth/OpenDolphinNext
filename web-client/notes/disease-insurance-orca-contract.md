# Disease Insurance / ORCA Contract

この文書は Charts の Disease を ORCA 正本として扱うための current contract を定義します。

## Scope
- `ORCA登録病名`: Charts の主病名一覧の source of truth。ORCA `diseasegetv2` の再取得結果だけを表示する。
- `院内未送信`: 既存 local-only disease や ORCA 未送信の下書き。主病名一覧には混ぜない。
- `候補`: master / order-set / 補助入力から来る candidate source
- `clinical`: 外部の臨床病名 source。未接続の間は current writable surface に昇格しない

## Fixed Boundary
- Charts の主病名一覧は `GET /api/local/diagnoses/{patientId}` が返す ORCA `diseasegetv2` projection だけを表示します。
- ORCA 取得不可時に local-only disease を主病名一覧へ fallback 表示しません。病名登録・更新・削除も disabled にします。
- ORCA 病名の create / update / delete は `/api/orca/official/chart-support/disease-mod-v3` だけを使い、成功後の `diseasegetv2` 再取得結果が UI truth です。
- `院内未送信` は隔離表示し、ORCAへ登録する明示 confirm がある場合だけ `diseasev3` へ送信します。
- `候補` は truth ではありません。明示 confirm なしで ORCA 登録 payload に昇格させません。
- 外部の臨床病名 source が未接続の間は fake list を出さず、boundary note で止めます。

## Canonical Notes
- `同期候補があります`
- `ORCA側と差分があります`
- `保険病名の確認が必要です`
- `ORCA病名を取得できませんでした。ORCA正本を確認できないため、病名の登録・更新・削除はできません。`
- `候補は自動反映されません。内容を確認してからORCAへ病名登録してください。`
- `院内未送信の病名があります。ORCAへ登録するまで主病名一覧には反映しません。`

## Conflict Matrix
| 状態 | ORCA登録病名 | 院内未送信 | 候補 | UI / fallback |
| --- | --- | --- | --- | --- |
| normal | truth | 隔離表示 | 補助入力 | ORCA 再取得結果を主一覧に表示 |
| candidate available | truth | 隔離表示 | truth ではない | `同期候補があります` を表示し、明示 confirm のみ許可 |
| local-only exists | truth | ORCA未送信 | 補助入力 | `院内未送信` 枠へ隔離し、主一覧に混ぜない |
| mirror unavailable | unavailable | 隔離表示 | 補助入力 | 主一覧は fallback せず、ORCA mutation を disabled |
| clinical unavailable | truth または unavailable | 隔離表示 | 補助入力 | clinical unavailable note を表示し fake list を出さない |

## Fallback Gates
- UG-04 解決: insurance-local は正本ではなく `院内未送信` 枠に隔離する。
- UG-05 解決: Charts は `/api/local/diagnoses/{patientId}` の server-side projection から ORCA `diseasegetv2` mirror を取得し、`ORCA登録病名` として主一覧に表示する。
- UG-06 解決: local-only と ORCA projection は auto-merge / auto-overwrite せず、local-only は `院内未送信` として明示登録まで隔離する。
- UG-07 未解決: outcome preset は input assist のみ

## Charts ORCA Mirror API
- Charts の病名欄は `GET /api/local/diagnoses/{patientId}` を使用する。クライアントは `facilityId` / owner / storage key / ORCA URL を送らず、サーバーは認証済みセッションの施設で患者とカルテを解決してから ORCA mirror を取得する。
- ORCA mirror の取得は server-side ORCA transport の allowlist / runtime config に従い、任意 URL は受け付けない。ORCA response は外部入力として XML secure parser で読み、allowlist 済みの病名名、コード、開始日、転帰、診療科、保険組合せ番号だけを projection する。
- response は `sourceOfTruth=orca`、`orcaMirrorStatus=connected|unavailable`、主一覧用 `diseases`、隔離表示用 `pendingLocalDiseases` を返す。`diseases` に local-only entry を混ぜません。
- `connected` で ORCA mirror が空の場合は「ORCAに登録済みの病名はありません。」、`unavailable` の場合は「ORCA病名を取得できませんでした。ORCA正本を確認できないため、病名の登録・更新・削除はできません。」を表示する。
- 候補や local-only entry は明示操作なしに ORCA 登録 payload へ昇格しない。取得成功時に旧文言「ORCA病名の参照取得はこの画面ではまだ接続されていない」は表示しない。
- ORCA transport failure / parser failure / non-zero ORCA result は fail closed とし、内部 URL、資格情報、raw XML、stack trace、ORCA 詳細メッセージを API response / UI に出さない。

## Charts ORCA Disease Mutation API
- ORCA 病名 mutation は `/api/orca/official/chart-support/disease-mod-v3` を使用する。
- client は `operation=create|update|delete|organizeDeletedDiseases` と入力内容だけを送る。`Request_Number`、raw XML、任意 URL、facilityId は受け付けない。
- server は `Request_Number` を server-owned にする。通常 `create|update|delete` は `Request_Number` を送らず、`delete` は `Disease_OutCome=O` を server が生成する。
- `operation=organizeDeletedDiseases` の場合だけ server が `Request_Number=01` を生成する。`Request_Number=01` を通常削除へ混入させない。
- `Request_Number=02/03/04` は今回の UI/API からは送らず、client provided value は 400 で拒否する。
- `update|delete` は mutation 前に ORCA `diseasegetv2` を再取得して target が存在することを server-side で確認し、drift 時は fail closed にする。
- mutation 成功後は楽観更新せず、`diseasegetv2` 再取得結果だけで Charts の主病名一覧を更新する。

## Order Set Rule
- order-set の disease は candidate-only semantics です。
- order-set 適用時に disease candidate を silent create しません。
- candidate を保険病名へ反映する責務は `DiagnosisEditPanel` の explicit confirm に限定します。

## References
- [ui-current-contract.md](./ui-current-contract.md)
- [feedback-spec.md](./feedback-spec.md)
- [README.md](./README.md)

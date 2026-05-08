# Disease Insurance / ORCA Contract

この文書は Disease を single-list truth で扱わないための current contract を定義します。

## Scope
- `保険病名`: 院内ローカルの authoring truth
- `ORCA mirror`: ORCA 由来の read-only mirror
- `候補`: master / order-set / 補助入力から来る candidate source
- `clinical`: 外部の臨床病名 source。未接続の間は current writable surface に昇格しない

## Fixed Boundary
- `保険病名` だけが create / update / delete できます。
- `ORCA mirror` は read-only です。auto-merge / auto-delete / auto-overwrite を禁止します。
- `候補` は truth ではありません。明示 confirm なしで `保険病名` に昇格させません。
- 外部の臨床病名 source が未接続の間は fake list を出さず、boundary note で止めます。

## Canonical Notes
- `同期候補があります`
- `ORCA側と差分があります`
- `保険病名の確認が必要です`
- `ORCA病名の参照取得はこの画面ではまだ接続されていないため、ORCA側との同期状態は未確認です。保険病名はこの画面で登録・編集できます。`
- `外部の臨床病名ソースは未接続です。ここでは院内の保険病名を登録・編集し、候補は確認後に反映します。`

## Conflict Matrix
| 状態 | 保険病名 | ORCA mirror | 候補 | UI / fallback |
| --- | --- | --- | --- | --- |
| normal | truth | 参照専用 | 補助入力 | 3層を分けて表示 |
| candidate available | truth | 参照専用 | truth ではない | `同期候補があります` を表示し、明示 confirm のみ許可 |
| mirror diff / stale | truth | 参照専用 | 補助入力 | `ORCA側と差分があります` と `保険病名の確認が必要です` を default visible |
| mirror unavailable | truth | unavailable | 補助入力 | `保険病名の確認が必要です` と mirror unavailable note を表示 |
| clinical unavailable | truth | 参照専用または unavailable | 補助入力 | clinical unavailable note を表示し fake list を出さない |

## Fallback Gates
- UG-04 未解決: insurance-local のみ writable
- UG-05 解決: Charts は `/api/local/diagnoses/{patientId}` の server-side projection から ORCA `diseasegetv2` mirror を取得し、`layer=orca-mirror` / `readOnly=true` として表示する。
- UG-06 解決: local 保険病名と ORCA mirror は auto-merge / auto-overwrite せず、差分がある場合は `ORCA側と差分があります` と `保険病名の確認が必要です` を表示する。
- UG-07 未解決: outcome preset は input assist のみ

## Charts ORCA Mirror API
- Charts の病名欄は `GET /api/local/diagnoses/{patientId}` を使用する。クライアントは `facilityId` / owner / storage key を送らず、サーバーは認証済みセッションの施設で患者とカルテを解決してから ORCA mirror を取得する。
- ORCA mirror の取得は server-side ORCA transport の allowlist / runtime config に従い、任意 URL は受け付けない。ORCA response は外部入力として XML secure parser で読み、allowlist 済みの病名名、コード、開始日、転帰、診療科、保険組合せ番号だけを projection する。
- response は `orcaMirrorStatus=connected|unavailable` を返す。`connected` で mirror が空の場合は「ORCAに登録済みの病名はありません。」、`unavailable` の場合だけ「ORCA病名を取得できませんでした。同期状態は未確認です。保険病名はこの画面で登録・編集できます。」を表示する。
- ORCA mirror は read-only で、候補や mirror entry は明示操作なしに保険病名へ昇格しない。取得成功時に旧文言「ORCA病名の参照取得はこの画面ではまだ接続されていない」は表示しない。
- ORCA transport failure / parser failure / non-zero ORCA result は fail closed とし、内部 URL、資格情報、raw XML、stack trace、ORCA 詳細メッセージを API response / UI に出さない。

## Order Set Rule
- order-set の disease は candidate-only semantics です。
- order-set 適用時に disease candidate を silent create しません。
- candidate を保険病名へ反映する責務は `DiagnosisEditPanel` の explicit confirm に限定します。

## References
- [ui-current-contract.md](./ui-current-contract.md)
- [feedback-spec.md](./feedback-spec.md)
- [README.md](./README.md)

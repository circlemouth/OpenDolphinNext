# Disease Insurance / ORCA Contract

この文書は Disease を single-list truth で扱わないための current contract を定義します。

## Scope
- `保険病名`: 院内ローカルの authoring truth
- `ORCA mirror`: ORCA 由来の read-only mirror
- `候補`: master / order-set / 補助入力から来る candidate source
- `clinical`: 未実装。実装されるまで current writable surface に昇格しない

## Fixed Boundary
- `保険病名` だけが create / update / delete できます。
- `ORCA mirror` は read-only です。auto-merge / auto-delete / auto-overwrite を禁止します。
- `候補` は truth ではありません。明示 confirm なしで `保険病名` に昇格させません。
- clinical source 未実装時は fake list を出さず、boundary note で止めます。

## Canonical Notes
- `同期候補があります`
- `ORCA側と差分があります`
- `保険病名の確認が必要です`
- `ORCA mirror を取得できないため、同期状態は未確認です。`
- `clinical source が未実装のため、この画面では保険病名だけを扱います。`

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
- UG-05 未解決: ORCA mirror は read-only
- UG-06 未解決: visible diff + manual resolution
- UG-07 未解決: outcome preset は input assist のみ

## Order Set Rule
- order-set の disease は candidate-only semantics です。
- order-set 適用時に disease candidate を silent create しません。
- candidate を保険病名へ反映する責務は `DiagnosisEditPanel` の explicit confirm に限定します。

## References
- [ui-current-contract.md](./ui-current-contract.md)
- [feedback-spec.md](./feedback-spec.md)
- [README.md](./README.md)

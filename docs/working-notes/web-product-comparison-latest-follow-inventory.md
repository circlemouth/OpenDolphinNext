# Web Product Comparison / Latest-Follow Inventory

- RUN_ID: `20260330T064252Z`
- basis: current repo code / tests / docs only
- scope: Charts normal runtime の comparison / latest-follow 現況

## Classification Summary

- overall:
  - `DOCS_UNDER_SPEC`
- no dedicated normal-runtime comparison surface:
  - `MATCH`
- debug-only 依存を主面に戻していない:
  - `MATCH`

## Inventory

| zone | area | current behavior | responsibility | classification | evidence |
| --- | --- | --- | --- | --- | --- |
| `normal runtime` | `SoapNotePanel` latest SOAP | `getLatestSoapEntries(history)` で section ごとの最新 entry を引き、template 初期値や authored meta の参照に使う | 主面 `SoapNotePanel` 内の latest-follow 補助 | `MATCH` | `web-client/src/features/charts/SoapNotePanel.tsx`, `web-client/src/features/charts/soapNote.ts` |
| `normal runtime` | `SoapNotePanel` latest order bundle | `resolveLatestBundle()` で group / entity ごとの最新 bundle を選び、drawer / dock の既定 edit 対象にする | 主面から開く order utility の latest-follow 補助 | `MATCH` | `web-client/src/features/charts/SoapNotePanel.tsx`, `web-client/src/features/charts/orderDetailDisplayViewModel.ts` |
| `supplemental surface` | `PastHubPanel` | 日付ごとに過去受診を折りたたみ、active day では SOAP 最新とオーダー一覧を Do/表示に使う | Charts 左列の補助 surface。主面 comparison ではなく historical reference hub | `MATCH` | `web-client/src/features/charts/PastHubPanel.tsx`, `web-client/src/features/charts/pages/ChartsPage.tsx` |
| `supplemental surface` | `ChartsActionBar` reload latest | tab lock / approval lock の recovery 導線として `最新を再読込` を出す | comparison ではなく concurrency / recovery action | `MATCH` | `web-client/src/features/charts/ChartsActionBar.tsx`, `web-client/src/features/charts/pages/ChartsPage.tsx` |
| `supplemental surface` | `PatientsTab` related CTA | `DocumentTimeline へ` 導線は Patients sidepane の関連導線として残るが、comparison 専用 state や latest-follow policy は持たない | comparison 固定仕様ではなく補助導線 | `DOCS_UNDER_SPEC` | `web-client/src/features/charts/PatientsTab.tsx` |
| `debug-only` | `DocumentTimeline` / `MedicalOutpatientRecordPanel` | `showDebugUi` 条件付きでのみ render される | debug-only surface。normal runtime の主面責務に含めない | `MATCH` | `web-client/src/features/charts/pages/ChartsPage.tsx`, `web-client/src/features/charts/DocumentTimeline.tsx`, `web-client/src/features/charts/MedicalOutpatientRecordPanel.tsx` |

## Derived Current Contract

- normal runtime の中心は `SoapNotePanel` で、comparison 専用の route / pane / side-by-side UI は current repo にありません。
- `latest-follow` は latest SOAP / latest bundle / reload latest のような局所補助として存在し、独立した visibility policy までは code-confirm できません。
- `PastHubPanel` は過去比較のための補助 surface ですが、debug-only surface に依存しません。
- `PatientsTab` の関連導線は comparison policy の source of truth ではありません。
- `DocumentTimeline` と `MedicalOutpatientRecordPanel` を normal runtime の前提にしてはいけません。

## Remaining Unknown

- comparison/latest-follow を将来どこまで user-visible policy として固定するか
- auto-sync / auto-action と comparison/latest-follow の横断 visibility / override policy

## References

- [web-product-evidence-pack.md](./web-product-evidence-pack.md)
- [03_web_current_contract_summary.md](../managerdocs/03_web_current_contract_summary.md)

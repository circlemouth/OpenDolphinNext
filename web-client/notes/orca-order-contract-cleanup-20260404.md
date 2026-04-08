# ORCA Order Contract Cleanup (2026-04-04)

- RUN_ID: `20260407T235638Z`
- Scope: `generalOrder` alias 縮退、exact class allowlist、selection comment fail-closed 化の current contract。

## Single Source Of Truth

- `treatmentOrder` を 400 系処置の canonical entity とする。`generalOrder` は ingress / query 境界でのみ `treatmentOrder` へ正規化する alias として扱う。
- `bodyPart` は first-class field のまま保持するが、保存・再構成・送信に使うかどうかは entity / modality ごとの policy で判定する。
- `injectionOrder` は exact allowlist を持ち、`admin/adminCode/adminMemo/speed` は local-only として wire carrier にしない。
- `radiologyOrder` は `700/701/702/703/704/731/732` を exact allowlist とし、`className=画像診断` を canonical にする。
- `otherOrder` は local-only + send-block であり、送信候補として扱わない。
- `physiologyOrder` は import-only + local save/fetch 可 + send-block であり、bodyPart も reject する。
- `bacteriaOrder` は local-only + local save/fetch 可 + send-block であり、subtype は院内保存専用とする。

## Contract Decisions

- UI の bodyPart 名称欄は read-only に依存せず、entity / modality に応じて表示と保存可否を切り分ける。
- client validation と server validation は同じ exact policy を使い、malformed bodyPart を通常 item として温存しない。
- charge は `baseChargeOrder=110/114/120/124`、`instractionChargeOrder=130/132/133/140/141/142/143/148/149` を唯一の canonical rule とし、manual item selection/save/fetch/send/XML で同じ helper を使う。
- charge manual item selection では cross-range な候補を残さず、`classCode` と `className` は exact map へ固定する。
- selection comment の `itemNumber / itemNumberBranch` は official `medicalmodv2` request に carrier がないため unsupported とし、UI disable だけで終わらせず save validation / server validation / send block まで fail-closed に止める。

## Verification Summary

- exact allowlist と exact class map に固定する。
- packet にない hidden report 前提は採用しない。
- `Item_Number / Item_Number_Branch` は outbound ではなく selection metadata 扱いに限定する。

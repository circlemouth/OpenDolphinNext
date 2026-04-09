# ORCA Order Remediation Notes (2026-04-03)

- RUN_ID: `20260407T235638Z`
- Scope: ORCA オーダーの current contract を current contract packet に固定する。

## Current Contract

- `medOrder` は raw `Medical_Class` と generic flag の tri-state を保持し、`830 -> Medication_Name`、`842/8501/8511/8521/831 -> Medication_Number` を使う。
- `medOrder` の usage は current release では send-block とし、未確認 carrier へは倒さない。
- `injectionOrder` は `310/311/312/320/321/330/331/334/340/350` のみ sendable で、`admin/adminCode/adminMemo/speed` は local save/fetch では保持できるが ORCA send payload / XML には投影しない。
- `treatmentOrder` は `400/401/402/403/409` を class-aware に扱い、bodyPart は reject。
- `surgeryOrder` は `500/501/502/510` のみ sendable で、`520/540/541/542` は block。
- `testOrder` は `600/601/602/603/610` のみ sendable で、`640/643` は reject。
- `physiologyOrder` は import-only + local save/fetch 可 + send-block。
- `bacteriaOrder` は local-only + local save/fetch 可 + send-block。
- `otherOrder` は local-only + send-block。
- `radiologyOrder` は `700/701/702/703/704/731/732` のみを扱い、className は `画像診断` を使う。bodyPart は current release では `700` のみ許可し、その他 class は fail-close に reject する。
- `baseChargeOrder` は `110/114/120/124`、`instractionChargeOrder` は `130/132/133/140/141/142/143/148/149` のみを扱う。
- `Item_Number / Item_Number_Branch` は selection metadata として見えても outbound には出さない。selection comment は fail-closed に block する。

## Notes

- exact allowlist と exact class map に寄せる。
- packet に書かれた current behavior のみを記述し、hidden report 前提は持ち込まない。
- local-only / import-only / send-block は UI の説明と validation / send guard / server validation を一致させる。
- 送信判定は entity 名ではなく exact `Medical_Class` と official carrier に寄せる。
- canonicalization の実 map は catalog 側を正本とし、client/server の補助 helper は委譲のみに寄せる。

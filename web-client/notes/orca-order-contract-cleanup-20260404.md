# ORCA Order Contract Cleanup (2026-04-04)

- RUN_ID: `20260403T235239Z`
- Scope: `generalOrder` alias 縮退、`bodyPart` 002 契約の fail-closed 化、unknown input-set metadata fallback の除去

## Single source of truth

- `treatmentOrder` を 400 系処置の single source of truth とする。`generalOrder` は ingress / query 境界でのみ `treatmentOrder` へ正規化する alias として扱う。
- `bodyPart` は first-class field のまま保持するが、保存・再構成・送信に使えるのは `002` で始まる code を持つ値だけとする。
- unknown / invalid ORCA input-set receiptCode は supported entity に誤分類せず、unsupported として fail-closed に扱う。

## Contract decisions

- UI の bodyPart 名称欄は read-only とし、変更は再検索・再選択でのみ許可する。
- client validation と server validation は同じ `002` 契約を使い、`name` のみ・non-`002`・code 欠落の bodyPart を 400 で拒否する。
- save/fetch/send helper は malformed bodyPart を通常 item として温存しない。
- input-set list/detail は unsupported metadata を返送しない。detail 取得時は not found として閉じる。
- charge は `baseChargeOrder=110..125 / 基本診療料`、`instractionChargeOrder=130..150 / 医学管理等` を唯一の canonical rule とし、manual item selection/save/fetch/send/XML で同じ helper を使う。
- charge manual item selection では cross-range な `masterCategory` 候補を候補一覧から除外し、`classCode` だけでなく `className` も canonical 値へ確定する。`className -> bundleName` fallback は charge で使わない。
- charge main row は `masterCategory` を item memo meta に保持し、save/fetch/no-op save でも entity/class/item の整合判定を server/client で再利用する。
- selection comment の `itemNumber / itemNumberBranch` は official `medicalmodv2` request に carrier がないため unsupported とし、UI disable だけで終わらせず save validation / server validation / send block まで fail-closed に止める。
  根拠:
  `medicationgetv2` は `Selection_Expression_Information` で `Item_Number / Item_Number_Branch` を返す一方、`medicalmodv2` request は `Medication_Code / Name / Number / Generic_Flg` までで、`Medication_Input_Info` は `medicalsetv2` の 85/831 系補足にだけ現れる。

## Verification summary

- `git grep -n "BP001" -- web-client server-modernized` は 0 件。
- `git grep -n "generalOrder" -- web-client/src server-modernized/src` は boundary alias helper とその最小テスト、および server 境界 alias のみ。
- `git grep -n "ENTITY_GENERAL_ORDER" -- server-modernized/src/main/java/open/dolphin/rest/orca server-modernized/src/test/java/open/dolphin/rest/orca` は request boundary alias とそのテストのみ。

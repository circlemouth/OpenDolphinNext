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

## Verification summary

- `git grep -n "BP001" -- web-client server-modernized` は 0 件。
- `git grep -n "generalOrder" -- web-client/src server-modernized/src` は boundary alias helper とその最小テスト、および server 境界 alias のみ。
- `git grep -n "ENTITY_GENERAL_ORDER" -- server-modernized/src/main/java/open/dolphin/rest/orca server-modernized/src/test/java/open/dolphin/rest/orca` は request boundary alias とそのテストのみ。

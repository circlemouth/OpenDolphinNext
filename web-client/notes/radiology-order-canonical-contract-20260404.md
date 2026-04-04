# 放射線オーダー canonical contract (2026-04-04)

- RUN_ID: `20260404T084800Z`
- 対象: `radiologyOrder`

## Canonical Decision

- `classCode=700` の `className` は `放射線` に統一する。
- row 分類は `bodyPart / main / auxiliary / comment` を canonical とする。
- `auxiliary` の内部種別は `rowSubtype=material | contrastDrug` を first-class に保持する。
- `bodyPart` は `002...` code の専用 field を canonical source of truth にする。
- `comment` は comment code を canonical source of truth にする。
- `etensu(category=7)` は `main`、`material` 検索は `auxiliary/material`、`drug` 検索は `auxiliary/contrastDrug` に正規化する。
- code prefix 推定は fallback のみとし、explicit metadata がある場合は必ず `rowRole / rowSubtype` を優先する。

## Save / Fetch / Send

- request DTO / response DTO / input-set detail DTO は `rowRole` に加えて `rowSubtype` を運ぶ。
- server は `item.memo` の meta carrier に `rowRole / rowSubtype` を保存し、free-form memo text と衝突しない形で round-trip させる。
- `save -> fetch -> normalize -> send -> XML` の順で、`bodyPart -> main -> auxiliary -> comment` の並びを維持する。
- ORCA 送信で使うのは `bodyPart`、coded `main/auxiliary/comment` row、`classCode/className` のみとする。

## Validation

- `materialItems` は quantity/unit/memo のみ入力、または name あり code なしを保存前に reject する。
- 放射線オーダーは `bodyPart` 必須、`002...` 以外の bodyPart 禁止、sendable `main` 必須、comment/bodyPart のみ禁止、coded/uncoded 混在禁止、uncoded auxiliary 禁止で front/server を一致させる。
- invalid row は silent drop せず、保存前または server validation で fail-closed にする。

## Local-only

- radiology の `admin`、`adminMemo`、bundle `memo`、free-form `item.memo` は local-only とする。
- local-only 項目は editor 上で ORCA 非送信であることを明示し、send payload / XML には投影しない。

## Regression Coverage

- front: validation、manual search semantics、bodyPart 002 契約、round-trip payload、send smoke を更新。
- server: mutation/fetch round-trip、canonical className、memo carrier、send/XML を更新。

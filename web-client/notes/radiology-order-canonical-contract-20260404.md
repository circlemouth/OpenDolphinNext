# 画像診断オーダー canonical contract (2026-04-04)

- RUN_ID: `20260407T235638Z`
- 対象: `radiologyOrder`

## Canonical Decision

- `classCode=700` 系の canonical className は `画像診断` を使う。
- `row` 分類は `bodyPart / main / auxiliary / comment` を canonical とする。
- `auxiliary` の内部種別は `rowSubtype=material | contrastDrug` を local-only として保持する。
- `bodyPart` は current release では `classCode=700` のみ許可し、それ以外の radiology class は fail-close に reject する。
- `comment` は comment code を canonical source of truth にする。

## Save / Fetch / Send

- request DTO / response DTO / input-set detail DTO は rowRole を運ぶが、rowRole は wire carrier ではない。
- server は `item.memo` の meta carrier に rowRole / rowSubtype を保存し、free-form memo text と衝突しない形で round-trip させる。
- `save -> fetch -> normalize -> send -> XML` の順で、`classCode=700` の bodyPart / main / auxiliary / comment を維持する。
- ORCA 送信で使うのは `classCode=700` の bodyPart と coded main / auxiliary / comment row、および exact classCode / className のみとする。

## Validation

- radiology は exact class allowlist に従い、`710..724` は current release では block とする。
- invalid row は silent drop せず、保存前または server validation で fail-closed にする。
- local-only 項目は editor 上で ORCA 非送信であることを明示し、send payload / XML には投影しない。
- ORCA 送信に必要なのは exact class / coded row / `classCode=700` の bodyPart であり、UI の broad label ではない。

## Regression Coverage

- front: validation、manual search semantics、`classCode=700` bodyPart、round-trip payload、send smoke を更新する。
- server: mutation/fetch round-trip、canonical className、memo carrier、send/XML を更新する。

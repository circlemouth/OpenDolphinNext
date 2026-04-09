# ORCA Charge Canonicalization Notes

## Scope

- `baseChargeOrder` は `110/114/120/124` を exact class として扱う。
- `instractionChargeOrder` は `130/132/133/140/141/142/143/148/149` を exact class として扱う。
- canonical source は client の `orderChargeClassSupport.ts` と server の `OrcaChargeClassCanonicalSupport.java` に限定する。

## Canonicalization Contract

- charge 系では `classCode` から exact `className` を再計算する。
- `item.category` で charge `classCode` を導出した場合も、同時に `className` と `classCodeSystem=Claim007` を同期する。
- charge 系で `bundleName` を `className` fallback に使わない。
- fetch / recommendation / editor restore / save payload / medicalmodv2 XML は同じ canonical class meta を返す。
- mixed-class の charge bundle は exact class に分解できない限り送信対象にしない。

## Local-only Fields

- charge 系の `admin`, `adminMemo`, `memo`, `started` は local-only。
- `Item_Number` / `Item_Number_Branch` は selection metadata として扱うが、outbound には出さない。
- ORCA に意味を持たせる補足が必要な場合は free-text ではなく coded comment row で表現する。

## medicationgetv2 Selection Comments

- client は selection metadata を参照してもよいが、medicalmodv2 outbound には carrier を持ち込まない。
- unknown / unsupported selection comment family は fail-closed に block する。
- packet 外の selection carrier を補完しない。

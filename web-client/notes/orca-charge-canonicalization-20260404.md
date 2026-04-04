# ORCA Charge Canonicalization Notes

## Scope

- `baseChargeOrder` は `110-125` を `基本診療料` として扱う。
- `instractionChargeOrder` は `130-150` を `医学管理等` として扱う。
- canonical source は client の [`orderChargeClassSupport.ts`](C:/wt/odn-orca-204/web-client/src/features/charts/orderChargeClassSupport.ts) と server の [`OrcaChargeClassCanonicalSupport.java`](C:/wt/odn-orca-204/server-modernized/src/main/java/open/dolphin/rest/orca/OrcaChargeClassCanonicalSupport.java) に限定する。

## Canonicalization Contract

- charge 系では `classCode` から `className` を再計算する。
- `item.category` で charge `classCode` を導出した場合も、同時に `className` と `classCodeSystem=Claim007` を同期する。
- charge 系で `bundleName` を `className` fallback に使わない。
- fetch / recommendation / editor restore / save payload / medicalmodv2 XML は同じ canonical class meta を返す。

## Local-only Fields

- charge 系の `admin`, `adminMemo`, `memo`, `started` は local-only。
- ORCA `medicalmodv2` に送るのは `classCode`, `className`, `bundleNumber`, coded row の `code/name/number/unit` のみ。
- ORCA に意味を持たせる補足が必要な場合は free-text ではなく coded comment row で表現する。

## medicationgetv2 Selection Comments

- client は `/api/orca/chart-support/medication-get` に `requestNumber=02` で接続する。
- lookup key は選択中 main row の 9 桁診療行為コード。
- `Item_Number` / `Item_Number_Branch` は selection metadata として表示するが、候補追加の blanket block 条件には使わない。
- unsupported とみなすのは requestCode が 9 桁でないなど、server/resource で明示できる条件だけに限定する。

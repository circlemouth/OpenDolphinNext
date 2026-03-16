# ORCA master supported schema contract

最終更新: 2026-03-16  
対象: `server-modernized/src/main/java/open/orca/rest/OrcaMasterDao.java`

## 目的

ORCA master API が前提にする現行スキーマを固定し、旧表名・旧列名を吸収する互換レイヤを廃止するための基準を明文化する。

## 前提

- 後方互換は維持しない。
- 本契約に記載のない旧表名・旧列名・派生列は **非対応** とする。
- `OrcaMasterDao` はこの契約に 1 対 1 で対応する固定 SQL へ移行する。
- `hokenja` / `address` は現時点で fixture/snapshot ベースの read-only 提供であり、ORCA DB の動的 schema probing 対象に含めない。

## サポート対象テーブル

### 1. 薬効分類 (`/api/orca/master/generic-class`)

- テーブル: `TBL_GENERIC_CLASS`
- 必須列:
  - `class_code`
  - `class_name`
  - `kana_name`
  - `category_code`
  - `parent_class_code`
  - `start_date`
  - `end_date`
  - `upymd`

### 2. 薬剤 (`/api/orca/master/drug`)

- テーブル: `TBL_TENSU_MASTER`
- 必須列:
  - `srycd`
  - `name`
  - `kananame`
  - `srysyukbn`
  - `taniname`
  - `ten`
  - `yakkakjncd`
  - `yukostymd`
  - `yukoedymd`
  - `upymd`

### 3. コメント / 部位 (`/api/orca/master/comment`, `/api/orca/master/bodypart`)

- テーブル: `TBL_TENSU_MASTER`
- 必須列:
  - `srycd`
  - `name`
  - `kananame`
  - `srysyukbn`
  - `taniname`
  - `yukostymd`
  - `yukoedymd`
  - `upymd`

### 4. 用法 (`/api/orca/master/youhou`)

- テーブル: `TBL_YOUHOU`
- 必須列:
  - `youhoucode`
  - `youhouname`
  - `kana`
  - `start_date`
  - `end_date`
  - `upymd`

### 5. 材料 (`/api/orca/master/material`)

- テーブル: `TBL_MATERIAL_H_M`
- 必須列:
  - `material_code`
  - `material_name`
  - `kana_name`
  - `category`
  - `material_category`
  - `unit`
  - `price`
  - `maker`
  - `start_date`
  - `end_date`
  - `upymd`

### 6. 検査分類 (`/api/orca/master/kensa-sort`)

- テーブル: `TBL_KENSASORT`
- 必須列:
  - `kensa_code`
  - `kensa_name`
  - `kana_name`
  - `kensa_sort`
  - `classification`
  - `start_date`
  - `end_date`
  - `upymd`

## 非対応とするもの

- `tbl_*` の小文字別名テーブル
- `code`, `name`, `kana`, `valid_from`, `valid_to`, `version` のような互換用抽象列名
- `TBL_MATERIAL` など旧材料表へのフォールバック
- `DatabaseMetaData` を使った列存在確認
- 列候補配列からの自動選択

## 実装メモ

- Phase 4 の `ORCA-03` で `resolveTable` / `columnOrNull` / `findColumn` / `DatabaseMetaData` を削除し、本契約どおりの固定 SQL に置換する。
- 本契約を変更する場合は、API 契約・fixture・運用手順も同一 run で更新する。

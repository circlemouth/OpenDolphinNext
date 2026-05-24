# LICENSE Git履歴調査（RUN_ID=20260310T053804Z）

- 作成日: 2026-03-10
- 調査対象: `LICENSE`, `License-sjis.txt`, `License.txt`, `README.md`
- 調査方法: `git log --follow`, `git show`, `git diff`, `shasum`

## 確認できた事実
1. 現在の `LICENSE` は、`License.txt` から `License-sjis.txt` を経て `LICENSE` へ至る系譜を持つ。
2. ライセンス文面は少なくとも Git 上で 3 系統確認できる。
   - `Kazushi Minagawa / Digital Globe / GPLv2 / version 2.2`
   - `Kazushi Minagawa / Life Sciences Computing / GPLv2 / version 2.4`
   - `OpenDolphin Lab. / Life Sciences Computing / GPLv3 / version 2.4`
3. `README.md` のライセンス説明は、`LICENSE` 本体の文面変更とは別系列で更新されている。
4. 現在の `LICENSE` の SHA-256 は `ba93b8aaa76175376c1119bcdc4c975ae12cf2de` 時点の `LICENSE` と一致し、`741953d26637c2a9ad6adec96652b03ab2c145ba` 時点の `LICENSE` とは一致しない。

## ファイル系譜

| 現行/過去ファイル | 最古確認コミット | 事実 |
| --- | --- | --- |
| `License.txt` | `d40a50e456d9ce0f2029eee9d1ecf5be153af764` より前 | `d40a50e456...` で `License-sjis.txt` に rename される。 |
| `License-sjis.txt` | `d40a50e456d9ce0f2029eee9d1ecf5be153af764` | `d40a50e456...` で登場し、`ba93b8aaa7...` で削除される。 |
| `LICENSE` | `741953d26637c2a9ad6adec96652b03ab2c145ba` | `741953d266...` で `License-sjis.txt` から copy されて新規作成される。 |

## 主要コミット時系列

### 1. `d40a50e456d9ce0f2029eee9d1ecf5be153af764`
- Git日付: 2014-02-02 13:01:56 +0900
- 作者: `Open Dolphin <dolphin@digital-globe.co.jp>`
- 件名: `Version 2.2.0`
- コミット本文: `2012年1月7日`
- 対象ファイル:
  - `License.txt` → `License-sjis.txt` に rename
- 差分上の事実:
  - ファイル末尾の製品表記が `OpenDolphin version 2.1.2M` から `(R)OpenDolphin version 2.2` に変わる
  - 著作権表記は `Copyright (C) 2001-2011 Kazushi Minagawa. Digital Globe, Inc.`
  - GPL 表記は `version 2 (GPLv2)` のまま

### 2. `00894efcf6acce03b0dd7f3bd36b0f83614c4800`
- Git日付: 2014-02-02 13:09:29 +0900
- 作者: `Open Dolphin <dolphin@digital-globe.co.jp>`
- 件名: `Version 2.4.1`
- コミット本文: `2013年4月16日`
- 対象ファイル:
  - `License-sjis.txt`
  - `README.md` 新規作成
- `License-sjis.txt` の差分上の事実:
  - 冒頭著作権表記が `2001-2011 Kazushi Minagawa. Digital Globe, Inc.` から `2001-2013 Kazushi Minagawa, Life Sciences Computing, Corp.` に変わる
  - 製品表記が `(R)OpenDolphin version 2.2` から `(R)OpenDolphin version 2.4` に変わる
  - GPL 表記は `version 2 (GPLv2)` のまま
- `README.md` の差分上の事実:
  - 冒頭に `2013-04-16　皆川和史　ライフサイエンスコンピューティング（株）`
  - ライセンス節に `OpenDolphinのライセンスは GNU GPL3 です。`
  - クレジットとして松村先生、増田先生、新宿ヒロクリニック、Takayoshi Kimura 氏の記載

### 3. `741953d26637c2a9ad6adec96652b03ab2c145ba`
- Git日付: 2014-02-02 13:38:40 +0900
- 作者: `Open Dolphin <dolphin@digital-globe.co.jp>`
- 件名: `Version 2.4.4`
- コミット本文: `2014年2月1日`
- 対象ファイル:
  - `LICENSE` 新規作成
  - `License-sjis.txt` 更新
  - `README.md` 更新
- `LICENSE` / `License-sjis.txt` の差分上の事実:
  - 著作権表記が `2001-2013 Kazushi Minagawa, Life Sciences Computing, Corp.` から `2001-2014 OpenDolphin Lab., Life Sciences Computing, Corp.` に変わる
  - GPL 表記が `version 2 (GPLv2)` から `version 3 (GPLv3)` に変わる
  - 製品表記は `(R)OpenDolphin version 2.4` のまま
- `README.md` の差分上の事実:
  - 冒頭が `2013-04-16　皆川和史...` から `2014-02-01　皆川和史、王勝偉...` に変わる
  - `OpenDolphinのライセンスは GNU GPL3 です。` は維持される

### 4. `ba93b8aaa76175376c1119bcdc4c975ae12cf2de`
- Git日付: 2015-08-08 21:30:06 +0900
- 作者: `Open Dolphin <kazushi.minagawa@mac.com>`
- 件名: `Version 2.6.0`
- 対象ファイル:
  - `LICENSE` 更新
  - `License-sjis.txt` 削除
  - `README.md` 更新
- `LICENSE` の差分上の事実:
  - 著作権表記が `2001-2014 OpenDolphin Lab., Life Sciences Computing, Corp.` から `2001-2011 Kazushi Minagawa. Digital Globe, Inc.` に変わる
  - GPL 表記が `version 3 (GPLv3)` から `version 2 (GPLv2)` に変わる
  - 製品表記が `(R)OpenDolphin version 2.4` から `(R)OpenDolphin version 2.2` に変わる
- `License-sjis.txt` の差分上の事実:
  - ファイル削除
- `README.md` の差分上の事実:
  - `# OpenDolphin` 見出し追加
  - `OpenDolphin 2.6.0`
  - 冒頭に `2015-08-08　皆川和史、王勝偉　オープンドルフィン・ラボ`
  - ライセンス節には引き続き `OpenDolphinのライセンスは GNU GPL3 です。` の記載がある

### 5. `69a0f73c4f3faea9811a1df7999126ad12262f93`
- Git日付: 2015-10-08 14:02:00 +0900
- 作者: `Open Dolphin <dolphin@digital-globe.co.jp>`
- 件名: `minor fix pom.xml, README`
- 対象ファイル:
  - `README.md`
- 差分上の事実:
  - 見出しが `#### ２．ライセンス` から `#### ２．ライセンス & 謝辞` に変わる
  - 参考情報として `５分間評価` リンクを追加

### 6. `6efbe5f7b6c194d774ee0dfb57b461878c69f970`
- Git日付: 2025-12-09 08:40:52 +0900
- 作者: `circlemouth <circlemouth.h@gmail.com>`
- 件名: `04C3完了`
- 対象ファイル:
  - `README.md`
- 差分上の事実:
  - README 全体が現行プロジェクト向けに再構成される
  - `## Original License & Credits` 見出しが追加される
  - 同節に `OpenDolphin 2.7.1` と `ライセンス & 謝辞` の記載が置かれる
  - 同節の本文に `OpenDolphinのライセンスは GNU GPL3 です。` の記載がある

### 7. `bae7a696b30ac9f7ddfb750e46e60bd4868cbb07`
- Git日付: 2026-03-09 22:37:25 +0900
- 作者: `circlemouth <circlemouth.h@gmail.com>`
- 件名: `docs: add acknowledgements to README`
- 対象ファイル:
  - `README.md`
- 差分上の事実:
  - README 上部に謝辞節が追加される
  - `## Original License & Credits` 節は維持される
  - 同節に、フォーク元ライセンスの議論に関する注記が追加される

## 現行ファイルとの一致確認

### 1. 現行 `LICENSE`
- 現行 `LICENSE` の SHA-256:
  - `184d0940737c7e1c2663c5988fd5cdf93bcd5df104c5c36067776a8f823370db`
- `ba93b8aaa76175376c1119bcdc4c975ae12cf2de:LICENSE` の SHA-256:
  - `184d0940737c7e1c2663c5988fd5cdf93bcd5df104c5c36067776a8f823370db`
- `741953d26637c2a9ad6adec96652b03ab2c145ba:LICENSE` の SHA-256:
  - `faf456cc06880d3aa70992cda82576145f1ec316c4a0d8474a1881087a6488ad`
- 事実:
  - 現行 `LICENSE` は `ba93b8aaa7...` 時点の `LICENSE` と一致する
  - 現行 `LICENSE` は `741953d266...` 時点の `LICENSE` とは一致しない

### 2. 現行 README のライセンス説明導線
- 現行 README の `## Original License & Credits` 付近には、以下の Git 履歴調査ドキュメントへのリンクがある。
  - `minagawa署名git履歴調査_20260310.md`
  - `LICENSE_git履歴調査_20260310.md`

## 再現コマンド

```bash
git log --follow --reverse --format='%H%x09%ad%x09%an%x09%ae%x09%s' --date=iso -- LICENSE
git log --follow --reverse --format='%H%x09%ad%x09%an%x09%ae%x09%s' --date=iso -- License-sjis.txt
git log --follow --reverse --format='%H%x09%ad%x09%an%x09%ae%x09%s' --date=iso -- README.md
git show -U5 d40a50e456d9ce0f2029eee9d1ecf5be153af764 -- License.txt License-sjis.txt
git show -U5 00894efcf6acce03b0dd7f3bd36b0f83614c4800 -- License-sjis.txt README.md
git show -U5 741953d26637c2a9ad6adec96652b03ab2c145ba -- LICENSE License-sjis.txt README.md
git show -U5 ba93b8aaa76175376c1119bcdc4c975ae12cf2de -- LICENSE License-sjis.txt README.md
shasum -a 256 LICENSE
git show ba93b8aaa76175376c1119bcdc4c975ae12cf2de:LICENSE | shasum -a 256
git show 741953d26637c2a9ad6adec96652b03ab2c145ba:LICENSE | shasum -a 256
```

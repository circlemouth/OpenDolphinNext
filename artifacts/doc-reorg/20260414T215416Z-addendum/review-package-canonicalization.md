# Review Package Canonicalization

現行正本名は `reviewer submission packet` とする。`review package` は support bundle、`review archive` は deprecated に整理した。

| Asset | Class | Basis |
| --- | --- | --- |
| `docs/runbooks/reviewer-submission-packet.md` | canonical | reviewer 提出物の runbook 正本。生成・検証・出力レイアウト・旧方式の扱いを定義している。 |
| `scripts/create-reviewer-submission-packet.sh` | canonical | accepted ref / accepted HEAD / RUN_ID を固定した reviewer submission packet 生成の実行正本。 |
| `scripts/validate-reviewer-submission-packet.sh` | support | canonical flow の検証ステップ。packet の完全性を再確認する。 |
| `tests/review-packet/` | support | canonical flow の regression test。CI entry ではなく tool support。 |
| `artifacts/reviewer-submission-packets/` | evidence | canonical flow の出力先。source of truth ではなく evidence。 |
| `scripts/create-review-package.sh` | support | tracked source を軽量 zip 化する補助 flow。reviewer 提出の正本ではない。 |
| `tests/review-package/` | support | support bundle script の regression test。 |
| `artifacts/review-bundles/` | evidence | support bundle の出力先。 |
| `scripts/create-review-bundles.sh` | support | `web-client` / `server-modernized` clean bundle を分けて作る補助 script。canonical reviewer submission packet ではない。 |
| `scripts/package-source-zip.ps1` | support | Windows 向け source archive packaging 補助 script。 |
| `scripts/create-review-archive.sh` | deprecated | script 自身が retired と明記し、reviewer submission packet へ誘導する。 |

## Naming Normalization

- 正本名: `reviewer submission packet`
- 補助名: `review package`
- 廃止名: `review archive`

docs 上の呼び方は `reviewer submission packet` に寄せ、`review package` は source-only の補助 bundle を意味する場合に限定する。

## Deprecated Candidates

- `scripts/create-review-archive.sh`
  - docs 上は deprecated として固定済み。
  - script 本体の削除や呼び出し元整理は non-doc follow-up とする。

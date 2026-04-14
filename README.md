# OpenDolphin Web Client & Modernized Server

本リポジトリは OpenDolphin をベースに、`server-modernized/` と `web-client/` を現行実装として開発する repository です。`client/` と `server/` は legacy reference であり、通常の変更対象ではありません。

## Primary Entry
- [docs/README.md](docs/README.md): current / workflow / reference / archive / evidence を分けた全体索引
- [docs/managerdocs/README.md](docs/managerdocs/README.md): manager current state と release boundary
- [web-client/README.md](web-client/README.md): web-client module entry
- [docs/runbooks/release-validation.md](docs/runbooks/release-validation.md): live validation gate

## Build / CI Entry
- [package.json](package.json): root Node / Playwright scripts
- [pom.server-modernized.xml](pom.server-modernized.xml): server-modernized build entry
- [pom.xml](pom.xml): Maven aggregator entry
- [docs/README.md](docs/README.md): doc-side boundary summary

## Ops Entry
- [ops/README.md](ops/README.md): ops harness の入口
- [setup-modernized-env.sh](setup-modernized-env.sh), [setup-modernized-env.ps1](setup-modernized-env.ps1): 開発環境起動の主入口
- `docker-compose*.yml`: compose-based local stack entry

## Repository Map
| Path | Role |
| --- | --- |
| `server-modernized/` | current server implementation |
| `web-client/` | current web client implementation |
| `docs/` | enduring docs hub |
| `ops/` | environment / manual verification harness |
| `tests/` | automated tests |
| `scripts/` | thin runner / packaging tools |
| `artifacts/` | evidence / generated outputs |
| `client/`, `server/`, `ext_lib/` | legacy reference |

## Document Rules
- current docs の入口は `docs/README.md` に寄せる
- packet / handoff / prompt / review docs は current 導線に混ぜない
- evidence は `artifacts/` に置き、source of truth にしない
- UI/UX の enduring reference は [docs/web-client/ux/dads_app_ui_design_rules_20260411.md](docs/web-client/ux/dads_app_ui_design_rules_20260411.md)

## Repository History / License Research
- [docs/reference/repository-history/README.md](docs/reference/repository-history/README.md)
- [LICENSE](LICENSE)

ライセンス履歴や著者名義の調査資料は current docs ではなく reference として整理しています。

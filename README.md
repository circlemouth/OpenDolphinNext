# OpenDolphin Web Client & Modernized Server

本リポジトリは OpenDolphin をベースに、`server-modernized/` と `web-client/` を現行実装として開発する repository です。`client/` と `server/` は legacy reference であり、通常の変更対象ではありません。

フォーク元はメドレー株式会社様が管理されている以下のリポジトリです。
ライセンスについてはメドレー株式会社様の判断に従い、変更の可能性があります。
https://github.com/dolphin-dev/OpenDolphin


# 注意点
ORCAと連携する電子カルテサーバーと、そのクライアントとして開発しています。
この電子カルテでは、厚生労働省が2026年5月現在で示している認証カルテになることが、定義上できない可能性が高く(認証申請時点で、直近1年間に一定数以上の医療機関で稼働していることが要件になり、クラウド上に個人でデプロイしたとしても満たせない可能性が高い)、開発が完了して、使用できたとしても制約をうけます。
また、今後厚生労働省の政策次第では、未承認カルテ自体が使用できなくなる可能性があります。

また、個人利用を想定して開発しているため、情報漏洩等のリスクは使用者に帰属します。

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
- [setup-modernized-env.sh](setup-modernized-env.sh), [setup-modernized-env.ps1](setup-modernized-env.ps1): 開発環境起動の主入口。`orca.env.local` または `~/.config/opendolphin/orca.env` を自動読込する
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

# Root Entry Matrix

root 入口の分類は `人間向け主入口 / 補助入口 / CI入口 / ops入口 / deprecated 候補` で整理した。

| Path | Class | Notes |
| --- | --- | --- |
| `README.md` | 人間向け主入口 | repo 全体の薄い入口。docs 主入口、build 主入口、ops 主入口を分岐させる役割。 |
| `docs/README.md` | 人間向け主入口 | current / workflow / reference / archive / evidence を分けた docs 正本索引。 |
| `ops/README.md` | ops入口 | 環境起動、manual verification harness、ops 配下の構成説明。 |
| `scripts/tools/README.md` | 補助入口 | packaging / helper script の名称整理と位置づけを説明する補助入口。 |
| `package.json` | CI入口 | root Node / Playwright scripts の入口。web-client 補助実行を束ねる。 |
| `pom.xml` | CI入口 | Maven aggregator entry。repo ルートの build 集約口。 |
| `pom.server-modernized.xml` | CI入口 | server-modernized build の実行入口。 |
| `docker-compose.yml` | ops入口 | compose-based local stack の root entry。 |
| `docker-compose.modernized.dev.yml` | ops入口 | modernized dev stack 用 compose entry。 |
| `docker-compose.modernized.validation.yml` | ops入口 | validation 用 compose entry。 |
| `docker-compose.override.dev.yml` | ops入口 | dev override compose。 |
| `docker-compose.web-client.yml` | ops入口 | web-client focused compose entry。 |
| `setup-modernized-env.sh` | ops入口 | 開発環境起動の主入口。 |
| `setup-modernized-env.ps1` | ops入口 | Windows 向け開発環境起動の主入口。 |

## Current Naming Rule

- docs 主入口: `docs/README.md`
- build / CI 主入口: `package.json`, `pom.server-modernized.xml`, `pom.xml`
- ops 主入口: `ops/README.md`, `setup-modernized-env.*`, `docker-compose*.yml`

`README.md` はこれらへ分岐させるだけの thin entry として維持する。

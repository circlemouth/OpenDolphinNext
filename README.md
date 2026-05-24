# OpenDolphinNext

OpenDolphinNext は、OpenDolphin を基にした電子カルテ / ORCA 連携 Web アプリケーションとして開発を試みたものですが、個人での運用継続性、医療政策上の懸念事項から開発を中断しました。

そのため、このリポジトリの開発状況は未完です。
詳しい事情については、この記事に残しています。

電子カルテ開発は個人で行えるのか：OpenDolphinNext＠zenn
https://zenn.dev/circlemouth/articles/opendolphinnext-individual-emr

## 現状、できていることとできていないこと

### おそらくできていること
- フォーク元のOpenDolphinの弱点だった電子カルテの真正性の確保
- ORCAとの通信方式をCLAIMからAPI通信に変更
- 保守性向上のためのファイル分離

これらの項目については、まだ穴があるかもしれれません。


### 作業が中途半端になっている/手を付けられていないところ
- WEBクライアントのデザイン、各種オーダー周りなど**WEBクライアント全般の機能全般**
  - WEBクライアントについてはORCAとの受付情報の通信等は行なえますが、確認が取れていない項目も多いです。
- 電子処方箋の対応
- 電子カルテ情報共有サービスへの対応
- ORCAの隠しAPIを使用したマスタ情報APIへの接続
  - 隠しAPIについてのORCA API協議会に参加すると情報が公開されますが、情報はオープンで書かないほうがよいかもしれません。
  - 必ずORCA API協議会に確認をお願いいたします。
  
非公開でOpenDolphinフォークで開発をされている先生からの情報によると、少なくとも電子処方箋については実装可能だったとのことです。

## 技術スタック等

- Web クライアントは React / Vite ベースの `web-client/` で、ブラウザでアクセスするクライアントです。
- サーバーは Jakarta EE 10 ベースの `server-modernized/` です。

技術スタック上の主な確認点は次の通りです。

- モダナイズ版サーバー `server-modernized/` は Maven WAR プロジェクトで、Java 17 (`maven.compiler.release=17`) / Jakarta EE 10 (`jakarta.jakartaee-api.version=10.0.0`) を前提にしています。
- `server-modernized/pom.xml` の WildFly BOM は `35.0.1.Final` ですが、Docker 実行イメージは `ops/modernized-server/docker/Dockerfile` で `quay.io/wildfly/wildfly:33.0.2.Final-jdk17` を使用しています。
- サーバー Docker ビルドは `maven:3.9.6-eclipse-temurin-17` で WAR を作成し、実行時は WildFly の JDK 17 イメージにデプロイします。
- Server 側 sibling module のうち `domain/`、`api-contract/`、`persistence/` は Java 17、`reporting/` は Java 8 (`maven.compiler.release=8`) でコンパイルされます。
- 永続化は PostgreSQL 前提です。開発用 Compose は `postgres:14` を使用し、JDBC ドライバは `org.postgresql:postgresql:42.7.3` です。
- Web クライアント `web-client/` は React 18.3.1 / Vite 6.0.11 / TypeScript 5.9.3 / Vitest 4.0.5 ベースです。Docker 開発イメージは `node:22-bookworm-slim` を使用し、既定の dev server は `5173` 番ポートです。
- Web クライアントからサーバー API への開発時プロキシは `VITE_DEV_PROXY_TARGET` で制御され、既定では `http://host.docker.internal:9080/openDolphin/resources` を向きます。


## 主要ディレクトリ

| パス | 役割 |
| --- | --- |
| `web-client/` | Web クライアント |
| `server-modernized/` | サーバー |
| `api-contract/` | API DTO と共有契約 |
| `domain/` | ドメインモデル |
| `persistence/` | 永続化層 |
| `reporting/` | 帳票関連 |
| `scripts/` | 検証・補助スクリプト |
| `tests/` | repo-level 自動テスト |
| `ops/` | 現行環境の Docker / 運用補助 |
| `docs/` | 概要説明ドキュメントなど |

## 各ドキュメントへのリンク

- [ドキュメント入口](docs/README.md)
- [ソース概要](docs/source-overview.md)
- [現在の状態](docs/current-state.md)
- [アーキテクチャ](docs/architecture.md)
- [起動と検証](docs/setup-and-validation.md)
- [セキュリティとORCA境界](docs/security-and-orca.md)
- [minagawa名義の調査ドキュメント一覧](docs/minagawa-research/README.md)

## 起動・検証用スクリプト

ローカル開発環境を迷わず起動、次のラッパーを使うと簡単に起動できます。

```bash
scripts/start-modernized-dev.sh
```

このラッパーは、モダナイズ版サーバーを Docker で起動し、Web クライアントを npm/Vite dev server として `http://localhost:5173/` に起動します。ORCA 接続先は既定で WebORCA Trial `https://weborca-trial.orca.med.or.jp/` です。認証情報は `ORCA_ENV_FILE`、`./orca.env.local`、`~/.config/opendolphin/orca.env`、または環境変数から渡し、リポジトリには書いていませんが、ORCA公式ページに情報があります。

ビルドも含めて起動前に確認する場合:

```bash
START_MODERNIZED_PREBUILD=1 scripts/start-modernized-dev.sh
```

個別に検証する場合:

```bash
npm --prefix web-client run verify:web-guard
npm --prefix web-client run typecheck
npm --prefix web-client run test:ci
mvn -f pom.server-modernized.xml -pl server-modernized -am -Pstatic-analysis verify
```

Server 側の Maven 検証は、必ずリポジトリ直下の `pom.server-modernized.xml` から実行してください。
`server-modernized/pom.xml` を直接指定すると sibling module が reactor に入らないため、依存解決で失敗します。

詳細は [起動と検証](docs/setup-and-validation.md) を参照してください。

## ライセンス

ライセンスについては、フォーク元のリポジトリと、Git操作履歴の調査に基づき、ドキュメント最終変更者の移行を尊重してGLPv2として残してあります。

- [LICENSE](LICENSE)
- [LICENSE Git履歴調査](docs/minagawa-research/LICENSE_git履歴調査_20260310.md)
- [ライセンス文言とコード著者アカウントの同一性 時系列調査](docs/minagawa-research/ライセンス_コード著者アカウント同一性時系列調査_20260313.md)

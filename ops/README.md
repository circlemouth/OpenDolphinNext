# Ops ディレクトリ構成

サーバー起動・検証に関する Docker 資産を `ops/` 配下へ整理した。各サブディレクトリの役割は次の通り。

- `base/` … PostgreSQL を定義する共通 Compose。`docker compose -f ops/base/docker-compose.yml up -d db` で単体起動できる。
- `legacy-server/` … 旧 Java EE サーバー (WildFly 10) 用の Dockerfile / Compose。`docker compose -f ops/legacy-server/docker-compose.yml up -d` で `db` と `server` を起動する。
- `modernized-server/` … モダナイズ版サーバー (WildFly 33) 用の Dockerfile / Compose。`docker compose -f ops/modernized-server/docker-compose.yml up -d` で単独検証が可能。
- `shared/` … `custom.properties`・`bootstrap.sh`・Maven `settings.xml` など両サーバーで共通利用するファイル。
- `tests/api-smoke-test/` … 旧/新サーバーを比較するスモークテスト資産と、CI 用 Compose 定義 (`docker-compose.yml`)。

旧来の `docker/server*` や `server-modernized/tools/api-smoke-test` に存在していたファイルは上記へ移動済み。現行の全体導線は `docs/README.md` と `docs/runbooks/release-validation.md` を参照してください。

## Demo API 無効化と資格情報外部化 (modernized-server)

- 本番ビルドは `mvn -f pom.server-modernized.xml -pl server-modernized -P prod package` または Docker ビルド時に `--build-arg MVN_PROFILES=prod` を指定する。`prod` では `/demo` リソースが WAR へ登録されず 404 となる（デフォルトも無効化）。
- Demo API 資格情報は `server-modernized/config/demo-api.sample.properties` を雛形として、実運用では **外部ファイル** `/opt/jboss/config/demo-api.properties` もしくは `demo.api.config.path`/`DEMO_API_CONFIG_PATH` で上書きする。環境変数 `DEMO_API_*` / MicroProfile Config も優先的に適用される。
- 開発でデモ API を有効化したい場合のみ `-P demo-api-enabled` を明示し、同時に `DEMO_API_*` 環境変数で資格情報を注入する。プロファイル未指定時は `demo.api.enabled=false` が既定。
- CI の Docker ビルドで prod プロファイルを使う場合は `docker build -f ops/modernized-server/docker/Dockerfile --build-arg MVN_PROFILES=prod .` を追加し、デプロイ時に外部設定ファイルをマウントすること。

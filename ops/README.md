# Ops

`ops/` は現行 `server-modernized/` のローカル起動、検証、運用補助に必要な Docker / shell 資産を置きます。

- `base/`: PostgreSQL を定義する共通 Compose。
- `modernized-server/`: モダナイズ版サーバー用の Dockerfile / Compose。
- `shared/`: `custom.properties`、`bootstrap.sh`、Maven `settings.xml` などの共通ファイル。
- `tests/`: ORCA、storage、security などの手動確認補助。
- `tools/`: 運用補助スクリプト。

全体の起動と検証は [docs/setup-and-validation.md](../docs/setup-and-validation.md) を参照してください。

## Demo API 無効化と資格情報外部化 (modernized-server)

- 本番ビルドは `mvn -f pom.server-modernized.xml -pl server-modernized -P prod package` または Docker ビルド時に `--build-arg MVN_PROFILES=prod` を指定する。`prod` では `/demo` リソースが WAR へ登録されず 404 となる（デフォルトも無効化）。
- Demo API 資格情報は `server-modernized/config/demo-api.sample.properties` を雛形として、実運用では **外部ファイル** `/opt/jboss/config/demo-api.properties` もしくは `demo.api.config.path`/`DEMO_API_CONFIG_PATH` で上書きする。環境変数 `DEMO_API_*` / MicroProfile Config も優先的に適用される。
- 開発でデモ API を有効化したい場合のみ `-P demo-api-enabled` を明示し、同時に `DEMO_API_*` 環境変数で資格情報を注入する。プロファイル未指定時は `demo.api.enabled=false` が既定。
- CI の Docker ビルドで prod プロファイルを使う場合は `docker build -f ops/modernized-server/docker/Dockerfile --build-arg MVN_PROFILES=prod .` を追加し、デプロイ時に外部設定ファイルをマウントすること。

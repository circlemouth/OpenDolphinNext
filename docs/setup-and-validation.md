# 起動と検証

このページは、現行構成の起動と検証に使う入口コマンドだけをまとめたものです。

## 前提

- Node.js / npm
- JDK 17 と Maven
- Docker / Docker Compose
- ORCA 連携を試す場合は、ローカルの ORCA 環境変数ファイル
  - `./orca.env.local`
  - または `~/.config/opendolphin/orca.env`

## 起動

後続ワーカー向けの標準起動:

```bash
scripts/start-modernized-dev.sh
```

このラッパーは `setup-modernized-env.sh` を呼び出し、後続ワーカーが詰まりやすいローカル前提を補います。

- `ORCA_CREDENTIALS_AES_KEY_B64` と `FACTOR2_AES_KEY_B64` が未設定なら、プロセス内だけのランダム値を生成します。
- `MODERNIZED_POSTGRES_PASSWORD` が未設定なら、既存の開発用 Postgres volume と合う `opendolphin` を使います。
- ORCA 接続先は既定で WebORCA Trial `https://weborca-trial.orca.med.or.jp/` です。
- WebORCA Trial の認証情報は `ORCA_ENV_FILE`、`./orca.env.local`、`~/.config/opendolphin/orca.env`、または環境変数から渡します。認証情報はリポジトリ、ログ、提出物に含めません。
- Docker build が参照する `ext_lib/iTextAsian.jar` と `ext_lib/AppleJavaExtensions.jar` がなければ、ローカル Maven cache から `ext_lib/` にコピーします。`ext_lib/*.jar` は追跡対象外です。
- Web クライアントは Codex ブラウザで開きやすいよう、既定で HTTP の `http://localhost:5173/` に起動します。

起動前に Web build と Maven package まで実行する場合:

```bash
START_MODERNIZED_PREBUILD=1 scripts/start-modernized-dev.sh
```

ポートを変える場合:

```bash
WEB_CLIENT_DEV_PORT=5174 scripts/start-modernized-dev.sh
```

WebORCA Trial の認証情報は、認証情報をリポジトリに書かず、ローカルenvファイルまたは環境変数から渡します。

```bash
ORCA_ENV_FILE=~/.config/opendolphin/orca.env scripts/start-modernized-dev.sh
```

低レベルの起動入口を直接使う場合:

```bash
WEB_CLIENT_MODE=npm ./setup-modernized-env.sh
```

このスクリプトは、Web クライアントを `npm run dev` で起動しつつ、モダナイズ版サーバーのローカル環境を立ち上げます。

Codex ブラウザで `https://localhost:5173/` が `ERR_BLOCKED_BY_CLIENT` になる場合は、HTTPS を使わずに次で起動します。

```bash
VITE_DEV_USE_HTTPS=0 WEB_CLIENT_CODEX_BROWSER_COMPAT=1 WEB_CLIENT_MODE=npm ./setup-modernized-env.sh
```

## Web クライアント検証

```bash
npm --prefix web-client run verify:web-guard
npm --prefix web-client run typecheck
npm --prefix web-client run test:ci
npm --prefix web-client run build
npm --prefix web-client run ci
```

## Server 検証

Server 側は Maven reactor 入口として、リポジトリ直下の `pom.server-modernized.xml` を使います。
`server-modernized/pom.xml` を直接指定すると、`domain/`、`api-contract/`、`persistence/`、`reporting/` などの sibling module が reactor に入らず、依存解決で失敗します。

focused test:

```bash
mvn -f pom.server-modernized.xml -pl server-modernized -am -Dtest=<TestClass> test
```

full verify:

```bash
mvn -f pom.server-modernized.xml -pl server-modernized -am -Pstatic-analysis verify
```

## runtime smoke

起動済みスタックに対する最小 smoke:

```bash
cd web-client && node scripts/runtime-ready-smoke.mjs
```

## 起動後の確認

```bash
curl -fsS http://localhost:9080/openDolphin/api/health
curl -fsS -I http://localhost:5173/
```

`/api/health/readiness` は、DB、監査ログ、添付ストレージ、ORCA probe などを含む readiness です。WebORCA Trial 認証情報が正しく設定されていれば、ORCA check も `UP` になります。`DOWN` の場合は、`ORCA_ENV_FILE` または `ORCA_API_*` の設定を確認してください。

開発用 smoke ログイン:

- 施設ID: `1.3.6.1.4.1.9414.72.103`
- ユーザーID: `doctor1`
- パスワード: 起動ログの `Pass source` を確認してください。既定は開発用 smoke password です。

## 起動中プロセスの確認と停止

```bash
tmux ls | rg opendolphin-web-client || true
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | rg opendolphin || true
```

Web クライアント dev server を止める場合:

```bash
tmux kill-session -t opendolphin-web-client-dev
```

Docker 側を止める場合:

```bash
docker compose -f docker-compose.modernized.dev.yml -f docker-compose.override.dev.yml stop
```

## 実行条件つきのコマンド

- `WEB_CLIENT_MODE=npm ./setup-modernized-env.sh` は Docker、Node.js、JDK、Maven などのローカル依存が必要です。
- `cd web-client && node scripts/runtime-ready-smoke.mjs` は先にアプリケーションが起動している必要があります。
- ORCA を使う検証は接続先、認証情報、対象環境が必要です。リポジトリ単体では完結しません。
- `mvn -f pom.server-modernized.xml -pl server-modernized -am -Pstatic-analysis verify` は実行時間が長く、JDK / Maven / 依存取得が必要です。

## 追跡しないローカル生成物

起動時に次のようなローカル生成物ができます。これらはコミット対象にしません。

- `custom.properties.dev`
- `docker-compose.override.dev.yml`
- `web-client/.env.local`
- `tmp/`
- `artifacts/preprod/`
- `ext_lib/*.jar`
- `web-client/dist/`
- `**/target/`

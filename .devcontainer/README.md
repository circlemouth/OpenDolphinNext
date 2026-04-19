# OpenDolphin WebClient Dev Container

This dev container spins up a complete development stack for the `web-client` and the Jakarta EE–based `server-modernized` service.

> **Note (Apple Silicon)**
> Dev コンテナ本体は `mcr.microsoft.com/devcontainers/base:jammy` を利用するため ARM ネイティブで動作しますが、WildFly ベースの `server-modernized-dev` は x86_64 イメージのみ提供されているため Docker Desktop 上でエミュレーションが入ります。

## Getting Started

1. Open this project in VS Code.
2. When prompted to **Reopen in Container**, confirm the action.
3. VS Code builds the development container. ワークスペースはコンテナ内の `/workspaces/OpenDolphin_WebClient` にマウントされます。`postCreateCommand` が `web-client` の npm 依存と `server-modernized` の Maven 依存をセットアップします。

## Working with the Services

- `web-client`: run `npm run dev --prefix web-client` inside the `app` container to start the frontend Vite dev server (port 5173).
- `db-modernized`: PostgreSQL 14 is available on port 55432 (起動は任意)。`MODERNIZED_POSTGRES_PASSWORD` is required; do not commit a real password or local secret value.

## サーバーを起動したい場合

Dev Container 起動時には `server-modernized-dev` コンテナは自動では立ち上がりません。必要になったタイミングで以下のコマンドを実行してください（ホスト側または `app` コンテナ内のどちらでも可）。

```bash
docker compose -f .devcontainer/docker-compose.yml --profile modernized-server up server-modernized-dev
```

- Required local environment values: `MODERNIZED_POSTGRES_PASSWORD`, `SYSAD_USER_NAME`, and `SYSAD_PASSWORD`.
- サーバー停止は `docker compose -f .devcontainer/docker-compose.yml --profile modernized-server down` で行えます。
- `--build` を追加すると最新ソースで WildFly イメージを再ビルドできますが、Jakarta EE 10 移行が未完のためビルドに失敗することがあります。

### 既知のビルドエラーについて

`server-modernized` モジュールは Jakarta EE 10 への移行途中で、`mvn -f server-modernized/pom.xml clean install` 実行時にコンパイルエラー（クラス欠落・アノテーション不整合など）が発生します。そのため、Dev Container の初回ビルドで `server-modernized-dev` イメージ作成が失敗する場合があります。サーバー側の移行タスクが完了し WAR が生成できる状態になってから再ビルドしてください。

## Useful Commands

- Rebuild only the server image after source changes:
  ```bash
  docker compose -f .devcontainer/docker-compose.yml build server-modernized-dev
  ```
- Tail server logs from the host:
  ```bash
  docker compose -f .devcontainer/docker-compose.yml logs -f server-modernized-dev
  ```

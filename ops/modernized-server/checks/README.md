# モダナイズ版サーバー起動確認スクリプト

## 概要

`verify_startup.sh` は、モダナイズ版 WildFly コンテナに電子カルテ運用で必須となるリソースが揃っているかを自動検証するための Bash スクリプトです。`docker exec` と `jboss-cli.sh` を利用し、環境変数 `FACTOR2_AES_KEY_B64` の有無や JDBC データソース、JMS リソース、Jakarta Concurrency リソースを `read-resource` で確認します。

## 前提条件

- Docker がインストールされており、対象 WildFly コンテナに対して `docker exec` が可能であること
- コンテナ内の `jboss-cli.sh` にアクセスできること（既定パス: `/opt/jboss/wildfly/bin/jboss-cli.sh`）
- WildFly 管理ポートへパスワード無しで接続できること（`docker-compose.modernized.dev.yml` の既定設定）
- スクリプトは `set -euo pipefail` が有効なため、確認が失敗すると即座に処理が終了します

## 使い方

```bash
cd /workspaces/OpenDolphin_WebClient
./ops/modernized-server/checks/verify_startup.sh <wildfly-container-name> [/path/to/jboss-cli.sh]
```

- `<wildfly-container-name>` には `docker ps --format '{{.Names}}'` で確認できるコンテナ名を指定します。開発環境の例: `opendolphin-server-modernized-dev`.
- `jboss-cli.sh` が既定の `/opt/jboss/wildfly/bin/jboss-cli.sh` 以外に配置されている場合は、第 2 引数でパスを上書きしてください。
- スクリプトはステップごとに `[INFO]` ログを出力し、リソースが検証できた場合は `[OK]` を表示します。異常がある場合は `[ERROR]` ログとともに終了コード 1 を返すため、CI や運用チェックに組み込むことでブロッカーを早期検知できます。

## 想定する検証ステップ

1. WildFly コンテナが起動済みであることを `docker ps` で確認する。
2. 上記コマンドでスクリプトを実行し、`FACTOR2_AES_KEY_B64` が設定済みであることを確認する。
3. JDBC データソース（`PostgresDS`）が `read-resource` で取得できることを確認する。ORCA master candidate search は OpenDolphin local master cache を使い、標準起動で `ORCADS` を必須にしない。
4. JMS キュー `dolphinQueue` と `JmsXA` の `read-resource` が成功することを確認する。
5. `ManagedExecutor`, `ManagedScheduledExecutor`, `ManagedThreadFactory` の `read-resource` が成功することを確認する。
6. すべて `OK` となったことをもって、モダナイズ版 WildFly の起動に必要なリソースが揃っていると判断する。

なお、本ドキュメントは手順の参照用であり、スクリプト自体はリポジトリ内でのみ配置される想定です。継続的な運用チェックへ組み込む際は、Ops チームのジョブ管理基盤（例: Jenkins / Rundeck）からスクリプトを呼び出し、結果を監査ログに残すことを推奨します。

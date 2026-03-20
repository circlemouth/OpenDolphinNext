# A07 health / readiness の運用化

- RUN_ID: `20260320T201118Z`
- Task: `A07`
- Status: `DONE`
- Worker: `health-readiness-hardening`

## 実施内容
- `LogFilter` に `/api/health` と `/api/health/readiness` の匿名許可を追加し、運用 probe をセッション認証なしで通すよう変更。
- `RestOrcaTransport` に 3 秒 timeout の readiness probe を追加し、解決済み ORCA base URL に対する `GET` 実 probe を導入。
- `OperationsHealthResource` の ORCA readiness 判定を `auditSummary()` の文字列分岐から probe 結果ベースへ置換し、`statusCode` / `url` / `error` / `message` を payload に反映。
- `OperationsHealthResourceTest` は probe stub ベースへ更新し、`LogFilterTest` に匿名 readiness 許可ケースを追加。

## 変更ファイル
- `server-modernized/src/main/java/open/dolphin/rest/LogFilter.java`
- `server-modernized/src/main/java/open/dolphin/rest/OperationsHealthResource.java`
- `server-modernized/src/main/java/open/dolphin/orca/transport/RestOrcaTransport.java`
- `server-modernized/src/test/java/open/dolphin/rest/LogFilterTest.java`
- `server-modernized/src/test/java/open/dolphin/rest/OperationsHealthResourceTest.java`

## 実行コマンド
```bash
ROOT=$(git rev-parse --show-toplevel)
cd "$ROOT"
mvn -pl server-modernized -am -Dtest=OperationsHealthResourceTest,LogFilterTest -DfailIfNoTests=false clean test
rg -n "orca.host=unknown" server-modernized/src/main/java/open/dolphin/rest/OperationsHealthResource.java
```

## テスト結果
- `mvn -pl server-modernized -am -Dtest=OperationsHealthResourceTest,LogFilterTest -DfailIfNoTests=false clean test`
  - `BUILD SUCCESS`
  - `OperationsHealthResourceTest`: 3 tests, 0 failures
  - `LogFilterTest`: 14 tests, 0 failures
- `rg -n "orca.host=unknown" .../OperationsHealthResource.java`
  - 出力 0 件

## メモ
- 初回の増分 test 実行では stale class により `OperationsHealthResourceTest` が誤って旧型情報を参照したため、`clean test` を正本検証コマンドとして採用。
- `RestOrcaTransport` 追加時に終端 brace が崩れていたため、main source の構文修正を行ってから再検証した。

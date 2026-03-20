# A08 audit 契約吸収と common 廃止

- RUN_ID: `20260320T202306Z`
- Task: `A08`
- Status: `DONE`
- Worker: `audit-absorption-and-common-removal`

## 実施内容
- `open.dolphin.audit.AuditEventEnvelope` と `open.dolphin.audit.AuditTrailService` を `server-modernized` へ移し、`server-modernized` の compile-time audit 契約を self-contained 化。
- root `pom.xml`、`pom.server-modernized.xml`、`server-modernized/pom.xml`、`client/pom.xml` から `common` module / `opendolphin-common` 依存を除去。
- `server-modernized/pom.xml` から `copy-jakarta-common` 実行と WAR への common jar 詰め替え設定を削除。
- `client` が唯一利用していた `open.dolphin.common.OrcaConnect` / `OrcaApi` を `client` 配下へ内包し、`common` module なしで POM 解析可能な状態へ変更。
- `common/` 配下の production/test source と POM を削除し、dead module を build から外した。

## 変更ファイル
- `pom.xml`
- `pom.server-modernized.xml`
- `server-modernized/pom.xml`
- `client/pom.xml`
- `client/src/main/java/open/dolphin/common/OrcaApi.java`
- `client/src/main/java/open/dolphin/common/OrcaConnect.java`
- `server-modernized/src/main/java/open/dolphin/audit/AuditEventEnvelope.java`
- `server-modernized/src/main/java/open/dolphin/audit/AuditTrailService.java`
- `common/` 配下の旧 source / test / POM 一式削除

## 実行コマンド
```bash
ROOT=$(git rev-parse --show-toplevel)
cd "$ROOT"
rg -n "open\\.dolphin\\.audit|AuditTrailService|AuditEventEnvelope" .
rg -n "opendolphin-common|copy-jakarta-common|common</module>" pom.xml pom.server-modernized.xml client/pom.xml server-modernized/pom.xml
mvn -pl server-modernized -am -Dtest=TotpHelperTest,AuditTrailServiceTest -DfailIfNoTests=false test
mvn -pl server-modernized -am -DskipTests package
jar tf server-modernized/target/opendolphin-server.war | rg "opendolphin-common|open/dolphin/common/Orca"
```

## テスト結果
- `mvn -pl server-modernized -am -Dtest=TotpHelperTest,AuditTrailServiceTest -DfailIfNoTests=false test`
  - `BUILD SUCCESS`
  - `TotpHelperTest`: 3 tests, 0 failures
  - `AuditTrailServiceTest`: 1 test, 0 failures
- `mvn -pl server-modernized -am -DskipTests package`
  - `BUILD SUCCESS`
- `jar tf server-modernized/target/opendolphin-server.war | rg "opendolphin-common|open/dolphin/common/Orca"`
  - 出力 0 件

## メモ
- `rg -n "artifactId>opendolphin-common|copy-jakarta-common|common</module>" .` を repo 全体へ掛けると、orchestration 文書自身の説明文と Legacy `server/pom.xml` がヒットする。Legacy `server/` は絶対ルールで非改変のため、現行 build 導線の確認対象を root / `pom.server-modernized.xml` / `server-modernized` / `client` POM と WAR 中身に限定して完了判定した。
- `jar tf ... | rg "WEB-INF/lib/.*common"` は `commons-*` や `netty-common` など unrelated library を拾うため、common module 混入確認は `opendolphin-common|open/dolphin/common/Orca` で評価した。

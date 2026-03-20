# A05 実行ログ

- RUN_ID: `20260320T200327Z`
- task: `A05` ORCA queue mock 面の削除
- サブエージェントの役割: `worker` 1 体で queue mock 実装、admin config 依存、公開登録、関連テストの整理を担当

## 変更ファイル
- `server-modernized/src/main/java/open/dolphin/rest/OpenDolphinRestApplication.java`
- `server-modernized/src/main/java/open/dolphin/rest/admin/AdminConfigSnapshot.java`
- `server-modernized/src/main/java/open/dolphin/rest/admin/AdminConfigStore.java`
- `server-modernized/src/main/java/open/dolphin/rest/AdminConfigResource.java`
- `server-modernized/src/test/java/open/dolphin/rest/AdminConfigResourceTest.java`
- `server-modernized/src/test/java/open/dolphin/rest/WebXmlEndpointExposureTest.java`
- 削除: `server-modernized/src/main/java/open/dolphin/rest/OrcaQueueResource.java`
- 削除: `server-modernized/src/main/java/open/dolphin/rest/OrcaQueueStore.java`
- 削除: `server-modernized/src/test/java/open/dolphin/rest/OrcaQueueResourceTest.java`

## 実施内容
- live 実装のない queue mock 用 resource / store / 専用 test を削除した。
- admin config から `useMockOrcaQueue` を削除し、`x-orca-queue-mode` と mock/live source 切替ロジックを削除した。
- `OpenDolphinRestApplication` と exposure test から queue mock 面の公開登録を外した。

## 実行コマンド
- `rg -n "OrcaQueue|useMockOrcaQueue|orca/queue|x-orca-queue-mode|OPENDOLPHIN_ALLOW_MOCK_ORCA_QUEUE" server-modernized/src/main server-modernized/src/test`
- `mvn -pl server-modernized -am -Dtest=AdminConfigResourceTest,WebXmlEndpointExposureTest -DfailIfNoTests=false test`

## テスト結果
- `rg -n "OrcaQueue|useMockOrcaQueue|orca/queue|x-orca-queue-mode|OPENDOLPHIN_ALLOW_MOCK_ORCA_QUEUE" ...`
  - 0 件
- `mvn -pl server-modernized -am -Dtest=AdminConfigResourceTest,WebXmlEndpointExposureTest -DfailIfNoTests=false test`
  - `BUILD SUCCESS`
  - `AdminConfigResourceTest`: `2 tests, 0 failures`
  - `WebXmlEndpointExposureTest`: `2 tests, 0 failures`

## blocker
- なし

## 次回の先頭タスク
- `A06` mock / stub / Trial-only 公開面の削除

# A04 実行ログ

- RUN_ID: `20260320T200222Z`
- task: `A04` 平文 credential cache と管理 API の削除
- サブエージェントの役割: `worker` 1 体で削除対象の実装・テスト・公開登録の整理を担当

## 変更ファイル
- `server-modernized/src/main/java/open/dolphin/rest/OpenDolphinRestApplication.java`
- `server-modernized/src/test/java/open/dolphin/rest/WebXmlEndpointExposureTest.java`
- 削除: `server-modernized/src/main/java/open/dolphin/rest/AdminSecurityResource.java`
- 削除: `server-modernized/src/main/java/open/dolphin/mbean/UserCache.java`
- 削除: `server-modernized/src/test/java/open/dolphin/rest/AdminSecurityResourceTest.java`
- 削除: `server-modernized/src/test/java/open/dolphin/mbean/UserCacheTest.java`

## 実施内容
- 平文 password を保持していた `UserCache` を削除した。
- 可視化 / clear API だった `AdminSecurityResource` を削除した。
- `OpenDolphinRestApplication` から当該 resource を登録解除した。
- `WebXmlEndpointExposureTest` に `AdminSecurityResource` 非公開化の期待値を追加した。

## 実行コマンド
- `rg -n "UserCache|header-credentials/cache|HEADER_CREDENTIAL_CACHE" server-modernized/src/main server-modernized/src/test`
- `mvn -pl server-modernized -am -Dtest=WebXmlEndpointExposureTest -DfailIfNoTests=false test`

## テスト結果
- `rg -n "UserCache|header-credentials/cache|HEADER_CREDENTIAL_CACHE" ...`
  - 0 件
- `mvn -pl server-modernized -am -Dtest=WebXmlEndpointExposureTest -DfailIfNoTests=false test`
  - `BUILD SUCCESS`
  - `WebXmlEndpointExposureTest`: `2 tests, 0 failures`

## blocker
- なし

## 次回の先頭タスク
- `A05` ORCA queue mock 面の削除

# A03 実行ログ

- RUN_ID: `20260320T195922Z`
- task: `A03` 認可判定の一本化
- サブエージェントの役割: `worker` 1 体で対象 resource の admin 判定整理を担当

## 変更ファイル
- `server-modernized/src/main/java/open/dolphin/rest/AbstractResource.java`
- `server-modernized/src/main/java/open/dolphin/rest/KarteDocumentWriteResource.java`
- `server-modernized/src/main/java/open/dolphin/rest/StampResource.java`
- `server-modernized/src/main/java/open/dolphin/rest/KarteRevisionResource.java`
- `server-modernized/src/main/java/open/dolphin/rest/SystemResource.java`
- `server-modernized/src/main/java/open/dolphin/rest/LetterResource.java`
- `server-modernized/src/main/java/open/dolphin/rest/PatientImagesResource.java`

## 実施内容
- `AbstractResource` に `resolveActorRole(HttpServletRequest, UserServiceBean)` を追加し、actor 文字列を `userServiceBean.isAdmin(actor)` で判定する共通経路を用意した。
- `StampResource` の施設アクセス判定を `request.isUserInRole("ADMIN")` から `userServiceBean.isAdmin(remoteUser)` に置換した。
- audit payload の `actorRole` 付与で `request.isUserInRole("ADMIN")` を使っていた resource を共通 helper 呼び出しへ統一した。
- `UserServiceBean` を持っていなかった resource には最小の CDI inject を追加した。

## 実行コマンド
- `rg -n "isUserInRole\\(" server-modernized/src/main/java`
- `mvn -pl server-modernized -am -Dtest=StampResourceTest,KarteRevisionResourceAuthorizationTest,LetterResourceTest,PatientImagesResourceTest,SystemResourceTest -DfailIfNoTests=false test`

## テスト結果
- `rg -n "isUserInRole\\(" server-modernized/src/main/java`
  - 0 件
- `mvn -pl server-modernized -am -Dtest=StampResourceTest,KarteRevisionResourceAuthorizationTest,LetterResourceTest,PatientImagesResourceTest,SystemResourceTest -DfailIfNoTests=false test`
  - `BUILD SUCCESS`
  - `KarteRevisionResourceAuthorizationTest`: `4 tests, 0 failures`
  - `SystemResourceTest`: `18 tests, 0 failures`
  - `PatientImagesResourceTest`: `11 tests, 0 failures`
  - `StampResourceTest`: `7 tests, 0 failures`
  - `LetterResourceTest`: `5 tests, 0 failures`

## blocker
- なし

## 次回の先頭タスク
- `A04` 平文 credential cache と管理 API の削除

# A06 実行ログ

- RUN_ID: `20260320T200518Z`
- task: `A06` mock / stub / Trial-only 公開面の削除
- サブエージェントの役割: `worker` 1 体を起動して着手させたが返却不達だったため、メインエージェントが担当範囲だけを継続実装して完了

## 変更ファイル
- `server-modernized/src/main/java/open/dolphin/rest/OpenDolphinRestApplication.java`
- `server-modernized/src/main/java/open/dolphin/rest/PatientModV2OutpatientResource.java`
- `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaPatientResource.java`
- `server-modernized/src/main/java/open/dolphin/orca/transport/OrcaTransport.java`
- `server-modernized/src/main/java/open/dolphin/orca/service/OrcaWrapperService.java`
- `server-modernized/src/main/java/open/dolphin/orca/adapter/DefaultOrcaPatientAdapter.java`
- `server-modernized/src/test/java/open/dolphin/rest/WebXmlEndpointExposureTest.java`
- `server-modernized/src/test/java/open/dolphin/rest/orca/OrcaPatientResourceIdempotencyTest.java`
- `server-modernized/src/test/java/open/dolphin/orca/service/OrcaWrapperServicePatientIdListPayloadTest.java`
- `server-modernized/src/test/java/open/dolphin/orca/adapter/DefaultOrcaPatientAdapterStubIntegrationTest.java`
- `server-modernized/src/test/java/open/dolphin/orca/transport/StubOrcaTransport.java`
- 削除
  - `server-modernized/src/main/java/open/dolphin/rest/PatientModV2OutpatientMockResource.java`
  - `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaMedicalAdministrationResource.java`

## 実施内容
- mock / Trial-only 公開 resource 2 件を削除し、公開登録と exposure test から除去した。
- `PatientModV2OutpatientResource` の未使用 mock entrypoint を削除した。
- `OrcaPatientResource` の delete operation を stub 応答から explicit error へ変更した。
- production code の `isStub()` 呼び出しを除去し、`dataSource` 未設定時の扱いを `real` に統一した。

## 実行コマンド
- `rg -n "PatientModV2OutpatientMockResource|OrcaMedicalAdministrationResource|isStub\\(" server-modernized/src/main`
- `mvn -pl server-modernized -am -Dtest=WebXmlEndpointExposureTest,PatientModV2OutpatientResourceIdempotencyTest,OrcaWrapperServicePatientIdListPayloadTest,OrcaPatientResourceIdempotencyTest,DefaultOrcaPatientAdapterStubIntegrationTest -DfailIfNoTests=false test`

## テスト結果
- `rg -n "PatientModV2OutpatientMockResource|OrcaMedicalAdministrationResource|isStub\\(" server-modernized/src/main`
  - 0 件
- `mvn -pl server-modernized -am -Dtest=WebXmlEndpointExposureTest,PatientModV2OutpatientResourceIdempotencyTest,OrcaWrapperServicePatientIdListPayloadTest,OrcaPatientResourceIdempotencyTest,DefaultOrcaPatientAdapterStubIntegrationTest -DfailIfNoTests=false test`
  - `BUILD SUCCESS`
  - 合計 `16 tests, 0 failures`

## blocker
- なし

## 次回の先頭タスク
- `A07` health / readiness の運用化

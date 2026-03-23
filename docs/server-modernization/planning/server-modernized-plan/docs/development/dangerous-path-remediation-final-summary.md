# dangerous path remediation final summary

- run_id: 20260323T125847Z
- source_of_truth: `docs/server-modernization/planning/server-modernized-plan/docs/development/dangerous-path-remediation-execution-checklist.md`
- overall_result: done

## 完了した Patch Set
- PS01: 公開危険 route 停止
- PS02: prod-like 起動ガード
- PS03: ORCA facility fail-fast
- PS04: security/bootstrap 止血
- PS05: TOTP-only 固定
- PS06: module/attachment/image 契約固定
- PS07: 残留 fallback 掃除と全体回帰
- PS08: ドキュメント更新と最終検収

## 変更ファイル一覧
- `server-modernized/src/main/java/open/dolphin/rest/OpenDolphinRestApplication.java`
- `server-modernized/src/test/java/open/dolphin/rest/WebXmlEndpointExposureTest.java`
- `server-modernized/src/test/java/open/dolphin/rest/PublicRouteInventoryContractTest.java`
- `server-modernized/src/main/java/open/dolphin/runtime/config/ServerConfigurationResolver.java`
- `server-modernized/src/main/java/open/dolphin/runtime/config/ServerConfigurationValidator.java`
- `server-modernized/src/main/java/open/dolphin/security/integrity/DocumentIntegrityConfig.java`
- `server-modernized/src/main/java/open/dolphin/mbean/ServletStartup.java`
- `server-modernized/config/server-modernized.env.sample`
- `server-modernized/config/attachment-storage.sample.yaml`
- `server-modernized/src/main/java/open/dolphin/orca/transport/RestOrcaTransport.java`
- `server-modernized/src/main/java/open/dolphin/orca/sync/OrcaPatientSyncScheduler.java`
- `server-modernized/src/test/java/open/dolphin/orca/transport/RestOrcaTransportTest.java`
- `server-modernized/src/main/java/open/dolphin/rest/RequestSecuritySupport.java`
- `server-modernized/src/main/java/open/dolphin/rest/AbstractResource.java`
- `server-modernized/src/main/java/open/dolphin/rest/AdminAccessPasswordResetResource.java`
- `server-modernized/src/test/java/open/dolphin/tools/ci/RepoGuardScriptsIT.java`
- `server-modernized/src/main/java/open/dolphin/session/UserServiceBean.java`
- `server-modernized/src/main/java/open/dolphin/rest/SessionAuthResource.java`
- `server-modernized/src/main/java/open/dolphin/rest/support/UserMutationRequestMapper.java`
- `server-modernized/src/main/java/open/dolphin/rest/UserResource.java`
- `server-modernized/src/main/java/open/dolphin/security/SecondFactorSecurityConfig.java`
- `server-modernized/src/main/java/open/dolphin/security/fido/Fido2Config.java` 削除
- `server-modernized/pom.xml`
- `server-modernized/src/test/java/open/dolphin/security/SecurityDefensiveCopyTest.java`
- `server-modernized/tools/flyway/sql/V0302__module_payload_table.sql`
- `server-modernized/tools/flyway/scripts/module-payload-migrate-once.sql` 削除
- `server-modernized/tools/flyway/scripts/module-payload-verify.sql` 削除
- `server-modernized/tools/flyway/scripts/run-module-payload-migration.sh` 削除
- `server-modernized/tools/flyway/README.md`
- `server-modernized/src/main/java/open/dolphin/runtime/config/StoragePersistenceContractValidator.java`
- `server-modernized/src/test/java/open/dolphin/runtime/config/StoragePersistenceContractValidatorTest.java`
- `server-modernized/src/main/java/open/dolphin/storage/attachment/AttachmentStorageMode.java`
- `server-modernized/src/main/java/open/dolphin/storage/attachment/AttachmentStorageConfigLoader.java`
- `server-modernized/src/main/java/open/dolphin/storage/attachment/AttachmentStorageManager.java`
- `server-modernized/src/main/java/open/dolphin/storage/image/ImageStorageManager.java`
- `server-modernized/src/main/java/open/dolphin/session/KarteDocumentWriteService.java`
- `server-modernized/src/main/java/open/dolphin/session/PatientImageServiceBean.java`
- `server-modernized/src/main/java/open/dolphin/rest/PatientImagesResource.java`
- `server-modernized/src/main/java/open/dolphin/rest/PatientImagesSupport.java`
- `server-modernized/src/main/java/open/dolphin/storage/attachment/AttachmentKeyResolver.java`
- `server-modernized/src/main/java/open/dolphin/rest/OperationsReadinessEvaluator.java`
- `server-modernized/src/test/java/open/dolphin/db/FreshSchemaBaselineTest.java`
- `server-modernized/src/test/java/open/dolphin/storage/attachment/AttachmentStorageConfigLoaderTest.java`
- `server-modernized/src/test/java/open/dolphin/storage/attachment/AttachmentStorageManagerTest.java`
- `server-modernized/src/test/java/open/dolphin/session/PatientImageServiceBeanTest.java`
- `server-modernized/src/test/java/open/dolphin/rest/PatientImagesResourceTest.java`
- `server-modernized/src/test/java/open/dolphin/rest/OperationsHealthResourceTest.java`
- `server-modernized/src/test/java/open/dolphin/rest/OperationsReadinessResourceTest.java`
- `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaLocalMedicalOutpatientResource.java`
- `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaDiseaseResource.java`
- `server-modernized/src/test/java/open/dolphin/rest/orca/OrcaLocalMedicalOutpatientResourceTest.java`
- `server-modernized/src/test/java/open/dolphin/rest/orca/OrcaDiseaseResourceTest.java`
- `docs/server-modernization/planning/server-modernized-plan/docs/development/dangerous-path-remediation-execution-status.md`
- `docs/server-modernization/planning/server-modernized-plan/docs/development/dangerous-path-remediation-execution-log.md`
- `docs/server-modernization/planning/server-modernized-plan/docs/development/dangerous-path-remediation-final-summary.md`

## 追加/更新テスト一覧
- `WebXmlEndpointExposureTest`
- `PublicRouteInventoryContractTest`
- `DocumentIntegrityConfigTest`
- `ServerConfigurationValidatorTest`
- `ServletStartupSecurityGuardTest`
- `ServerConfigurationResolverTest`
- `AttachmentStorageConfigLoaderTest`
- `RestOrcaTransportTest`
- `SecurityHeadersFilterTest`
- `CsrfProtectionFilterTest`
- `LogoutResourceTest`
- `SystemServiceBeanAddFacilityAdminTest`
- `RepoGuardScriptsIT#packagedWarDoesNotContainInitialAccountMakerClass`
- `SessionAuthResourceTest`
- `UserResourceTest`
- `SecurityDefensiveCopyTest`
- `StoragePersistenceContractValidatorTest`
- `FreshSchemaBaselineTest`
- `AttachmentStorageManagerTest`
- `PatientImageServiceBeanTest`
- `PatientImagesResourceTest`
- `OperationsHealthResourceTest`
- `OperationsReadinessResourceTest`
- `KarteServiceBeanDocPkTest`
- `OrcaLocalMedicalOutpatientResourceTest`
- `OrcaDiseaseResourceTest`

## 実行した検証コマンド
- `mvn -q -pl server-modernized -am -DskipTests compile`
- `mvn -pl server-modernized -Dtest=WebXmlEndpointExposureTest,PublicRouteInventoryContractTest test`
- `mvn -pl server-modernized -Dtest=DocumentIntegrityConfigTest,ServerConfigurationValidatorTest,ServletStartupSecurityGuardTest,ServerConfigurationResolverTest,AttachmentStorageConfigLoaderTest,RestOrcaTransportTest test`
- `mvn -pl server-modernized -Dtest=SecurityHeadersFilterTest,CsrfProtectionFilterTest,LogoutResourceTest,SystemServiceBeanAddFacilityAdminTest,RepoGuardScriptsIT#packagedWarDoesNotContainInitialAccountMakerClass test`
- `mvn -pl server-modernized -Dtest=SessionAuthResourceTest,UserResourceTest,ServerConfigurationValidatorTest test`
- `mvn -pl server-modernized -Dtest=FreshSchemaBaselineTest,AttachmentStorageConfigLoaderTest,StoragePersistenceContractValidatorTest,OperationsHealthResourceTest test`
- `mvn -pl server-modernized -Dtest=AttachmentStorageManagerTest,PatientImageServiceBeanTest,PatientImagesResourceTest,KarteServiceBeanDocPkTest test`
- `mvn -pl server-modernized -Dtest=WebXmlEndpointExposureTest,PublicRouteInventoryContractTest,RestOrcaTransportTest,ServletStartupSecurityGuardTest,DocumentIntegrityConfigTest,ServerConfigurationValidatorTest,AttachmentStorageConfigLoaderTest,AttachmentStorageManagerTest,OrcaLocalMedicalOutpatientResourceTest,OrcaDiseaseResourceTest,SecurityHeadersFilterTest,CsrfProtectionFilterTest,LogoutResourceTest,SessionAuthResourceTest,UserResourceTest,PatientImageServiceBeanTest,PatientImagesResourceTest,FreshSchemaBaselineTest test`
- `rg "buildFallbackVisit" server-modernized/src`
- `rg "fallback to permissive|Fallback to permissive" server-modernized/src`
- `rg "AttachmentStorageMode\.DATABASE|\bDATABASE\b" server-modernized/src/main/java/open/dolphin/storage server-modernized/src/main/java/open/dolphin/runtime/config`
- `rg "fido2\." server-modernized/src server-modernized/config server-modernized/pom.xml`
- `rg "d_module_payload" server-modernized/tools server-modernized/src`
- `rg "AdminAccessPasswordResetResource.class|OrcaMedicalOutpatientResource.class|OrcaLocalMedicalOutpatientResource.class|OrcaDiseaseResource.class|OrcaResource.class|OrcaFacilityResource.class|OrcaPatientDiseaseResource.class" server-modernized/src/main/java/open/dolphin/rest/OpenDolphinRestApplication.java`
- `find server-modernized \( -name '__MACOSX' -o -name '.DS_Store' -o -name 'Thumbs.db' \) -print`

## 未解決項目
- なし

## 設計待ちへ送った項目
- truthful session revoke を伴う password reset 再公開
- bare `diagnosisId` 依存 mutation の恒久的な所有権/認可再設計
- checklist 11.1 に列挙された Phase2-A 項目全般

## prod-like 起動禁止条件がコード上どう反映されたか
- `ServletStartup.enforceStartupSecurityGuards()` で `orca.push.enabled`, `orca.push.shadow-mode`, `orca.push.recovery.enabled`, `orca.patient-sync.enabled` を production-like で即 reject
- 同メソッドで `document.integrity.mode=enforce` と有効な `document.integrity.keyring-path` を必須化
- 同メソッドで `fido2.rp.id`, `fido2.rp.name`, `fido2.allowed.origins` が存在したら reject
- 同メソッドで `attachment.storage.mode=s3` 以外と `attachment.storage.database.lob-table` の存在を reject
- `StoragePersistenceContractValidator` を startup に組み込み、`d_module_payload` と external-only 契約違反を reject

## hidden risk が残る箇所
- password reset は route を止めたが、truthful session revoke の恒久実装自体は未着手
- `OrcaDiseaseResource` の mutation 系は public 再公開禁止前提の design-wait コメントに寄せており、恒久認可設計は未実施
- `SystemServiceBean` / `InitialAccountMaker` は現在リポジトリ上で危険 seed を含まないが、将来 seed 導線を復活させる変更には packaging smoke 以上の監視が必要

# Phase2 Execution Board

作成日: 2026-03-24  
更新日: 2026-03-25  
RUN_ID: 20260325T045414Z  
正本 checklist: `docs/development/phase2_current_coding_tasks_checklist_v1.md`

## 運用ルール

- 状態は `todo / doing / verify / done`
- checkbox は `コード + docs + tests + grep` の実証後のみ更新
- lane 間でファイル衝突がある CT は同一 lane で順次処理する
- 主担当はこの board と checklist 更新責任を持つ

## Lane 状態

| Lane | Scope | 状態 | 備考 |
| --- | --- | --- | --- |
| A | CT-01, CT-06 | done | CT-01 / CT-06 verify 完了 |
| B | CT-02 | done | CT-02 verify 完了 |
| C | CT-07 | done | ORCA internal boundary split verify 完了 |
| D | CT-08 | done | V0307 + encounter/schedule/reconciliation + sync/push runtime store verify 完了 |
| E | hidden consumer inventory / A2 contract freeze / ORCA field inventory / PVT cache inventory / push replay inventory | done | 前提文書を追加済み |
| F | CT-03, CT-04, CT-05 | done | CT-03 / CT-04 / CT-05 done |
| G | CT-09, CT-10, CT-11 | done | CT-09/10/11 done |
| H | CT-H01, CT-H02, CT-H03, CT-H04 | done | CT-H01 / CT-H02 / CT-H03 / CT-H04 verify 完了 |

## CT 管理

| CT | Lane | 状態 | 依存 | 残 checkbox 数 | 実行した test / grep / migration | 未解決事項 |
| --- | --- | --- | --- | --- | --- | --- |
| CT-01 | A | done | なし | 0 | `mvn -f pom.server-modernized.xml -pl server-modernized -Dtest=TrustedProxyPolicyTest,TrustedRequestContextResolverTest,ServerConfigurationResolverTest,ServerConfigurationValidatorTest,AbstractResourceErrorResponseTest,CsrfProtectionFilterTest,SecurityHeadersFilterTest,LogoutResourceTest,LogFilterTest test` PASS; deprecated trusted-proxy key literal grep 0件; `rg -n 'shouldTrustForwardedHeaders\\(|isTrustedProxy\\(|parseForwarded\\(' ...` 0件 | なし |
| CT-02 | B | done | なし | 0 | `mvn -f pom.server-modernized.xml -pl server-modernized -Dtest=FreshSchemaBaselineTest,UserSecurityStateRepositoryTest,AuthSessionRegistryRepositoryTest,AuthoritativeAuditRepositoryTest,AuditOutboxRepositoryTest test` PASS; `rg -n 'runtime_state_store' server-modernized/src/main/java/open/dolphin/security server-modernized/src/test/java/open/dolphin/security` 0件; migration `V0306__security_session_audit_tables.sql` 追加 | `event_time desc limit 1` 残骸は既存 `AuditTrailService` に残存、CT-05 で解消 |
| CT-03 | F | done | CT-02 | 0 | `mvn -f pom.server-modernized.xml -pl server-modernized -Dtest=SessionAuthResourceTest,LogoutResourceTest,AdminOrcaConnectionResourceTest,AuthSessionRegistryFilterTest,AdminStepUpGuardTest test` PASS; `mvn -f pom.server-modernized.xml -pl server-modernized -Dtest=AdminConfigResourceTest,AdminMasterUpdateResourceTest,AdminOrcaUserResourceTest,AdminAccessResourceTest test` PASS; `rg -n 'verifyAdminTotp\\(|verifyAdminTotp\\b' server-modernized/src/main/java server-modernized/src/test/java` 0件; `rg -n 'AUTH_STEP_UP_SCOPE|AUTH_STEP_UP_VERIFIED_AT|AUTH_STEP_UP_EXPIRES_AT|SESSION_STEP_UP_OK|LOGIN_FACTOR2_REQUIRED|LOGIN_PASSWORD_OK|LOGIN_PASSWORD_BLOCKED|LOGIN_PASSWORD_FAIL|LOGIN_FACTOR2_OK|LOGIN_FACTOR2_FAIL|LOGIN_FACTOR2_EXPIRED|LOGOUT_OK|ADMIN_STEP_UP_BLOCKED|session_revoked|step_up_required' server-modernized/src/main/java server-modernized/src/test/java docs/development/phase2_current_coding_tasks_checklist_v1.md` 期待通り | なし |
| CT-04 | F | done | CT-03 | 0 | `mvn -f pom.server-modernized.xml -pl server-modernized -Dtest=SessionRevocationServiceTest,AdminAccessResourceTest,SessionAuthResourceTest test` PASS; `rg -n 'invalidateCurrentSession\\(' server-modernized/src/main/java server-modernized/src/test/java` 0件; `rg -n 'AdminAccessPasswordResetResource' server-modernized/src/main/java/open/dolphin/mbean/ServletStartup.java server-modernized/src/test/java/open/dolphin/rest/WebXmlEndpointExposureTest.java server-modernized/src/test/java/open/dolphin/rest/PublicRouteInventoryContractTest.java` 既存 unregistered evidence のみ | なし |
| CT-05 | F | done | CT-04 | 0 | `mvn -f pom.server-modernized.xml -pl server-modernized -Dtest=AuditTrailServiceTest,SessionAuditDispatcherTest,AuditHashServiceTest,AuditChainVerifierTest,AuditOutboxDispatcherTest test` PASS; `mvn -f pom.server-modernized.xml -pl server-modernized -Dtest=AuthoritativeAuditRepositoryTest,AuditOutboxRepositoryTest,AuditTrailServiceTest,SessionAuditDispatcherTest,AuditHashServiceTest,AuditChainVerifierTest,AuditOutboxDispatcherTest test` PASS; `rg -n 'event_time desc limit 1' server-modernized/src/main/java` 0件; `rg -n 'createProducer\\(\\)\\.send|publishToJms' server-modernized/src/main/java/open/dolphin/security/audit/SessionAuditDispatcher.java` 0件 | なし |
| CT-06 | A | done | CT-01 | 0 | `mvn -f pom.server-modernized.xml -pl server-modernized -Dtest=ServerConfigurationResolverTest,ServerConfigurationValidatorTest,DocumentIntegrityConfigTest,ServletStartupSecurityGuardTest,OrcaConnectionConfigStoreTest,DocumentIntegrityServiceTest test` PASS; `rg -n "fido2|Fido2|BackupCodeGenerator" server-modernized/src/main/java server-modernized/src/test/java server-modernized/config` 0件; `rg -n "AUDIT_TRUSTED_""PROXIES" .` 0件 | なし |
| CT-07 | C | done | なし | 0 | `mvn -f pom.server-modernized.xml -pl server-modernized -Dtest=RestOrcaTransportTest,OrcaTransportRegistryTest,OrcaWrapperServiceFailClosedTest,OrcaPatientSyncServiceTest,ReceptionPushHandlerTest,MedicalPushHandlerTest,AdminOrcaConnectionResourceTest,OrcaVisitResourceTest,OrcaChartSupportResourceTest,OrcaReportDocumentResourceTest test` PASS; `mvn -f pom.server-modernized.xml -pl server-modernized -Dtest=OrcaLocalMedicalOutpatientResourceTest,OrcaDiseaseResourceTest,RestOrcaTransportTest,OrcaTransportRegistryTest,OrcaPatientSyncServiceTest,ReceptionPushHandlerTest,MedicalPushHandlerTest,AdminOrcaConnectionResourceTest,OrcaVisitResourceTest,OrcaChartSupportResourceTest,OrcaReportDocumentResourceTest test` PASS; `rg -n 'resolve\\(null\\)|reloadSettings\\(null\\)|invoke\\(null' server-modernized/src/main/java/open/dolphin/orca server-modernized/src/main/java/open/dolphin/rest` 0件; `rg -n 'SessionTraceManager|MDC' server-modernized/src/main/java/open/dolphin/orca server-modernized/src/main/java/open/dolphin/rest/orca` 0件; `rg -n 'OrcaWrapperService' server-modernized/src/main/java server-modernized/src/test/java` 0件 | public route は温存、local projection service へ切出し済み |
| CT-08 | D | done | なし | 0 | `mvn -f pom.server-modernized.xml -pl server-modernized -Dtest=FreshSchemaBaselineTest test` PASS; `mvn -f pom.server-modernized.xml -pl server-modernized -Dtest=FreshSchemaBaselineTest,OrcaSyncRunStoreTest,OrcaPushEventInboxStoreTest test` PASS; `mvn -f pom.server-modernized.xml -pl server-modernized -Dtest=FreshSchemaBaselineTest,EncounterProjectionRepositoryTest,OrcaSyncRunStoreTest,OrcaPushEventInboxStoreTest test` PASS; migration `V0307__schedule_encounter_runtime_tables.sql` 追加 | 旧 runtime_state_store / seen-event 実装は残存するが CT-08 では新規 generic state store を追加していない |
| CT-09 | G | done | CT-08 | 0 | `mvn -f pom.server-modernized.xml -pl server-modernized -Dtest=OrcaPatientSyncPlannerTest,OrcaPatientSyncRunnerTest,OrcaPatientSyncServiceTest test` PASS; `mvn -f pom.server-modernized.xml -pl server-modernized -Dtest=OrcaPatientSyncPlannerTest,OrcaPatientSyncRunnerTest,OrcaPatientSyncServiceTest,OrcaPatientSyncResourceTest test` PASS; `mvn -f pom.server-modernized.xml -pl server-modernized -Dtest=FreshSchemaBaselineTest test` PASS; `rg -n "ORCA_PATIENT_SYNC_FACILITY_ID|KEY_ORCA_PATIENT_SYNC_FACILITY_ID|orca\\.patient-sync\\.facility-id" server-modernized/src/main/java server-modernized/src/test/java server-modernized/config api-contract/src/main/java` 0件; `rg -n "OrcaSyncCursorStore|OrcaSyncRunStore|d_orca_sync_cursor|d_orca_sync_run" server-modernized/src/main/java server-modernized/src/test/java server-modernized/tools/flyway/sql` expected hits only | dead code として `OrcaPatientSyncStateStore` / `d_orca_patient_sync_state` は残存するが runtime path からは切離し済み |
| CT-10 | G | done | CT-09 | 0 | `mvn -f pom.server-modernized.xml -pl server-modernized -Dtest=ReceptionPushHandlerTest,MedicalPushHandlerTest test` PASS; `mvn -f pom.server-modernized.xml -pl server-modernized -Dtest=OrcaPushEventRouterTest,OrcaPushEventInboxStoreTest,OperationsReadinessResourceTest,OperationsHealthResourceTest test` PASS; `rg -n "OrcaPushStateStore|OrcaPushSeenEventStore|markSeen\\(|last_event_" server-modernized/src/main/java server-modernized/src/test/java` 0件 | legacy migration `V0305__orca_push_runtime_tables.sql` には旧 `d_orca_push_state` 列定義が残るが runtime path からは切離し済み |
| CT-11 | G | done | CT-10 | 0 | `mvn -f pom.server-modernized.xml -pl server-modernized -Dtest=AdminOrcaUserLinkResourceTest test` PASS; `mvn -f pom.server-modernized.xml -pl server-modernized -Dtest=AdminOrcaUserLinkResourceTest,FreshSchemaBaselineTest test` PASS; `rg -n "findLinkByUserPk\\([^,)]*\\)|findLinksByUserPks\\([^,)]*\\)|findOwnerByOrcaUserId\\([^,)]*\\)|findEhrUserPkByOrcaUserId\\([^,)]*\\)|deleteByEhrUserPk\\([^,)]*\\)|upsertLink\\([^,)]*\\)|deleteByOrcaUserIdAndFacilityPrefix|findLinksByFacilityPrefix" server-modernized/src/main/java server-modernized/src/test/java` 0件; migration `V0308__orca_user_link_facility_native.sql` 追加 | repository 実装は `OrcaUserLinkQueryService` に集約。`UserServiceBean` 自体は未変更 |
| CT-H01 | H | done | Lane E | 0 | `mvn -f pom.server-modernized.xml -pl server-modernized -Dtest=PublicRouteInventoryContractTest,WebXmlEndpointExposureTest test` PASS; public registration から `PVTResource` / `PatientModV2OutpatientResource` / `/karte/document/pvt/{*}` を除去 | なし |
| CT-H02 | H | done | Lane E | 0 | `mvn -f pom.server-modernized.xml -pl server-modernized -Dtest=PublicRouteInventoryContractTest,WebXmlEndpointExposureTest,EncounterResourceTest,SessionMessageHandlerTest,OrcaLocalMedicalOutpatientResourceTest,PVTServiceBeanAddPvtTest,PVTServiceBeanClinicalTest,ChartEventServiceBeanPvtStateEventTest test` PASS; `/api/schedules/{scheduleKey}` / `/api/encounters/{encounterKey}` 追加、`/api/pvt` public 削除、`PVTResource` / `PVTServiceBeanSupport` / `PVTResourceLimitTest` 削除、legacy patient/day merge と `pvtPk` mutation path を停止 | なし |
| CT-H03 | H | done | Lane E | 0 | `mvn -f pom.server-modernized.xml -pl server-modernized -Dtest=EncounterResourceTest,KarteResourceDocumentContractTest,KarteDocumentWriteResourceTest test` PASS; `/karte/document/pvt/{*}` 削除、encounter transition command 分離 | なし |
| CT-H04 | H | done | Lane E | 0 | `mvn -f pom.server-modernized.xml -pl server-modernized -Dtest=LocalDiagnosisResourceTest test` PASS; `npm --prefix web-client test -- diseaseApi` PASS; web-client `diseaseApi` / `DiagnosisEditPanel` / build まで cutover 実施 | なし |

## Discovery Deliverables

| Deliverable | Lane | 状態 | 備考 |
| --- | --- | --- | --- |
| `docs/development/a2_public_contract_freeze.md` | E | done | repo 内正本化 |
| `docs/development/hidden_consumer_inventory.md` | E | done | repo 内 evidence ベースで作成 |
| ORCA appointment / acceptance / billed field inventory | E | done | `docs/development/orca_boundary_field_inventory.md` |
| `PatientVisitModel` / PVT cache cutover inventory | E | done | `docs/development/pvt_cutover_inventory.md` |
| `pusheventgetv2` replay / cursor contract inventory | E | done | `docs/development/pushevent_replay_cursor_inventory.md` |

## 最終ゲート

| Gate | 状態 | 証跡 |
| --- | --- | --- |
| authoritative checklist 全 [x] | done | `rg -n '^- \\[ \\]' docs/development/phase2_current_coding_tasks_checklist_v1.md` 0件 |
| task-specific tests 全 green | done | CT ごとの task-specific test と CT-H 追加 contract test PASS |
| 最小回帰 green | done | 5.3 + CT-H cutover 回帰 PASS |
| grep gate clean | done | 5.2 の exact grep command 全件 0 hit |
| generated artifact 差分なし | done | `git status --short` に generated artifact 差分なし |
| docs / env sample / migration / tests 同期 | done | checklist / board / inventory / PR note / env sample / flyway / tests 同期済み |

# SA-04 — transport observability / sanitize prompt

```text
あなたは OpenDolphinNext の transport-observability-and-sanitize-net subagent です。

目的:
R-OBS-01 と T-NEG-01 を閉じる。
C1/C2 core は already closed なので reopen せず、
observability truthfulness と sanitize negative test lock を仕上げる。

参照してよいもの:
- current repo server source / tests / contracts
- docs/implementation/opendolphin-dynamic-trial-static-remediation-package-20260418/
- docs/implementation/opendolphin-static-fix-package-20260418/
- 外部サイト、一般論は禁止

fixed premises:
- facility fail-close は崩さない
- sanitize core behavior は弱めない
- live mTLS / WebORCA 接続確認はしない
- backward compatibility 不要
- build artifacts 無視

主要タスク:
1. actual client-auth state が
   - config store
   - transport registry
   - settings
   - readiness / audit summary
   にどう流れるかを追跡し、
   `clientAuthConfigured` が truth を返すようにする
2. その修正が fail-close routing や readiness reason code を壊さないことを test で守る
3. sanitize negative tests を強化する
   - rendered log
   - admin response / details map
   - readiness detail
   に raw host/baseUrl/userinfo/pathPrefix などが出ないことを直接 pin する
4. current test helper が message template しか見ていないなら、
   rendered surface まで見える形にする

acceptance:
- clientAuthConfigured が actual config truth を反映する
- facility fail-close は不変
- sanitize negative tests が rendered surfaces を直接 lock する
- raw target material の再露出が test で捕まる

required tests:
- mvn -f pom.server-modernized.xml -pl server-modernized -am -Dtest=OrcaConnectionConfigStoreTest,OrcaTransportRegistryTest,RestOrcaTransportTest,OperationsHealthResourceTest,OrcaTransportSettingsExternalConfigTest,OrcaGatewayExceptionMapperTest,AdminOrcaConnectionTestSupportTest,OrcaHttpClientLogTest test

report format:
- summary
- client_auth_truth_path_before_after
- changed_files
- sanitize_surfaces_locked
- tests_run
- residual_risks
```

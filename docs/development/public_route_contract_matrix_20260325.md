# Public Route Contract Matrix

作成日: 2026-03-26  
RUN_ID: 20260325T233045Z  
authority HEAD: `b4eccfcd199283230806f3a0f43bf20e37a4940b`

## 根拠

- `server-modernized/src/main/java/open/dolphin/rest/OpenDolphinRestApplication.java`
- `server-modernized/src/test/java/open/dolphin/rest/PublicRouteInventoryContractTest.java`
- `server-modernized/src/test/java/open/dolphin/rest/WebXmlEndpointExposureTest.java`
- `server-modernized/src/main/java/open/dolphin/rest/ScheduleResource.java`
- `server-modernized/src/main/java/open/dolphin/rest/EncounterResource.java`
- `server-modernized/src/main/java/open/dolphin/rest/OperationsHealthResource.java`
- `server-modernized/src/main/java/open/dolphin/rest/AdminAccessResource.java`
- `web-client/src/features/administration/api.ts`
- `web-client/src/features/administration/accessManagementApi.ts`
- `web-client/src/features/outpatient/orcaQueueApi.ts`
- `web-client/src/features/charts/encounterContext.ts`

## Classification Matrix

| client surface | server truth | classification | decision |
|---|---|---|---|
| `GET /api/health` | `OperationsHealthResource` に public 登録あり | keep as-is | 維持 |
| `GET /api/operations/readiness` | `OperationsReadinessResource` class は存在するが `OpenDolphinRestApplication` 未登録 | blocked and intentionally unavailable | public route としては扱わない |
| `GET /api/health/readiness` | `OperationsHealthResource#readiness()` が public 登録済み | keep as-is | client はこの path を正本として sanitized `checks` payload を利用 |
| `POST /api/admin/access/users/{userPk}/password-reset` | `AdminAccessPasswordResetResource` は class 存在のみ。`OpenDolphinRestApplication` 未登録、contract test でも blocked | fail-closed | web-client から network call しない。UI からも実行不可 |
| `GET /api/orca/queue` | public 未登録。server code truth に route なし | fail-closed | web-client は 410 unavailable を即時返し、network call しない |
| `GET /api/orca/queue?patientId=...&retry=1` | public 未登録 | fail-closed | 再送 UI は availability false 扱い |
| `DELETE /api/orca/queue?patientId=...` | public 未登録 | fail-closed | 破棄 UI は availability false 扱い |
| `POST /api/orca/pusheventgetv2` | public 未登録。downstream ORCA path `/api01rv2/pusheventgetv2` は upstream transport であり public surface ではない | fail-closed | web-client は 410 unavailable を即時返し、network call しない |
| `GET /api/schedules/{scheduleKey}` | `ScheduleResource` で public 登録あり | keep as-is | schedule projection read の正本 |
| `GET /api/encounters/{encounterKey}` | `EncounterResource` で public 登録あり | keep as-is | encounter projection read の正本 |
| `POST /api/encounters/{encounterKey}/transitions` | `EncounterResource` で public 登録あり | keep as-is | transition write の正本 |
| `POST /api/orca/medical/outpatient` | `PublicRouteInventoryContractTest` blocked | blocked and intentionally unavailable | 復活禁止 |
| `GET /api/orca/deptinfo` | `PublicRouteInventoryContractTest` blocked | blocked and intentionally unavailable | 復活禁止 |
| `POST /api/orca/local-medical/outpatient` | `PublicRouteInventoryContractTest` blocked | blocked and intentionally unavailable | 復活禁止 |

## Authoritative Decisions

- readiness details の current public 正本は `GET /api/health/readiness`。
- `GET /api/operations/readiness` は class 存在のみで未登録のため current public REST に含めない。
- `password-reset` は current public REST に含めない。session revoke 実装済みでも、再公開判断は別 task で `OpenDolphinRestApplication` と contract test の両方を更新して行う。
- `orca/queue` と `pusheventgetv2` は current public REST に含めない。upstream/downstream ORCA path を web-client public route へ流用しない。
- Reception -> Charts handoff は今回 `appointmentId / receptionId / visitDate` の volatile carryover を維持するが、次 task の authoritative target は `scheduleKey` / `encounterKey` contract である。

## Next Task Handoff

- `OutpatientEncounterContext` はまだ `scheduleKey` / `encounterKey` を持たない。次 task では `web-client` 側の optional 受け皿追加から始める。
- `finish` / `bill` / `chart_opened` など operation mapping は今回固定しない。`POST /api/encounters/{encounterKey}/transitions` を authoritative write target とする点だけ確定。
- `queue` / `push-event` が必要なら、別 task で server 側 public registration・authz・sanitized contract・tests を揃えてから client を再接続する。

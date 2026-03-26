# scheduleKey / encounterKey feed contract memo

作成日: 2026-03-26  
RUN_ID: `20260326T005423Z`

## 目的

task 6 の対象である Reception → Charts handoff について、server が供給する canonical key を source truth として固定し、client が key を自前生成しない前提を明文化する。

## Source truth

- [server-modernized/src/main/java/open/dolphin/rest/ScheduleResource.java](/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient/server-modernized/src/main/java/open/dolphin/rest/ScheduleResource.java)
- [server-modernized/src/main/java/open/dolphin/rest/EncounterResource.java](/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient/server-modernized/src/main/java/open/dolphin/rest/EncounterResource.java)
- [server-modernized/src/main/java/open/dolphin/encounter/ScheduleProjectionRepository.java](/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient/server-modernized/src/main/java/open/dolphin/encounter/ScheduleProjectionRepository.java)
- [server-modernized/src/main/java/open/dolphin/encounter/EncounterProjectionRepository.java](/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient/server-modernized/src/main/java/open/dolphin/encounter/EncounterProjectionRepository.java)
- [server-modernized/src/test/java/open/dolphin/rest/ScheduleResourceTest.java](/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient/server-modernized/src/test/java/open/dolphin/rest/ScheduleResourceTest.java)
- [server-modernized/src/test/java/open/dolphin/rest/EncounterResourceTest.java](/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient/server-modernized/src/test/java/open/dolphin/rest/EncounterResourceTest.java)
- [server-modernized/src/test/java/open/dolphin/encounter/EncounterProjectionRepositoryTest.java](/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient/server-modernized/src/test/java/open/dolphin/encounter/EncounterProjectionRepositoryTest.java)

## 確定した contract

- schedule payload は常に `scheduleKey` を返す。
- encounter が紐づく schedule row は `encounterKey` も返す。
- encounter payload は常に `encounterKey` と `scheduleKey` を返す。
- key は server が `facilityId` ベースの durable id から供給する。
- client は key builder / resolver を持たず、受け取った key をそのまま pass-through で保持する。
- `appointmentId` / `receptionId` / `visitDate` は権威 identity ではなく、volatile carryover の補助情報に留める。

## 実装済みの client 経路

- [web-client/src/features/charts/encounterContext.ts](/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient/web-client/src/features/charts/encounterContext.ts)
- [web-client/src/routes/useAppNavigation.ts](/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient/web-client/src/routes/useAppNavigation.ts)
- [web-client/src/AppRouter.tsx](/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient/web-client/src/AppRouter.tsx)
- [web-client/src/features/reception/pages/ReceptionPage.tsx](/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient/web-client/src/features/reception/pages/ReceptionPage.tsx)
- [web-client/src/features/charts/pages/ChartsPage.tsx](/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient/web-client/src/features/charts/pages/ChartsPage.tsx)
- [web-client/src/features/reception/components/ReceptionExceptionList.tsx](/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient/web-client/src/features/reception/components/ReceptionExceptionList.tsx)
- [web-client/src/features/workspaceTabs/WorkspaceTabBar.tsx](/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient/web-client/src/features/workspaceTabs/WorkspaceTabBar.tsx)

上記の経路で `scheduleKey` / `encounterKey` は pass-through で保持される。`appointmentId` / `receptionId` / `visitDate` は補助情報のままで、キー生成の責務は持たない。`ChartsPage` の query 起動条件は canonical key ありに限定し、Reception 側の openCharts / Charts 側の tab select は key 無しでは fail-closed になる。

## 関連テスト

- `CanonicalEncounterKeysTest`
- `ScheduleResourceTest`
- `EncounterResourceTest`
- `EncounterProjectionRepositoryTest`
- `encounterContext.test.ts`
- `useAppNavigation.test.tsx`
- `ReceptionPage.test.tsx`
- `PublicRouteInventoryContractTest`
- `WebXmlEndpointExposureTest`

## 検証結果

- `mvn -f pom.server-modernized.xml -pl server-modernized -am -Dtest=CanonicalEncounterKeysTest,ScheduleResourceTest,EncounterResourceTest,EncounterProjectionRepositoryTest,PublicRouteInventoryContractTest,WebXmlEndpointExposureTest -Dsurefire.failIfNoSpecifiedTests=false test` PASS
- `npm -C web-client run typecheck` PASS
- `npm -C web-client run test -- --run src/features/charts/__tests__/encounterContext.test.ts src/routes/__tests__/useAppNavigation.test.tsx src/__tests__/AppRouter.charts-query-scrub.test.tsx src/features/reception/__tests__/ReceptionPage.test.tsx` PASS

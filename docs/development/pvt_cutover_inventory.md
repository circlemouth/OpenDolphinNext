# PatientVisitModel And PVT Cache Cutover Inventory

作成日: 2026-03-24  
RUN_ID: 20260324T115338Z

## Direct In-Repo Dependencies

- `server-modernized/src/main/java/open/dolphin/session/PVTServiceBean.java`
- `server-modernized/src/main/java/open/dolphin/session/PVTServiceBeanSupport.java`
- `server-modernized/src/main/java/open/dolphin/session/PatientServiceBeanSupport.java`
- `server-modernized/src/main/java/open/dolphin/session/KarteServiceBean.java`
- `server-modernized/src/main/java/open/dolphin/session/KarteDetailAssemblySupport.java`
- `server-modernized/src/main/java/open/dolphin/session/SystemServiceBean.java`
- `server-modernized/src/main/java/open/dolphin/session/SessionMessageHandler.java`

## Functional Uses

- 受付登録
- 当日来院 merge
- scheduled visit registration
- chart event 通知
- karte detail assembly の最新 visit 参照
- system dashboard の facility 集計
- legacy facility lookup

## Cutover Risks

- `patient + day` / `patient + pvtDate` identity が schedule / encounter key の canonical rule と衝突する
- `contextHolder.getPvtList(fid)` ベースの cache merge は encounter projection へ置換が必要
- `PatientVisitModel.BIT_CANCEL` 依存は public business state と一致しない

## Required Successor Model

- schedule projection
- encounter projection
- explicit `scheduleKey`
- explicit `encounterKey`
- business state `scheduled / checked_in / chart_opened / billed / cancelled`

## Inventory Conclusion

- CT-H02 完了後、public route は `scheduleKey` / `encounterKey` projection へ切り替えた。
- `PVTServiceBean` は `patientId + 日付` / `patientId + pvtDate` merge を廃止し、legacy visit timestamp を canonical identity として扱わない。
- `ChartEventServiceBean` は legacy `pvtPk` mutation event を cutover 後に reject し、local generated visit key を canonical mutation key にしない。

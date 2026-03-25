# ORCA Boundary Field Inventory

作成日: 2026-03-24  
RUN_ID: 20260324T115338Z

## Appointment

authoritative upstream field:
- `Appointment_Id`

repo evidence:
- `server-modernized/src/main/java/open/dolphin/orca/service/OrcaWrapperServiceMutationSupport.java`
- `server-modernized/src/main/java/open/dolphin/orca/converter/OrcaXmlMapper.java`
- `server-modernized/src/test/resources/orca/stub/02_appointmodv2_response.sample.xml`
- `server-modernized/src/test/resources/orca/stub/06_appointlstv2_response.sample.xml`
- `server-modernized/src/test/resources/orca/stub/15_appointlst2v2_response.sample.xml`
- `docs/server-modernization/phase2/operations/assets/orca-api-spec/raw/appointmod.md`
- `docs/server-modernization/phase2/operations/assets/orca-api-spec/raw/appointlst2.md`

freeze:
- `scheduleKey = facilityId + ":" + orcaAppointmentId`
- `orcaAppointmentId` の source field は `Appointment_Id`

## Acceptance

authoritative upstream field:
- `Acceptance_Id`

repo evidence:
- `server-modernized/src/main/java/open/dolphin/orca/service/OrcaWrapperServiceMutationSupport.java`
- `server-modernized/src/main/java/open/dolphin/orca/converter/OrcaXmlMapper.java`
- `server-modernized/src/test/resources/orca/stub/04_acceptmodv2_response.sample.xml`
- `docs/server-modernization/phase2/operations/assets/orca-api-spec/raw/acceptancelst.md`

freeze:
- `encounterKey = facilityId + ":" + orcaAcceptanceId`
- `orcaAcceptanceId` の source field は `Acceptance_Id`

## Billed

repo evidence:
- `docs/development/supporting/phase2a_handoff_docs_bundle/phase2a_a1_contract_freeze_pack_v1.md`
- `docs/development/supporting/phase2a_handoff_docs_bundle/phase2a_a1_handoff_ticket_seed.csv`
- `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaAppointmentResource.java`
- `server-modernized/src/main/java/open/dolphin/orca/service/OrcaWrapperService.java`

判定:
- repo 内には billed canonical source を単独 field で固定する証跡が不足している
- billing estimate endpoint はあるが billed transition canonical source の freeze evidence にはならない

結論:
- appointment / acceptance は upstream field が repo evidence で固定可能
- billed canonical source は inventory 上 unresolved とし、CT-09/CT-H02 の実装時に ORCA source/result を追加固定する

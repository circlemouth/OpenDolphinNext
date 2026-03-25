# Pushevent Replay Cursor Inventory

作成日: 2026-03-24  
RUN_ID: 20260324T115338Z

## Repo Evidence

- `server-modernized/src/main/java/open/dolphin/orca/transport/OrcaEndpoint.java`
- `web-client/src/features/outpatient/orcaQueueApi.ts`
- `docs/server-modernization/phase2/operations/assets/orca-api-spec/raw/pusheventget.md`
- `docs/server-modernization/phase2/notes/orca-api-field-validation.md`
- `docs/development/supporting/phase2a_handoff_docs_bundle/phase2a_a3_orca_boundary_design_report.md`

## Confirmed Request Contract

`pusheventgetv2req` fields:
- `event`
- `user`
- `start_time`
- `end_time`

source:
- `docs/server-modernization/phase2/operations/assets/orca-api-spec/raw/pusheventget.md`

## Replay / Cursor Finding

- repo 内 evidence では per-facility cursor 契約は未固定
- A3 report でも `pusheventgetv2 replay / cursor 契約が不明` を blocker としている
- current repo evidence は time-range polling 契約まで

## Operational Conclusion

- CT-10 実装前提として、repo 内正本で確定できるのは time window request contract のみ
- cursor truth model は repo 内未確定であり、実装では server-side durable cursor table を新設して local authoritative cursor に寄せる必要がある

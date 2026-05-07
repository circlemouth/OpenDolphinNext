# WebORCA Full Flow

- RUN_ID: 20260506T195951Z-TREAT2
- TRACE_ID: trace-20260506T195951Z-TREAT2
- 実施日時: 2026-05-06T20:17:15.521Z
- Base URL: http://localhost:5173
- Facility ID: 1.3.6.1.4.1.9414.72.103
- Patient ID: 00002
- Reception Row: found
- Medical Information Probe: 200
- Medical Information Gate: passed
- Medical Information Checked Requests: 1
- Accept Mutation: api_result_observed_unclassified
- Reception Active Entries: 1 / keyed 1
- Charts Handoff: ready
- Visit Row Readiness: ready
- Order Result: 200
- ORCA Send: 200
- Blocker: none

## Evidence

- Summary JSON: summary.json
- Blocker Summary: blocker-summary.json
- Handoff State: handoff-state.json
- Selected Visit Row: selected-visit-row.json
- Steps: steps.log
- Network: network/network.json
- Requests: network/requests.json
- Console: console.json
- Page errors: page-errors.json
- Request XML: request-xml/medicalmodv2.xml
- Screenshots: screenshots/

## Rerun

- QA_BASE_URL=http://localhost:5173 RUN_ID=20260506T195951Z-TREAT2 TRACE_ID=trace-20260506T195951Z-TREAT2 QA_PATIENT_ID=00002 node scripts/qa-fullflow-weborca.mjs

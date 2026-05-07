# WebORCA Full Flow

- RUN_ID: 20260506T195951Z-ALL8J
- TRACE_ID: trace-20260506T195951Z-ALL8J
- 実施日時: 2026-05-06T21:46:12.507Z
- Base URL: https://localhost:5173
- Facility ID: 1.3.6.1.4.1.9414.72.103
- Patient ID: 00006
- Reception Row: found
- Medical Information Probe: 200
- Medical Information Gate: passed
- Medical Information Checked Requests: 1
- Accept Mutation: api_result_observed_unclassified
- Reception Active Entries: 1 / keyed 1
- Charts Handoff: ready
- Visit Row Readiness: ready
- Order Result: 200
- Prescription Result: 200
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

- QA_BASE_URL=https://localhost:5173 RUN_ID=20260506T195951Z-ALL8J TRACE_ID=trace-20260506T195951Z-ALL8J QA_PATIENT_ID=00006 node scripts/qa-fullflow-weborca.mjs

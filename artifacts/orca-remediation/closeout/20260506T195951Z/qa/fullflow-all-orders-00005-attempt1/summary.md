# WebORCA Full Flow

- RUN_ID: 20260506T195951Z-ALL1
- TRACE_ID: trace-20260506T195951Z-ALL1
- 実施日時: 2026-05-06T20:27:05.044Z
- Base URL: http://localhost:5173
- Facility ID: 1.3.6.1.4.1.9414.72.103
- Patient ID: 00005
- Reception Row: unknown
- Medical Information Probe: —
- Medical Information Gate: failed
- Medical Information Checked Requests: 0
- Accept Mutation: unknown
- Reception Active Entries: unknown / keyed unknown
- Charts Handoff: error
- Visit Row Readiness: unknown
- Order Result: not-run
- ORCA Send: error
- Blocker: repo-defect
- Blocker Reason: target_mutation_request_missing_or_duplicate
- Fatal Error: TypeError: fetch failed

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

- QA_BASE_URL=http://localhost:5173 RUN_ID=20260506T195951Z-ALL1 TRACE_ID=trace-20260506T195951Z-ALL1 QA_PATIENT_ID=00005 node scripts/qa-fullflow-weborca.mjs

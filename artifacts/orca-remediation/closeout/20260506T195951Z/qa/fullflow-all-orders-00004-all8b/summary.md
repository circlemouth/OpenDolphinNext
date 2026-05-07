# WebORCA Full Flow

- RUN_ID: 20260506T195951Z-ALL8B
- TRACE_ID: trace-20260506T195951Z-ALL8B
- 実施日時: 2026-05-06T21:07:18.547Z
- Base URL: https://localhost:5173
- Facility ID: 1.3.6.1.4.1.9414.72.103
- Patient ID: 00004
- Reception Row: unknown
- Medical Information Probe: —
- Medical Information Gate: failed
- Medical Information Checked Requests: 0
- Accept Mutation: unknown
- Reception Active Entries: unknown / keyed unknown
- Charts Handoff: error
- Visit Row Readiness: unknown
- Order Result: not-run
- Prescription Result: unknown
- ORCA Send: error
- Blocker: repo-defect
- Blocker Reason: target_mutation_request_missing_or_duplicate
- Fatal Error: Error: patient search returned no selectable result for QA_PATIENT_ID=00004; set QA_PATIENT_ID to an ORCA-searchable patient in the current environment

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

- QA_BASE_URL=https://localhost:5173 RUN_ID=20260506T195951Z-ALL8B TRACE_ID=trace-20260506T195951Z-ALL8B QA_PATIENT_ID=00004 node scripts/qa-fullflow-weborca.mjs

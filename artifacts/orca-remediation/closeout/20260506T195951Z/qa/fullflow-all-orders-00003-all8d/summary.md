# WebORCA Full Flow

- RUN_ID: 20260506T195951Z-ALL8D
- TRACE_ID: trace-20260506T195951Z-ALL8D
- 実施日時: 2026-05-06T21:16:44.372Z
- Base URL: https://localhost:5173
- Facility ID: 1.3.6.1.4.1.9414.72.103
- Patient ID: 00003
- Reception Row: not-run-existing-acceptance-handoff
- Medical Information Probe: 200
- Medical Information Gate: passed
- Medical Information Checked Requests: 0
- Accept Mutation: not_run_existing_acceptance_handoff
- Reception Active Entries: 1 / keyed 1
- Charts Handoff: ready
- Visit Row Readiness: ready
- Order Result: error
- Prescription Result: 200
- ORCA Send: 200
- Blocker: orca-business-rejected
- Blocker Reason: orca_business_rejected:80

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

- QA_BASE_URL=https://localhost:5173 RUN_ID=20260506T195951Z-ALL8D TRACE_ID=trace-20260506T195951Z-ALL8D QA_PATIENT_ID=00003 node scripts/qa-fullflow-weborca.mjs

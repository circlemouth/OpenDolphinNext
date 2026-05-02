# WebORCA Full Flow

- RUN_ID: 20260502T132134Z
- TRACE_ID: trace-20260502T132134Z
- 実施日時: 2026-05-02T14:52:56.860Z
- Base URL: http://localhost:5173
- Facility ID: 1.3.6.1.4.1.9414.72.103
- Patient ID: 00005
- Reception Row: found
- Medical Information Probe: 200
- Medical Information Gate: passed
- Medical Information Checked Requests: 1
- Accept Mutation: business_rejected_duplicate_acceptance
- Reception Active Entries: 0 / keyed 0
- Charts Handoff: ready
- Visit Row Readiness: missing_official_visit_identifiers
- Order Result: 200
- ORCA Send: no-response
- Blocker: official-visit-row-blocker
- Blocker Reason: visit_row_official_identifiers_missing

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

- QA_BASE_URL=http://localhost:5173 RUN_ID=20260502T132134Z TRACE_ID=trace-20260502T132134Z QA_PATIENT_ID=00005 node scripts/qa-fullflow-weborca.mjs

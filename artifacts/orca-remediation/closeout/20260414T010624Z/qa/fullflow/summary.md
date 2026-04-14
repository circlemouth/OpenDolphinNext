# WebORCA Full Flow

- RUN_ID: 20260414T010624Z
- TRACE_ID: trace-20260414T010624Z
- 実施日時: 2026-04-14T01:45:31.687Z
- Base URL: https://127.0.0.1:5173
- Facility ID: 1.3.6.1.4.1.9414.72.103
- Patient ID: 01423
- Reception Row: unknown
- Medical Information Probe: —
- Charts Handoff: error
- Visit Row Readiness: unknown
- Order Result: not-run
- ORCA Send: error
- Blocker: test-data-blocker
- Blocker Reason: fatal_before_send
- Fatal Error: Error: canonical charts handoff did not become available after accept: TimeoutError: page.waitForFunction: Timeout 30000ms exceeded.

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

- QA_BASE_URL=https://127.0.0.1:5173 RUN_ID=20260414T010624Z TRACE_ID=trace-20260414T010624Z QA_PATIENT_ID=01423 node scripts/qa-fullflow-weborca.mjs

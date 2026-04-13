# WebORCA Full Flow

- RUN_ID: 20260413T104000Z
- TRACE_ID: trace-20260413T104000Z
- 実施日時: 2026-04-13T11:14:28.052Z
- Base URL: https://localhost:5173
- Facility ID: 1.3.6.1.4.1.9414.72.103
- Patient ID: 01415
- Reception Row: unknown
- Charts Handoff: error
- Order Result: not-run
- ORCA Send: error
- Blocker: test-data-blocker
- Fatal Error: Error: canonical charts handoff did not become available after accept: TimeoutError: page.waitForFunction: Timeout 30000ms exceeded.

## Evidence

- Summary JSON: summary.json
- Steps: steps.log
- Network: network/network.json
- Requests: network/requests.json
- Console: console.json
- Page errors: page-errors.json
- Request XML: request-xml/medicalmodv2.xml
- Screenshots: screenshots/

## Rerun

- QA_BASE_URL=https://localhost:5173 RUN_ID=20260413T104000Z TRACE_ID=trace-20260413T104000Z QA_PATIENT_ID=01415 node scripts/qa-fullflow-weborca.mjs

# WebORCA Full Flow

- RUN_ID: 20260413T104000Z
- TRACE_ID: trace-20260413T104000Z-00002
- 実施日時: 2026-04-13T11:33:39.166Z
- Base URL: https://127.0.0.1:5173
- Facility ID: 1.3.6.1.4.1.9414.72.103
- Patient ID: 00002
- Reception Row: unknown
- Charts Handoff: error
- Order Result: not-run
- ORCA Send: error
- Blocker: test-data-blocker
- Fatal Error: Error: locator.waitFor: Target page, context or browser has been closed

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

- QA_BASE_URL=https://127.0.0.1:5173 RUN_ID=20260413T104000Z TRACE_ID=trace-20260413T104000Z-00002 QA_PATIENT_ID=00002 node scripts/qa-fullflow-weborca.mjs

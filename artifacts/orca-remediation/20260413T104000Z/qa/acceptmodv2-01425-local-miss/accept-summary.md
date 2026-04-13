# Reception 既存患者受付（acceptmodv2）

- RUN_ID: 20260413T104000Z
- 実施日時: 2026-04-13T11:17:27.706Z
- Base URL: https://localhost:5173
- Facility ID: 1.3.6.1.4.1.9414.72.103
- Session Role: admin
- 患者ID: 01425
- 診療科: 01
- 担当医: 10001
- 保険/自費: insurance
- 来院区分: 1
- Blocker: test-data-blocker
- Fatal Error: Error: patient search returned no selectable result for QA_PATIENT_ID=01425; set QA_PATIENT_ID to an ORCA-searchable patient in the current environment

## 送信結果

- Tone: —
- —
- —
- XHR Debug: —

## Evidence

- Network: network/network.json
- Requests: network/requests.json
- Console: console.json
- Page errors: page-errors.json
- Steps: steps.log

## HAR

- なし

## Rerun

- QA_BASE_URL=https://localhost:5173 RUN_ID=20260413T104000Z QA_PATIENT_ID=01425 node scripts/qa-acceptmodv2-weborca.mjs

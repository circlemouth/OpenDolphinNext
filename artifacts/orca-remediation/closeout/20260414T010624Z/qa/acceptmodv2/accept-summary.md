# Reception 既存患者受付（acceptmodv2）

- RUN_ID: 20260414T010624Z
- 実施日時: 2026-04-14T01:49:23.866Z
- Base URL: https://127.0.0.1:5173
- Facility ID: 1.3.6.1.4.1.9414.72.103
- Session Role: admin
- 患者ID: 01424
- 診療科: 01
- 担当医: 10001
- 保険/自費: insurance
- 来院区分: 1
- Medical Information Probe: 200
- Blocker: test-data-blocker

## 送信結果

- Tone: 
- API Result Code: 16
- API Result Message: 診療科・保険組合せで受付登録済みです。二重登録疑い
- Acceptance ID: —
- Encounter Key: —
- Schedule Key: —
- 
- 
- XHR Debug: 

## Evidence

- Network: network/network.json
- Requests: network/requests.json
- Console: console.json
- Page errors: page-errors.json
- Steps: steps.log

## HAR

- なし

## Rerun

- QA_BASE_URL=https://127.0.0.1:5173 RUN_ID=20260414T010624Z QA_PATIENT_ID=01424 node scripts/qa-acceptmodv2-weborca.mjs

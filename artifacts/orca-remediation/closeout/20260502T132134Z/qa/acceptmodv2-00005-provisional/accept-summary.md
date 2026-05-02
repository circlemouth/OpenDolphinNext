# Reception 既存患者受付（acceptmodv2）

- RUN_ID: 20260502T132134Z
- 実施日時: 2026-05-02T15:18:08.739Z
- Base URL: /
- Facility ID: 1.3.6.1.4.1.9414.72.103
- Session Role: admin
- 患者ID: 00005
- 診療科: 01
- 担当医: 10001
- 保険/自費: insurance
- 来院区分: 1
- Preflight Gate: failed
- Option Injection Mode: live
- Accepted Live Evidence: false
- Medical Information Probe: —
- Medical Information Gate: failed
- Medical Information Checked Requests: 0
- Blocker: candidate_discovery_only
- Fatal Error: candidate discovery output is only a proposal and cannot authorize Phase 3 mutation

## 送信結果

- Tone: —
- API Result Code: —
- API Result Message: —
- Acceptance ID: —
- Encounter Key: —
- Schedule Key: —
- Business Status: —
- Business Reason: —
- Registration Evidence: no
- —
- —
- XHR Debug: —

## Evidence

- Sanitized summary: accept-summary.sanitized.json
- Steps: steps.log
- Network: network/network.json
- Requests: network/requests.json
- Console: console.json
- Page errors: page-errors.json

## HAR

- なし

## Rerun

- QA_BASE_URL=http://localhost:5173 RUN_ID=20260502T132134Z QA_PATIENT_ID=00005 node scripts/qa-acceptmodv2-weborca.mjs

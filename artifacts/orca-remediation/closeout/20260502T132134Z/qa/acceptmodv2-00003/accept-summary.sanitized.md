# Reception 既存患者受付（acceptmodv2）

- RUN_ID: 20260502T132134Z
- 実施日時: 2026-05-02T14:05:43.687Z
- Base URL: /
- Facility ID: 1.3.6.1.4.1.9414.72.103
- Session Role: admin
- 患者ID: 00003
- 診療科: 01
- 担当医: 10001
- 保険/自費: insurance
- 来院区分: 1
- Preflight Gate: passed
- Option Injection Mode: live
- Accepted Live Evidence: true
- Medical Information Probe: 200
- Medical Information Gate: passed
- Medical Information Checked Requests: 1
- Blocker: environment-blocker

## 送信結果

- Tone: 
- API Result Code: —
- API Result Message: —
- Acceptance ID: —
- Encounter Key: —
- Schedule Key: —
- Business Status: businessRejected
- Business Reason: transport_error
- Registration Evidence: no
- 
- 
- XHR Debug: 

## Evidence

- Sanitized summary: accept-summary.sanitized.json
- Steps: steps.log
- Raw/browser/network artifacts: disabled by approved Phase 3 sanitized-evidence-only mode

## HAR

- なし

## Rerun

- QA_BASE_URL=http://localhost:5173 RUN_ID=20260502T132134Z QA_PATIENT_ID=00003 node scripts/qa-acceptmodv2-weborca.mjs

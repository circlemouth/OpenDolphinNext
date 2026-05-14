# Reception 既存患者受付（acceptmodv2）

- RUN_ID: 20260514T020603Z
- 実施日時: 2026-05-14T02:08:34.544Z
- Base URL: /
- Facility ID: 1.3.6.1.4.1.9414.72.103
- Session Role: admin
- 患者ID: 00001
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
- Blocker: none

## 送信結果

- Tone: 
- API Result Code: K3
- API Result Message: 受付登録終了
- Acceptance ID: 00001
- Encounter Key: 1.3.6.1.4.1.9414.72.103:00001
- Schedule Key: —
- Business Status: businessAcceptedWithWarnings
- Business Reason: official_warning_with_registration_evidence
- Registration Evidence: yes
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

- QA_BASE_URL=http://127.0.0.1:5173 RUN_ID=20260514T020603Z QA_PATIENT_ID=00001 node scripts/qa-acceptmodv2-weborca.mjs

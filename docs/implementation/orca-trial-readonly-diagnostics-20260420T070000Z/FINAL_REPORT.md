# ORCA Trial Phase 2.5 Read-only Diagnostics Final Report

RUN_ID: `20260420T070000Z`

- branch: `codex/orca-phase2_5-readonly-diagnostics-main-20260420`
- source_commit: `4e788dd34aa3cf67f041e1f67ddb2edcf62094b3`
- source commit matches artifact summary: yes
- bootstrap: not_run_existing_environment_reused
- server health: OK HTTP 200
- Vite: OK HTTP 200
- login /api/session/me: 200
- read-only discovery: exit 1 expected stop because acceptedCandidateCount=0
- acceptedCandidateCount: 0/11
- exact selected-candidate preflight: not_run_no_accepted_candidate
- Phase 3: not_run
- Phase 4: not_run
- fullflow/mutation: not_run / not_run

| patient | accepted | reason | official | insurance | appointment | local | selector | med-info failed |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 00001 | no | business_rejected_insurance | 200/accepted | 200/business_rejected_insurance | 200/business_rejected_appointment/direct_acceptance | accepted:none count=1 exact=1 | accepted:none | none |
| 00002 | no | medical_information_not_ready | 200/accepted | 200/business_rejected_insurance | 200/business_rejected_appointment/direct_acceptance | rejected:local_exact_match_missing count=1 exact=0 | not_verified:local_exact_match_missing | department_ready,physician_ready,payment_ready,visitKind_ready,medicalInformation_input_ready,required_identity_fields_match |
| 00003 | no | medical_information_not_ready | 200/accepted | 200/business_rejected_insurance | 200/business_rejected_appointment/direct_acceptance | rejected:local_exact_match_missing count=1 exact=0 | not_verified:local_exact_match_missing | department_ready,physician_ready,payment_ready,visitKind_ready,medicalInformation_input_ready,required_identity_fields_match |
| 00004 | no | medical_information_not_ready | 200/accepted | 200/business_rejected_insurance | 200/business_rejected_appointment/direct_acceptance | rejected:local_exact_match_missing count=1 exact=0 | not_verified:local_exact_match_missing | department_ready,physician_ready,payment_ready,visitKind_ready,medicalInformation_input_ready,required_identity_fields_match |
| 00005 | no | business_rejected_insurance | 200/accepted | 200/business_rejected_insurance | 200/business_rejected_appointment/direct_acceptance | accepted:none count=1 exact=1 | accepted:none | none |
| 00006 | no | medical_information_not_ready | 200/accepted | 200/business_rejected_insurance | 200/business_rejected_appointment/direct_acceptance | rejected:local_exact_match_missing count=1 exact=0 | not_verified:local_exact_match_missing | department_ready,physician_ready,payment_ready,visitKind_ready,medicalInformation_input_ready,required_identity_fields_match |
| 00007 | no | medical_information_not_ready | 200/accepted | 200/business_rejected_insurance | 200/business_rejected_appointment/direct_acceptance | rejected:local_exact_match_missing count=0 exact=0 | not_verified:local_exact_match_missing | department_ready,physician_ready,payment_ready,visitKind_ready,medicalInformation_input_ready,required_identity_fields_match |
| 00008 | no | medical_information_not_ready | 200/accepted | 200/business_rejected_insurance | 200/business_rejected_appointment/direct_acceptance | rejected:local_exact_match_missing count=0 exact=0 | not_verified:local_exact_match_missing | department_ready,physician_ready,payment_ready,visitKind_ready,medicalInformation_input_ready,required_identity_fields_match |
| 00009 | no | medical_information_not_ready | 200/accepted | 200/business_rejected_insurance | 200/business_rejected_appointment/direct_acceptance | rejected:local_exact_match_missing count=1 exact=0 | not_verified:local_exact_match_missing | department_ready,physician_ready,payment_ready,visitKind_ready,medicalInformation_input_ready,required_identity_fields_match |
| 00010 | no | medical_information_not_ready | 200/accepted | 200/business_rejected_insurance | 200/business_rejected_appointment/direct_acceptance | rejected:local_exact_match_missing count=1 exact=0 | not_verified:local_exact_match_missing | department_ready,physician_ready,payment_ready,visitKind_ready,medicalInformation_input_ready,required_identity_fields_match |
| 00011 | no | medical_information_not_ready | 200/accepted | 200/business_rejected_insurance | 200/business_rejected_appointment/direct_acceptance | rejected:local_exact_match_missing count=1 exact=0 | not_verified:local_exact_match_missing | department_ready,physician_ready,payment_ready,visitKind_ready,medicalInformation_input_ready,required_identity_fields_match |

## Root Classifications

- official patientget prior 500: local encrypted credential state mismatch in saved ORCA connection config; after runtime re-encryption for WebORCA Trial, 00001-00011 are HTTP 200 / apiResult all-zero / Patient_Information present / exact Patient_ID accepted.
- insurance prior 403: QA harness direct POST omitted same-origin CSRF request headers; after fix, local status is 200 and ORCA business result is non-zero (E91), classified as business_rejected_insurance, not missing and not accepted.
- appointment prior 403: QA harness direct POST omitted same-origin CSRF request headers; after fix, local status is 200 and ORCA business result is non-zero (91), classified as business_rejected_appointment with flowMode=direct_acceptance.
- selector/local/medical_information: 00001 and 00005 local/selectors/medical information are ready but blocked by insurance/appointment business rejection. 00002-00004 and 00006-00011 remain local_exact_match_missing, selector not_verified, and medical information identity subdimensions not ready.

No Phase 3, Phase 4, fullflow, or mutation attempt was run. No raw ORCA body, raw patient detail, raw insurance detail, HAR, trace, video, raw screenshot, raw network dump, credential, cookie, Authorization header, JSESSIONID, CSRF token value, raw session, or raw password is included.

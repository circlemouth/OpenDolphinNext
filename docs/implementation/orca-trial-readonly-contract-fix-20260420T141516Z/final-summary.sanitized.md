# ORCA Trial Phase 2.5 Read-only Contract Fix Resubmission

Package RUN_ID: 20260420T141516Z
Read-only evidence RUN_ID: 20260420T123200Z
Source branch: master
Package source commit: aeb1d7cb53cef4eecc4003315f3b62d59221a795
Read-only evidence source commit: 97d3a9e3d08063bdaea73a893dae7778696e2674

## Review Blocker Response

- Gate contract fixed: exact preflight now accepts `mutation_diagnostic_not_run_by_policy` only when `status=not_run`, `routeCalled=false`, raw sensitive exclusion is true, and `mutationPolicy.targetMutationRequestCount=0`.
- Exact preflight handoff is closed in `phase3-handoff.sanitized.json` and `exact-selected-candidate-preflight.sanitized.json`.
- Final package hash is not written into an in-package self-referential ledger. `artifact-sha256.txt` covers package-included dynamic evidence files only. Final ZIP hash is recorded in the external package summary and the final response.

## Result

- acceptedCandidateCount: 1/11
- exact selected-candidate preflight: accepted; acceptedForPhase3Attempt=true
- exact artifact path: docs/implementation/orca-trial-readonly-contract-fix-20260420T141516Z/exact-selected-candidate-preflight.sanitized.json
- exact artifact sha256: 57d43788d7384cdcdc6368271bbcfdf1a2f1a87e92c6ee801271c36332159590
- input identity hash: 356d109381b57e0c792eada1a4bd394248c6fca8273a82ab770143efc92bc29a
- gate validation: ok=true, mutationAllowed=true
- Phase 3: not_run
- Phase 4: not_run
- fullflow / mutation: not_run
- targetMutationRequestCount in final read-only evidence: 0

## Candidate Rows

| patientId | verdict | official | insurance | appointment | local | selector | med-info | primaryRejectionReason | rejectionReasons |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 00001 | accepted | accepted/00 | accepted/000/accepted | accepted/21/direct_acceptance_no_appointment_required | accepted | accepted | accepted | none | none |
| 00002 | rejected | accepted/00 | accepted/000/accepted | accepted/21/direct_acceptance_no_appointment_required | rejected | not_verified | not_verified | local_exact_match_missing | local_exact_match_missing; medical_information_not_ready:department_ready,physician_ready,payment_ready,visitKind_ready,medicalInformation_input_ready,required_identity_fields_match |
| 00003 | rejected | accepted/00 | accepted/000/accepted | accepted/21/direct_acceptance_no_appointment_required | rejected | not_verified | not_verified | local_exact_match_missing | local_exact_match_missing; medical_information_not_ready:department_ready,physician_ready,payment_ready,visitKind_ready,medicalInformation_input_ready,required_identity_fields_match |
| 00004 | rejected | accepted/00 | accepted/000/accepted | accepted/21/direct_acceptance_no_appointment_required | rejected | not_verified | not_verified | local_exact_match_missing | local_exact_match_missing; medical_information_not_ready:department_ready,physician_ready,payment_ready,visitKind_ready,medicalInformation_input_ready,required_identity_fields_match |
| 00005 | rejected | accepted/00 | accepted/000/accepted | accepted/21/direct_acceptance_no_appointment_required | rejected | not_verified | not_verified | local_exact_match_missing | local_exact_match_missing; medical_information_not_ready:department_ready,physician_ready,payment_ready,visitKind_ready,medicalInformation_input_ready,required_identity_fields_match |
| 00006 | rejected | accepted/00 | accepted/000/accepted | accepted/21/direct_acceptance_no_appointment_required | rejected | not_verified | not_verified | local_exact_match_missing | local_exact_match_missing; medical_information_not_ready:department_ready,physician_ready,payment_ready,visitKind_ready,medicalInformation_input_ready,required_identity_fields_match |
| 00007 | rejected | accepted/00 | accepted/000/accepted | accepted/21/direct_acceptance_no_appointment_required | rejected | not_verified | not_verified | local_exact_match_missing | local_exact_match_missing; medical_information_not_ready:department_ready,physician_ready,payment_ready,visitKind_ready,medicalInformation_input_ready,required_identity_fields_match |
| 00008 | rejected | accepted/00 | accepted/000/accepted | accepted/21/direct_acceptance_no_appointment_required | rejected | not_verified | not_verified | local_exact_match_missing | local_exact_match_missing; medical_information_not_ready:department_ready,physician_ready,payment_ready,visitKind_ready,medicalInformation_input_ready,required_identity_fields_match |
| 00009 | rejected | accepted/00 | accepted/000/accepted | accepted/21/direct_acceptance_no_appointment_required | rejected | not_verified | not_verified | local_exact_match_missing | local_exact_match_missing; medical_information_not_ready:department_ready,physician_ready,payment_ready,visitKind_ready,medicalInformation_input_ready,required_identity_fields_match |
| 00010 | rejected | accepted/00 | accepted/000/accepted | accepted/21/direct_acceptance_no_appointment_required | rejected | not_verified | not_verified | local_exact_match_missing | local_exact_match_missing; medical_information_not_ready:department_ready,physician_ready,payment_ready,visitKind_ready,medicalInformation_input_ready,required_identity_fields_match |
| 00011 | rejected | accepted/00 | accepted/000/accepted | accepted/21/direct_acceptance_no_appointment_required | rejected | not_verified | not_verified | local_exact_match_missing | local_exact_match_missing; medical_information_not_ready:department_ready,physician_ready,payment_ready,visitKind_ready,medicalInformation_input_ready,required_identity_fields_match |

## Notes

- Appointment apiResult=21 is accepted only as current harness direct-acceptance policy evidence, not as standalone official business success.
- This package does not authorize Phase 3 by itself; explicit approval is still required.
- Phase 4/fullflow/unrelated mutation and candidates 00002-00011 remain forbidden for this handoff.

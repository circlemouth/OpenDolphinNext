# ORCA Trial Phase 2.5 Final Sanitized Summary

RUN_ID: `20260420T070000Z`

- source_branch: `codex/orca-phase2_5-readonly-diagnostics-main-20260420`
- source_commit: `4e788dd34aa3cf67f041e1f67ddb2edcf62094b3`
- source commit matches artifact summary: `yes`
- source_git_metadata_available: `yes`
- worktree_clean: `not_verified`
- packageMode: `extracted_review_subset`
- zip_file_count: `2162`
- zip_size_bytes: `53694137`
- zip_sha256: `0bc4a4dade6dbdabe71e43a0ab2ca452ed84c31196c07506839dc1f27d86aa82`
- package_source_secret_scan_claim: `passed`
- package_source_secret_scan_scope: `final_review_zip_post_creation`
- full_source_secret_scan_claim: `not_claimed`
- dynamic_review_evidence_secret_scan_claim: `passed`
- acceptedCandidateCount: `0`
- exact selected-candidate preflight: `not_run_no_accepted_candidate`
- Phase 3: `not_run`
- Phase 4: `not_run`
- fullflow: `not_run`
- mutation: `not_run`
- targetMutationRequestCount: `0`
- checkedRequests: `0`
- blocker dimensions: `business_rejected_insurance,business_rejected_appointment,medical_information_not_ready,local_exact_match_missing,department_ready,physician_ready,payment_ready,visitKind_ready,medicalInformation_input_ready,required_identity_fields_match`
- official patientget 500 source classified: `yes_local_encrypted_credential_state_mismatch_then_resolved_to_all_accepted`
- insurance 403 source classified: `yes_harness_csrf_missing_then_resolved_to_business_rejected_insurance`
- appointment 403 source classified: `yes_harness_csrf_missing_then_resolved_to_business_rejected_appointment`

No raw ORCA body, raw patient detail, raw insurance detail, HAR, trace, video, raw screenshot, raw network dump, credential, cookie, Authorization header, JSESSIONID, CSRF token value, raw session, or raw password is included.

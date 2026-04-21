# ORCA Trial Phase 2.5 read-only rerun summary

- RUN_ID: 20260420T044655Z
- source_branch: master
- source_commit: f58db62e0f52847a42905f8d64cb7569f2fa1285
- bootstrap: success
- login /api/session/me status: 200
- acceptedCandidateCount: 0 / 11
- verdict: PARTIAL / TEST-DATA OR HARNESS READINESS BLOCKER
- blockerClassification: test-data-or-harness-readiness-blocker
- blockerReason: phase3_mutation_ready_readonly_evidence_missing
- exact selected-candidate preflight: not_run (phase3_mutation_ready_readonly_evidence_missing)
- Phase 3: not_run
- Phase 4: not_run

## Per-candidate readiness

| patientId | official patientget | insurance | appointment | selector | local selectable | rejection |
|---|---|---|---|---|---|---|
| 00001 | rejected status=500 reason=http_not_2xx | rejected status=403 class=ambiguous_readiness_failure | rejected status=403 class=ambiguous_readiness_failure | rejected | accepted | medical_information_not_ready |
| 00002 | rejected status=500 reason=http_not_2xx | rejected status=403 class=ambiguous_readiness_failure | rejected status=403 class=ambiguous_readiness_failure | not_verified reason=local_exact_match_missing | rejected reason=local_exact_match_missing | medical_information_not_ready |
| 00003 | rejected status=500 reason=http_not_2xx | rejected status=403 class=ambiguous_readiness_failure | rejected status=403 class=ambiguous_readiness_failure | not_verified reason=local_exact_match_missing | rejected reason=local_exact_match_missing | medical_information_not_ready |
| 00004 | rejected status=500 reason=http_not_2xx | rejected status=403 class=ambiguous_readiness_failure | rejected status=403 class=ambiguous_readiness_failure | not_verified reason=local_exact_match_missing | rejected reason=local_exact_match_missing | medical_information_not_ready |
| 00005 | rejected status=500 reason=http_not_2xx | rejected status=403 class=ambiguous_readiness_failure | rejected status=403 class=ambiguous_readiness_failure | rejected | accepted | medical_information_not_ready |
| 00006 | rejected status=500 reason=http_not_2xx | rejected status=403 class=ambiguous_readiness_failure | rejected status=403 class=ambiguous_readiness_failure | not_verified reason=local_exact_match_missing | rejected reason=local_exact_match_missing | medical_information_not_ready |
| 00007 | rejected status=500 reason=http_not_2xx | rejected status=403 class=ambiguous_readiness_failure | rejected status=403 class=ambiguous_readiness_failure | not_verified reason=local_exact_match_missing | rejected reason=local_exact_match_missing | medical_information_not_ready |
| 00008 | rejected status=500 reason=http_not_2xx | rejected status=403 class=ambiguous_readiness_failure | rejected status=403 class=ambiguous_readiness_failure | not_verified reason=local_exact_match_missing | rejected reason=local_exact_match_missing | medical_information_not_ready |
| 00009 | rejected status=500 reason=http_not_2xx | rejected status=403 class=ambiguous_readiness_failure | rejected status=403 class=ambiguous_readiness_failure | not_verified reason=local_exact_match_missing | rejected reason=local_exact_match_missing | medical_information_not_ready |
| 00010 | rejected status=500 reason=http_not_2xx | rejected status=403 class=ambiguous_readiness_failure | rejected status=403 class=ambiguous_readiness_failure | not_verified reason=local_exact_match_missing | rejected reason=local_exact_match_missing | medical_information_not_ready |
| 00011 | rejected status=500 reason=http_not_2xx | rejected status=403 class=ambiguous_readiness_failure | rejected status=403 class=ambiguous_readiness_failure | not_verified reason=local_exact_match_missing | rejected reason=local_exact_match_missing | medical_information_not_ready |

## Blocker dimensions
- medical_information_not_ready
- official_patientget:500:http_not_2xx
- insurance:403:ambiguous_readiness_failure
- appointment:403:ambiguous_readiness_failure
- selector:rejected
- selector:not_verified:local_exact_match_missing
- local_selectable:rejected:local_exact_match_missing

## Safety notes
- HTTP 200 was not treated as business success.
- HTTP 403 was classified as ambiguous readiness failure, not insurance/appointment missing.
- acceptedCandidateCount=0 is not a claim that official initial patients are absent.
- No Phase 3, Phase 4, fullflow, or mutation command was run.

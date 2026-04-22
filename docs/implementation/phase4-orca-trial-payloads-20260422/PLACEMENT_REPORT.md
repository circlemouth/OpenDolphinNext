# Phase4 ORCA Trial Payload Placement Report

RUN_ID: `20260422T224559Z`

## Verdict

`PHASE4_DUMMY_JSON_PAYLOADS_PLACED_LOCAL_VALIDATED_NO_LIVE`

The received Phase4 ORCA Trial dummy JSON payload package was placed into the repository and hash-verified. No live ORCA Trial traffic was sent.

## Source Package

- source path: `/Users/Hayato/Downloads/phase4_orca_trial_dummy_json_payloads_20260422.zip`
- zip SHA-256: `b446c7bb4fc22e69d003403b22057b53931051e90821301b3cfc2119743cead2`
- extracted package directory was used for file placement.

## Placed Files

| File | SHA-256 | Status |
|---|---|---|
| [medicalmodv2_phase4_dummy_current_wrapper_v1.json](/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient/web-client/qa/payloads/phase4/medicalmodv2_phase4_dummy_current_wrapper_v1.json) | `e0f34fa28177155bf19cc0476863bf540f8b1ff4d844ddf189b88ab327645618` | current WO-8 wrapper candidate; local dry-run PASS |
| [medicalmodv2_phase4_dummy_owner_aligned_v1.json](/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient/web-client/qa/payloads/phase4/medicalmodv2_phase4_dummy_owner_aligned_v1.json) | `2044f175382bbf013ad928cb7ba7431d5a5a0d5bc7c1f26d6448b06c747d9de5` | owner-aligned blank variant; current wrapper expected fail-closed |
| [diseasev3_phase4_dummy_native_intent_v1.json](/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient/web-client/qa/payloads/phase4/diseasev3_phase4_dummy_native_intent_v1.json) | `da4bd8dfd726e0c5838d0e06e0cabcf34d7fd984286c753ae4d59fb629f5f8df` | future safe wrapper only |
| [subjectivesv2_phase4_dummy_native_intent_v1.json](/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient/web-client/qa/payloads/phase4/subjectivesv2_phase4_dummy_native_intent_v1.json) | `9c90a3b0d731bce2b9e1280d01a5c61222bbd97126e3f9fc50aa6135842dc308` | future safe wrapper only |
| [manifest.phase4-orca-trial-dummy-json-v1.json](/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient/web-client/qa/payloads/phase4/manifest.phase4-orca-trial-dummy-json-v1.json) | `f1707e5c0248d4ca01beb4de658645ff45fb6ba4e2fba90fbcf92dd6fd94521b` | package manifest |
| [README.phase4-orca-trial-payloads.md](/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient/docs/implementation/phase4-orca-trial-payloads-20260422/README.phase4-orca-trial-payloads.md) | `dd1f4228b8b9d9c33e40ee7199c3599eb160ead0b177e693ce693baf6e9fffaa` | package README before repo placement notes |

## Local Validation

- ZIP SHA-256 verification: PASS.
- Individual placed file SHA-256 verification: PASS.
- JSON syntax validation with `jq empty`: PASS.
- Current medicalmodv2 wrapper dry-run with `medicalmodv2_phase4_dummy_current_wrapper_v1.json`: PASS; live Trial action `not_run`.
- Owner-aligned blank variant dry-run: expected fail-closed before live because the current wrapper requires `insuranceCombinationNumber`, `voucherNumber`, and `sequentialNumber`.

## Execution Status

- live Trial ORCA action: `not_run`
- production ORCA action: `not_run`
- Phase3 retry: `not_run`
- fullflow: `not_run`
- diseasev3 / subjectivesv2 live action: `not_run`

## Owner Approval

The previous XML payload hashes did not approve these JSON file bytes. The owner approved the current-wrapper JSON SHA-256 in RUN_ID `20260422T224559Z`:

`e0f34fa28177155bf19cc0476863bf540f8b1ff4d844ddf189b88ab327645618`

Evidence: [OWNER_APPROVAL_PHASE4_JSON_SHA_ADDENDUM.md](/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient/docs/implementation/phase4-orca-trial-payloads-20260422/OWNER_APPROVAL_PHASE4_JSON_SHA_ADDENDUM.md)

## Remaining Blocker

Live execution was not attempted because the local backend was unavailable and Docker daemon was not reachable from this shell. Evidence: [RUNTIME_BLOCKER_REPORT.md](/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient/docs/implementation/phase4-orca-trial-payloads-20260422/RUNTIME_BLOCKER_REPORT.md)

## Safety

- credentials printed or captured: no
- raw ORCA request/response captured: no
- raw patient or insurance details captured: no
- HAR/trace/video/screenshot/raw network artifacts captured: no

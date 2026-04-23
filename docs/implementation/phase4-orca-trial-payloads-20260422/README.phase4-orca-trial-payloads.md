# Phase4 ORCA Trial dummy JSON payloads

This package contains dummy payload JSON files for Phase4 Live ORCA Trial handoff.

## Repository placement

Placed in this repository by RUN_ID `20260422T224559Z`.

- source package: `/Users/Hayato/Downloads/phase4_orca_trial_dummy_json_payloads_20260422.zip`
- source package SHA-256: `b446c7bb4fc22e69d003403b22057b53931051e90821301b3cfc2119743cead2`
- live ORCA action during placement: `not_run`
- credentials captured: `no`
- raw ORCA/body/network artifacts captured: `no`

## Critical hash note

The previously discussed SHA-256 values were for XML payload bytes. They **cannot** be reused for JSON payload files.
Use the JSON file hashes in this package and update the Owner approval/handoff accordingly.

## Files

| File | Purpose | SHA-256 |
|---|---|---|
| `web-client/qa/payloads/phase4/medicalmodv2_phase4_dummy_phase3_context_v1.json` | Active medicalmodv2 wrapper candidate after RWO-06 `apiResult=14` investigation. Keeps patient `00001`, Request_Number `01`, class `01`, and uses the sanitized Phase3 Trial context `departmentCode=01` / `physicianCode=10001`. | `c2dc84307c9f8ae83f2361525a6c127938cb1ef308c4ef125ebaaa0408809627` |
| `web-client/qa/payloads/phase4/medicalmodv2_phase4_dummy_current_wrapper_v1.json` | Historical candidate from RUN_ID `20260422T224559Z`. Retained for audit, but no longer active because `departmentCode=11` / `physicianCode=0005` is blocked by the current no-live wrapper gate. | `e0f34fa28177155bf19cc0476863bf540f8b1ff4d844ddf189b88ab327645618` |
| `web-client/qa/payloads/phase4/medicalmodv2_phase4_dummy_owner_aligned_v1.json` | Owner-aligned variant with blank insurance/voucher/sequential fields. Expected to fail current wrapper unless the wrapper contract is changed. | `2044f175382bbf013ad928cb7ba7431d5a5a0d5bc7c1f26d6448b06c747d9de5` |
| `web-client/qa/payloads/phase4/diseasev3_phase4_dummy_native_intent_v1.json` | Native intent JSON for future diseasev3 safe wrapper only. Not executable by current medicalmodv2 wrapper. | `da4bd8dfd726e0c5838d0e06e0cabcf34d7fd984286c753ae4d59fb629f5f8df` |
| `web-client/qa/payloads/phase4/subjectivesv2_phase4_dummy_native_intent_v1.json` | Native intent JSON for future subjectivesv2 safe wrapper only. Not executable by current medicalmodv2 wrapper. | `9c90a3b0d731bce2b9e1280d01a5c61222bbd97126e3f9fc50aa6135842dc308` |
| `web-client/qa/payloads/phase4/manifest.phase4-orca-trial-dummy-json-v1.json` | Manifest and safety scope. | `f1707e5c0248d4ca01beb4de658645ff45fb6ba4e2fba90fbcf92dd6fd94521b` |

## Execution recommendation

For current RWO-06 `medicalmodv2` retry cycles, use only:

```bash
--payload web-client/qa/payloads/phase4/medicalmodv2_phase4_dummy_phase3_context_v1.json \
--payload-sha256 c2dc84307c9f8ae83f2361525a6c127938cb1ef308c4ef125ebaaa0408809627
```

## Owner approval addendum

The original current-wrapper candidate has a JSON sha256 and includes `insuranceCombinationNumber=0001`.
The previous XML hash and the previous "insurance blank / ORCA-side decision" wording did not approve this exact JSON file.
The owner approved the current-wrapper JSON SHA-256 in RUN_ID `20260422T224559Z`; see [OWNER_APPROVAL_PHASE4_JSON_SHA_ADDENDUM.md](/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient/docs/implementation/phase4-orca-trial-payloads-20260422/OWNER_APPROVAL_PHASE4_JSON_SHA_ADDENDUM.md).

RUN_ID `20260423T150257Z` superseded that candidate for future retry cycles because sanitized Trial evidence mapped `apiResult=14` to stale department/physician context. The active candidate keeps the same target, Request_Number, class, and evidence restrictions, but aligns department/physician with prior sanitized Phase3 Trial context. This is a Trial-only payload-contract repair, not production ORCA evidence or a release readiness claim.

## Local validation

RUN_ID `20260422T224559Z` performed local validation only:

- JSON parse check: PASS for all package JSON files.
- `medicalmodv2_phase4_dummy_phase3_context_v1.json`: active payload-contract repair candidate. Validate with current `qa-phase4-safe-medicalmodv2.mjs` dry-run gate and SHA-256 `c2dc84307c9f8ae83f2361525a6c127938cb1ef308c4ef125ebaaa0408809627`.
- `medicalmodv2_phase4_dummy_current_wrapper_v1.json`: historical PASS for the original wrapper; expected fail-closed under the current wrapper gate because department/physician context is stale.
- `medicalmodv2_phase4_dummy_owner_aligned_v1.json`: expected fail-closed before live because `insuranceCombinationNumber`, `voucherNumber`, and `sequentialNumber` are blank under the current wrapper contract.
- `diseasev3_phase4_dummy_native_intent_v1.json` and `subjectivesv2_phase4_dummy_native_intent_v1.json`: stored as future-wrapper intent payloads only; no current live execution path.
- live Trial action: not run because local backend was unavailable; see [RUNTIME_BLOCKER_REPORT.md](/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient/docs/implementation/phase4-orca-trial-payloads-20260422/RUNTIME_BLOCKER_REPORT.md).

Validation evidence:

- current-wrapper dry-run: [phase4-medicalmodv2-summary.sanitized.json](/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient/docs/implementation/phase4-orca-trial-payloads-20260422/wrapper-dry-run-current-wrapper/phase4-medicalmodv2-summary.sanitized.json)
- owner-aligned expected fail-close: [phase4-medicalmodv2-summary.sanitized.json](/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient/docs/implementation/phase4-orca-trial-payloads-20260422/wrapper-dry-run-owner-aligned-expected-fail/phase4-medicalmodv2-summary.sanitized.json)

## Evidence policy

Do not store:
- raw ORCA request/response
- raw patient or insurance detail
- HAR, trace, video, screenshot, raw network dump
- password, cookie, token, session ID, CSRF

Store only:
- sanitized summary
- allowlisted parsed fields
- sha256
- classification
- endpoint / class / Request_Number
- minimal target id

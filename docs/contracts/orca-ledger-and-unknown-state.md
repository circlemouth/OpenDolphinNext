# ORCA Ledger and UNKNOWN State Contract

## Purpose

This contract fixes the server-side ledger, UNKNOWN, retry, duplicate prevention, and reconciliation boundary for ORCA / WebORCA operations.

OpenDolphinNext does not make ORCA source-of-truth data local authority. It stores sanitized operation metadata, payload hashes, warning/error/unmatch classification, and reconciliation state so operators can explain and recover from ORCA communication without treating ambiguous results as success.

## Scope

All ORCA transport operations must create or update the shared ledger:

- `patientgetv2`
- `patientmodv2`
- `acceptlstv2`
- `acceptmodv2`
- `diseasegetv2`
- `diseasev3`
- `medicalmodv2`
- `tmedicalgetv2`
- `incomeinfv2`
- ORCA report APIs such as prescription, invoice receipt, statement, medicine notebook, and chart report APIs
- supporting official reads used by reconciliation and preflight

Domain-specific tables may keep their own state, but the shared `orca_operation` ledger remains the cross-API audit spine.

## Ledger Tables

The shared ledger consists of:

- `orca_operation`: one logical ORCA operation keyed by facility, source API, and server-generated idempotency key.
- `orca_transmission`: each send/read attempt for an operation.
- `orca_response_summary`: sanitized response classification, warnings, errors, unmatched, ORCA-only and normalized summary.
- `orca_reconciliation_result`: post-send re-fetch or operator reconciliation result.

The ledger must not contain raw ORCA XML/JSON bodies, ORCA URL, Basic credentials, certificate material, browser cookies, CSRF tokens, patient address/phone, insurance detail, or arbitrary client-provided object keys/digests.

## Required Fields

Every ledger operation stores operation scope, source API, server-generated idempotency key, request hash, response hash when present, actor classification, safely available server-derived target context, operation status, UNKNOWN classification, reconciliation status, central audit trace id, and sanitized summaries.

## Operation Status

Server/API status values are:

- `PREPARED`
- `READY_TO_SEND`
- `SENDING`
- `ORCA_ACCEPTED`
- `ORCA_REJECTED`
- `ORCA_WARNING`
- `ORCA_UNMATCHED`
- `ORCA_CONFLICT`
- `NETWORK_FAILED`
- `CERTIFICATE_FAILED`
- `AUTH_FAILED`
- `UNKNOWN`
- `NEEDS_REVIEW`
- `CANCELLED`

`ORCA_ACCEPTED` means only that the endpoint-specific ORCA response was accepted by the parser and status policy. It does not mean chart finalized, prescription finalized, reflected in accounting, or billed.

`ORCA_WARNING`, `ORCA_UNMATCHED`, `NETWORK_FAILED`, `CERTIFICATE_FAILED`, `AUTH_FAILED`, `UNKNOWN`, and `NEEDS_REVIEW` must set `needs_user_review=true`.

## UNKNOWN Classification

UNKNOWN and review-driving failures are classified as:

- `NETWORK_FAILED`
- `AUTH_FAILED`
- `CERT_FAILED`
- `BUSINESS_ERROR`
- `WARNING_NEEDS_REVIEW`
- `UNMATCHED`
- `UNKNOWN`

UI may display these values, but must not convert them to registered, reflected, completed, finalized, or billed.

## Reconciliation Status

Reconciliation status values are:

- `NOT_REQUIRED`
- `PENDING`
- `MATCHED`
- `UNMATCHED`
- `CONFLICT`
- `ORCA_ONLY`
- `LOCAL_ONLY`
- `UNKNOWN`
- `NEEDS_REVIEW`
- `BLOCKED`

Mutation operations such as `medicalmodv2`, `diseasev3`, `patientmodv2`, and `acceptmodv2` require post-send review or re-fetch. If the response is not accepted, reconciliation is `BLOCKED`. If accepted but endpoint-specific re-fetch is still required, reconciliation is `PENDING`.

## Idempotency and Duplicate Prevention

The operation idempotency key is server-generated from facility, source API, and request hash. Client-provided facility, owner, role, URL, voucher, sequential number, insurance combination, `Medical_Uid`, raw XML, storage key, or digest is not authority.

For the same facility, source API, and idempotency key:

- `orca_operation` remains a single logical operation.
- additional attempts append `orca_transmission` rows and increment retry count.
- callers must not create a new idempotency key for the same unchanged candidate.
- auto resend is prohibited while reconciliation is `PENDING`, `BLOCKED`, `UNKNOWN`, `NEEDS_REVIEW`, `CONFLICT`, or `UNMATCHED`.

## Retry and Manual Recovery

Retry may be considered only when the original operation is not already safely accepted and reconciled, the request hash and server-side snapshot are still identical or an audited correction flow exists, reconciliation has checked ORCA state where required, duplicate registration risk is reviewed, and a new `orca_transmission` attempt is appended under the same operation.

Retry is blocked when ORCA has a matching or conflicting temporary medical row, warning/unmatch needs review, auth/certificate configuration is unresolved, server-side snapshot is incomplete, target context cannot be derived from server authority, or a client tries to supply raw identifiers or payload authority.

## API Boundary for UI

UI should consume sanitized DTO fields only:

- `operationStatus`
- `unknownClassification`
- `reconciliationStatus`
- `needsUserReview`
- `resendBlocked`
- `resendBlockReason`
- `requestHash`
- `responseHash`
- `operationId` or `transmissionId`
- server-derived target labels already allowed by each endpoint

UI must not receive raw ORCA response, ORCA URL, Basic auth, certificate material, raw `Medical_Uid`, patient address/phone, insurance detail, or arbitrary nested ORCA payload.

## Acceptance Criteria

- every production ORCA transport call writes the shared ledger when the runtime ledger repository is available
- warning/unmatch/error/UNKNOWN are classified and reviewable
- request and response hashes are stored instead of raw payloads
- idempotency uniqueness prevents duplicate logical operations
- duplicate attempts append transmissions rather than silently overwriting
- central audit can correlate via trace id
- UNKNOWN is never returned or displayed as registered, reflected, finalized, completed, or billed

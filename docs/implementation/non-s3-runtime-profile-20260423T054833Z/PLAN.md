# Non-S3 Runtime Profile Plan

RUN_ID: `20260423T054833Z`

## Decision

For Trial-backed ORCA verification, do not introduce a local dummy S3/MinIO server. Instead, create a first-class object-storage-free dev/Trial runtime profile.

This plan exists because RWO-06 live Trial expansion is blocked when the documented backend startup path requires object-storage configuration even though the target ORCA wrapper path does not need attachment or PHR storage.

## Required Runtime Semantics

The profile must:

- be explicit, for example `attachment.storage.mode=disabled` or an equivalent clearly named runtime profile;
- require no `ATTACHMENT_STORAGE_S3_*`, `PHR_EXPORT_S3_*`, `MINIO_*`, or equivalent object-storage values;
- not start MinIO or emulate S3;
- avoid object-storage client initialization and backend probes;
- fail closed for attachment, patient image, and PHR export storage paths;
- keep ORCA official routes available when they do not depend on object storage;
- keep health/readiness sanitized and avoid object-storage readiness claims.

## Non-Claims

This profile does not prove:

- attachment storage readiness;
- patient image storage readiness;
- PHR export storage readiness;
- S3 persistence;
- object-storage deployment readiness;
- production ORCA readiness;
- final release readiness.

## Implementation Work Items

1. Extend runtime config validation to support the explicit disabled/profile value only in dev/Trial verification contexts.
2. Ensure storage manager/resource entrypoints fail closed when storage is disabled.
3. Ensure readiness reports a sanitized disabled/not-applicable status without endpoint, bucket, key, or internal exception detail.
4. Update documented startup paths so automation can select this profile without object-storage secrets.
5. Add focused tests for resolver/validator, fail-closed storage routes, readiness sanitization, and guard behavior.
6. After local verification, create a follow-up handoff for the single approved Phase4 `medicalmodv2` live Trial action if all non-S3 prerequisites are present.

## Safety Notes

- Do not weaken production-like S3 requirements outside this explicit dev/Trial profile.
- Do not use browser artifacts, raw network dumps, or raw ORCA bodies as evidence.
- Do not overclaim Trial endpoint evidence as storage readiness or production readiness.

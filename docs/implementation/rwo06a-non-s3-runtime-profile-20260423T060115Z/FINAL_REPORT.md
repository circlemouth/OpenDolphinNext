# RWO-06A Non-S3 Runtime Profile Final Report

RUN_ID: `20260423T060115Z`

## Result

`RWO06A_NON_S3_RUNTIME_PROFILE_IMPLEMENTED_LOCAL_TESTED`

Implemented an explicit object-storage-free WebORCA Trial dev/runtime profile:

- `attachment.storage.mode=disabled`
- `OPENDOLPHIN_RUNTIME_PROFILE=orca-trial-no-object-storage`

This profile is not object-storage readiness. It exists only to let ORCA Trial endpoint verification start without S3/MinIO/object-storage credentials while storage-dependent features fail closed.

## Files Changed

- `server-modernized/src/main/java/open/dolphin/storage/attachment/AttachmentStorageMode.java`
- `server-modernized/src/main/java/open/dolphin/storage/attachment/AttachmentStorageConfigLoader.java`
- `server-modernized/src/main/java/open/dolphin/storage/attachment/AttachmentStorageManager.java`
- `server-modernized/src/main/java/open/dolphin/storage/image/ImageStorageManager.java`
- `server-modernized/src/main/java/open/dolphin/runtime/config/ServerConfigurationValidator.java`
- `server-modernized/src/main/java/open/dolphin/rest/OperationsReadinessEvaluator.java`
- `server-modernized/src/main/java/open/dolphin/rest/PatientImagesSupport.java`
- `server-modernized/src/main/java/open/dolphin/rest/PatientImagesResource.java`
- `setup-modernized-env.sh`
- `docker-compose.modernized.dev.yml`
- focused tests under `server-modernized/src/test/java/open/dolphin/...`
- docs/contracts, docs/runbooks, and roadmap status docs

## Misuse Cases Checked

1. Attachment or patient image upload/download while disabled profile is active: fail closed with storage-disabled exceptions or sanitized `503` patient image response.
2. Readiness/health overclaim: readiness returns `attachmentStorage.status=DISABLED`, `mode=disabled`, and `reasonCode=attachment_storage_disabled` without bucket/endpoint/prefix details.
3. Accidental S3/MinIO/PHR S3 variables with disabled profile: server validation rejects `attachment.storage.s3.*`; setup profile rejects configured object-storage variables without printing values.
4. ORCA Trial wrapper blocked by object-storage initialization: storage managers now initialize in disabled mode without object-storage clients; setup does not start the MinIO profile for `orca-trial-no-object-storage`.

## Verification

- `bash -n setup-modernized-env.sh`: pass
- `git diff --check`: pass
- `bash server-modernized/tools/ci/check-config-contract.sh`: pass
- `bash server-modernized/tools/ci/check-doc-links.sh`: pass
- `bash server-modernized/tools/ci/check-no-generated-artifacts.sh --root "$(git rev-parse --show-toplevel)"`: pass
- `mvn -f pom.server-modernized.xml -pl server-modernized -am -Dsurefire.failIfNoSpecifiedTests=false -Dtest=AttachmentStorageConfigLoaderTest,AttachmentStorageManagerTest,ImageStorageManagerTest,ServerConfigurationValidatorTest,ServletStartupSecurityGuardTest,OperationsHealthResourceTest,PatientImagesSupportTest,PatientImagesResourceTest,PatientImagesResourceFeatureHeaderTest test`: pass, 73 tests

## Live Trial ORCA

- Action: `not_run`
- Reason: RWO-06A scope was implementation/local verification first.
- Next approved action: exactly one Phase4 `medicalmodv2` Trial action through `web-client/scripts/qa-phase4-safe-medicalmodv2.mjs`, only if the non-S3 runtime path and required non-S3 runtime secrets/config are available.

## Safety

- Credentials captured: no
- Raw artifacts captured: no
- Raw ORCA request/response bodies captured: no
- Screenshots/HAR/traces/videos captured: no

## Claim Boundary

Allowed claim: repo-local non-S3 runtime profile implementation and focused-test verification.

Not claimed: attachment storage readiness, patient image storage readiness, PHR export storage readiness, S3 persistence, object-storage deployment readiness, live Trial `medicalmodv2` success, production ORCA readiness, or final release readiness.

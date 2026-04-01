# Server Baseline Inventory

- RUN_ID: `20260401T121039Z`
- 対象: `server-modernized/`

## Unimplemented Endpoints

- `server-modernized/src/main/java/open/orca/rest/OrcaMasterResource.java`
  - `GET /orca/master/generic-price`
  - `GET /orca/master/hokenja`
  - `GET /orca/master/address`

## Storage Managers

- `server-modernized/src/main/java/open/dolphin/storage/attachment/AttachmentStorageManager.java`
- `server-modernized/src/main/java/open/dolphin/storage/image/ImageStorageManager.java`

## Revision Author Problem

- resource entrypoint:
  - `server-modernized/src/main/java/open/dolphin/rest/KarteRevisionResource.java`
- creation logic:
  - `server-modernized/src/main/java/open/dolphin/session/KarteRevisionServiceBean.java`
- current issue:
  - `writeRevision()` から actual actor を service へ渡していない。
  - `createRevisionFromSource()` が `source.getUserModel()` をそのまま新 revision と child entity の作成者へ流用している。

## ORCA Raw SQL Locations To Consolidate

- `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaLiveDiseaseMasterResource.java`
- `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaOrderInputSetSupport.java`
- `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaOrderInteractionSupport.java`

## Targeted Test Classes

- `open.orca.rest.OrcaMasterResourceTest`
- `open.orca.rest.OrcaMasterSchemaValidatorTest`
- `open.dolphin.storage.attachment.AttachmentStorageConfigLoaderTest`
- `open.dolphin.storage.attachment.AttachmentStorageManagerTest`
- `open.dolphin.storage.image.ImageStorageManagerTest`
- `open.dolphin.runtime.config.StoragePersistenceContractValidatorTest`
- `open.dolphin.session.KarteRevisionServiceBeanAttachmentCloneTest`
- `open.dolphin.mbean.ServletStartupSecurityGuardTest`
- `open.dolphin.db.FreshSchemaBaselineTest`
- `open.dolphin.rest.orca.OrcaOrderInputSetSupportTest`
- `open.dolphin.rest.orca.OrcaLiveDiseaseMasterReadServiceTest`
- `open.dolphin.rest.orca.OrcaOrderInteractionReadServiceTest`

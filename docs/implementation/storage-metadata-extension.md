# Storage Metadata Extension

- RUN_ID: `20260401T121039Z`
- Decision: `APPLY`

## Evidence

- entity source present:
  - `persistence/src/main/java/open/dolphin/infomodel/AttachmentModel.java`
  - `persistence/src/main/java/open/dolphin/infomodel/SchemaModel.java`
- persistence registration test reads entities from:
  - `server-modernized/src/test/java/open/dolphin/PersistenceXmlEntityRegistrationTest.java`
- migration source present:
  - `server-modernized/tools/flyway/sql/`

## Rule

- entity / migration / baseline test を同じ wave で更新する。
- server module に重複 entity は作らない。

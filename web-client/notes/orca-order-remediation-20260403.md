# ORCA Order Remediation Notes (2026-04-03)

- RUN_ID: `20260403T235159Z`
- Scope: class 600 remediation for `testOrder`, `physiologyOrder`, and `bacteriaOrder`
- Status: final contract for Web client and modernized server

## Final Design

### 1. Class 600 identification

- `generalOrder` is an ingress alias of `treatmentOrder`.
- `laboTest` is an ingress alias of `testOrder`.
- `testOrder`, `physiologyOrder`, and `bacteriaOrder` remain distinct public entities in the client/server contract.
- ORCA input-set list/detail may still expose canonical class 600 rows as `testOrder`; the requester entity is used to resolve the public subtype/entity on apply.

### 2. Bacteria send policy

- `bacteriaOrder` is no longer treated as an automatic ORCA send blocker.
- Sendable content is still the documented `medicalmodv2` row model: class 600 coded rows plus documented comment/material carriers.
- `subtype` is first-class and preserved across save/fetch/input-set/recommendation, but it is not emitted into `medicalmodv2` XML because ORCA does not provide a dedicated bacteria subtype tag.
- `bacteria` metadata is first-class and stored as:
  - `specimen`
  - `carrierComments`
- Only metadata that can be projected onto documented ORCA carriers is converted into comment rows.
- Metadata without a documented ORCA carrier remains local-only, but it does not stop other bundles from being sent.

### 3. Chart-wide blocking

- The old `unsupported_bacteria_subtype` blanket block was removed.
- A bacteria bundle is blocked only by the same ordinary validation used for other bundles:
  - missing required coded rows
  - invalid code family
  - mixed coded/uncoded rows
  - comment-only bundle without a sendable main row
- The existence of a `bacteriaOrder` bundle must not stop unrelated sendable bundles in the same chart.

## Public Contract

### First-class fields

- `subtype`
- `bacteria`
  - `specimen`
  - `carrierComments`
- `materialItems`
- `commentItems`
- comment metadata on each row:
  - `category`
  - `itemNumber`
  - `itemNumberBranch`

### Preserved across

- UI state
- bundle save API
- fetch API
- ORCA input-set detail
- recommendation template
- normalization source model

## Send vs Local-only

### Sent to ORCA

- class-coded main rows
- explicit `materialItems`
- explicit `commentItems`
- bacteria metadata only when it can be projected into documented ORCA comment carriers
- `classCode`, `classCodeSystem`, `className`
- `bodyPart` where applicable

### Local-only

- `bundleName`
- free-text `memo`
- free-text `item.memo`
- `adminMemo` unless the entity-specific ORCA carrier explicitly uses it
- `subtype` itself
- bacteria metadata that has no documented ORCA carrier

## Persistence Notes

- `stampMemo` token storage is no longer the public contract.
- Legacy stamp memo parsing may still be used internally for compatibility/read-path recovery, but the external API contract is first-class:
  - `subtype`
  - `bacteria`
  - `materialItems`
  - `commentItems`

## Verification

### Web client

- `npm --prefix web-client run typecheck`
  - Result: passed
- `npm --prefix web-client test -- --run src/features/charts/OrderBundleEditPanel.600-subtype.test.tsx src/features/charts/__tests__/orderBundleValidation.test.ts src/features/charts/__tests__/orderBundleApi.test.ts src/features/charts/__tests__/orderBundleOrcaSupport.test.tsx src/features/charts/__tests__/orderRpNormalization.test.ts src/features/charts/__tests__/chartsActionBar.orca-send.test.tsx src/features/charts/__tests__/orderSendSmoke.test.ts src/features/charts/orderSend600SubtypeSmoke.test.ts`
  - Result: passed (`8 files / 86 tests`)

### Server

- Intended command:
  - `mvn -f pom.server-modernized.xml -pl api-contract,server-modernized -am -Dsurefire.failIfNoSpecifiedTests=false -Dtest=OrcaOrderBundle600SubtypeSupportTest,OrcaOrderBundleRequestSupportTest,OrcaOrderBundleResource600Test,OrcaChartSupportSupportTest,OrcaOrderInputSetMetadataSupportTest,OrcaOrderInputSetReadServiceTest test`
- Result in this workspace:
  - not executed, because `mvn` and `java` are not installed on the current machine PATH

## Files Touched

- `web-client/src/features/charts/OrderBundleEditPanel.tsx`
- `web-client/src/features/charts/orderBundleApi.ts`
- `web-client/src/features/charts/orderRpNormalization.ts`
- `web-client/src/features/charts/orcaOrderInputSetApi.ts`
- `web-client/src/features/charts/bacteriaOrderSupport.ts`
- `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaOrderBundleMutationSupport.java`
- `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaOrderBundleFetchSupport.java`
- `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaOrderBundleResource.java`
- `server-modernized/src/main/java/open/dolphin/orca/read/OrcaOrderInputSetReadService.java`
- `api-contract/src/main/java/open/dolphin/rest/dto/orca/*.java`

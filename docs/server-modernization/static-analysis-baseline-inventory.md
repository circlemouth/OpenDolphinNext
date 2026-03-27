# Static Analysis Baseline Inventory

- Date: 2026-03-28
- RUN_ID: 20260327T152249Z
- Scope: `server-modernized` SpotBugs / FindSecBugs baseline burn-down Wave 3
- Canonical command: `bash ./scripts/server-modernized/verify-static-analysis.sh`

## Intent

- Keep parent POM intent unchanged: SpotBugs / FindSecBugs remain fail-on-error.
- Keep Checkstyle / PMD unchanged.
- Record the Wave 3 integrated baseline without threshold relaxation, blanket suppression, or filter weakening.

## Before Counts

- Wave 3 start baseline: `144`
- Historical Wave 2 start baseline: `249`
- Historical Wave 1 start baseline: `329`
- Historical Wave 2 end baseline: `144`

## Wave 2 Changes

- Lane A: `open.orca.rest`
  - Removed unused fixture-only fields from `OrcaMasterFixtureSupport`
  - Added defensive copies to `EtensuDao.EtensuSearchResult` / `EtensuRecord`
  - Switched material master lookup to `MaterialTableMeta` and selected `maker` instead of persisting forced null
- Lane B:
  - Tightened `ISchemaModel` getter/setter contracts with defensive copies for `UserModel`, `KarteBean`, `ExtRefModel`, and `imageBytes`
- Lane C:
  - Added fail-closed null-response handling in `DefaultOrcaLiveGateway`
  - Added defensive copies for ORCA config TLS byte arrays and selected sync request payloads
  - Converted `FacilityState` to a record and reduced redundant null checks in ORCA/session paths
- Lane D:
  - Narrowed `PlistParser` catch blocks and removed ignored broad exception handling
  - Fixed expose-rep tails in `LocalMedicalSummaryService`, `LegacyOrcaResponseMapper`, and `PatientImageServiceBean`

## Wave 3 Changes

- Lane A:
  - No change in this wave; remaining dynamic SQL tail is still pending.
- Lane B:
  - No change in this wave; converter/shared.converter residue remains pending.
- Lane C:
  - No change in this wave; `DefaultOrcaLiveGateway` and related ORCA/session tails remain pending.
- Lane D:
  - Removed nullable boolean helper returns from `AdminConfigResource` and `AdminOrcaConnectionResource`.
  - Tightened `AdminOrcaConnectionResource` store access to fail closed instead of repeating redundant null guards.
  - Closed null-list paths in `KarteResource` and `StampResource` with explicit bad-request handling.
  - Removed unused `payloadSize`, `lastFailureDetail`, and `lockStartedAt` fields from master-update state/payload objects.
  - Added defensive copying to `AuditChainVerifier.VerificationResult`.
  - Updated `OrcaPatientSyncStateStoreIT` to use the new record accessors so the module compiles.

## After Counts

- Canonical command result: `FAIL` at SpotBugs check
- Total findings: `125`
- Delta from Wave 3 start: `-19`
- Delta from Historical Wave 2 start: `-124`
- Delta from original Wave 1 start: `-204`

## Top Bug Families

- `EI_EXPOSE_REP2`: `49`
- `RCN_REDUNDANT_NULLCHECK_OF_NONNULL_VALUE`: `18`
- `NP_NULL_PARAM_DEREF`: `12`
- `EI_EXPOSE_REP`: `11`
- `UPM_UNCALLED_PRIVATE_METHOD`: `5`
- `DLS_DEAD_LOCAL_STORE`: `4`
- `NP_BOOLEAN_RETURN_NULL`: `4`
- `BC_VACUOUS_INSTANCEOF`: `3`
- `DM_NUMBER_CTOR`: `3`
- `REC_CATCH_EXCEPTION`: `3`

## Top Packages

- `open.dolphin.converter`: `31`
- `open.dolphin.orca.service`: `23`
- `open.dolphin.rest`: `20`
- `open.dolphin.orca.transport`: `8`
- `open.dolphin.rest.orca`: `7`
- `open.dolphin.session`: `7`
- `open.dolphin.orca.sync`: `5`
- `open.dolphin.security.audit`: `4`
- `open.dolphin.orca.push`: `4`
- `open.dolphin.persistence.query`: `4`
- `open.dolphin.shared.converter`: `4`
- `open.orca.rest`: `1`

## Lane Residues

### Lane A

- Count: `1`
- Remaining class:
  - `open.orca.rest.OrcaMasterKensaSortQueryService`
- Remaining bug family:
  - `SQL_PREPARED_STATEMENT_GENERATED_FROM_NONCONSTANT_STRING`: `1`

### Lane B

- Count: `35`
- Dominant family:
  - `EI_EXPOSE_REP2`: `35`
- Main residue:
  - remaining converter `setModel()` direct-assignment pattern
  - remaining shared converter direct-assignment pattern (`IKarteNumber`, `IPatientList`, `IRoleModel`, `IVisitPackage`)

### Lane C

- Count: `55`
- Main families:
  - `RCN_REDUNDANT_NULLCHECK_OF_NONNULL_VALUE`: `15`
  - `NP_NULL_PARAM_DEREF`: `12`
  - `EI_EXPOSE_REP`: `8`
  - `EI_EXPOSE_REP2`: `5`
- Main classes:
  - `open.dolphin.orca.service.DefaultOrcaLiveGateway`: `23`
  - `open.dolphin.orca.push.dto.OrcaPushEnvelope`: `2`
  - `open.dolphin.orca.sync.OrcaPatientSyncService`: `2`
  - `open.dolphin.orca.transport.OrcaTransportRegistry`: `2`

### Lane D

- Count: `23`
- Main families:
  - `EI_EXPOSE_REP2`: `2`
  - `RCN_REDUNDANT_NULLCHECK_OF_NONNULL_VALUE`: `2`
  - `NP_NULL_ON_SOME_PATH`: `2`
  - `NP_BOOLEAN_RETURN_NULL`: `1`
- Main classes:
  - `open.dolphin.rest.OperationsReadinessEvaluator`: `3`
  - `open.dolphin.rest.orca.OrcaPatientSyncResource`: `2`
  - `open.dolphin.security.audit.AuthoritativeAuditRepository`: `2`
  - `open.dolphin.rest.AdminMasterUpdateResource`: `1`
  - `open.dolphin.rest.AdminOrcaConnectionTestSupport`: `1`
  - `open.dolphin.rest.AdminOrcaUserSupport`: `1`
  - `open.dolphin.rest.BlockWrapper`: `1`
  - `open.dolphin.rest.LocalDiagnosisResource`: `1`
  - `open.dolphin.rest.LogFilter`: `1`
  - `open.dolphin.rest.PatientModV2OutpatientOrcaCoordinator`: `1`
  - `open.dolphin.rest.ReceptionRealtimeSseSupport`: `1`
  - `open.dolphin.rest.UserResource`: `1`
  - `open.dolphin.rest.orca.AbstractOrcaRestResource`: `1`
  - `open.dolphin.rest.orca.AbstractOrcaWrapperResource`: `1`
  - `open.dolphin.rest.orca.OrcaChartSupportSupport`: `1`
  - `open.dolphin.rest.orca.OrcaLiveDiseaseMasterResource`: `1`
  - `open.dolphin.rest.orca.OrcaSubjectiveResource`: `1`
  - `open.dolphin.security.audit.AuditTrailService`: `1`

## Next Wave Boundary

1. Lane B first:
   converter / shared.converter `setModel()` direct assignment residue is still the largest homogeneous cluster.
2. Lane C second:
   `DefaultOrcaLiveGateway` still dominates, but the problem space is now mostly nullability and a smaller expose-rep tail.
3. Lane D third:
   the targeted admin/rest/masterupdate/security.audit files are now clear; remaining lane D residue is concentrated in other support classes.
4. Lane A last:
   only the dynamic SQL builder finding remains and likely needs either a query-shape split or a deliberate design decision, not another broad cleanup.

## Commands Used

```bash
bash ./scripts/server-modernized/verify-static-analysis.sh

mvn -f pom.server-modernized.xml -pl server-modernized -am -DskipTests compile

ruby <<'RUBY'
require 'rexml/document'
path='server-modernized/target/static-analysis/spotbugs/spotbugs-opendolphin-server-modernized.xml'
doc=REXML::Document.new(File.read(path))
counts=Hash.new(0)
doc.elements.each('BugCollection/BugInstance'){|b| counts[b.attributes['type'].to_s]+=1 }
counts.sort_by{|k,v| [-v,k]}.each{|k,v| puts format('%3d %s', v, k)}
RUBY

ruby <<'RUBY'
require 'rexml/document'
path='server-modernized/target/static-analysis/spotbugs/spotbugs-opendolphin-server-modernized.xml'
doc=REXML::Document.new(File.read(path))
counts=Hash.new(0)
doc.elements.each('BugCollection/BugInstance') do |b|
  cls=b.elements['Class']&.attributes&.[]('classname')&.to_s || '(unknown)'
  pkg=cls.sub(/\.[^\.\$]+(?:\$.*)?$/, '')
  counts[pkg]+=1
end
counts.sort_by{|k,v| [-v,k]}.first(25).each{|k,v| puts format('%3d %s', v, k)}
RUBY
```

## Notes / Unknown

- `open.orca.rest.OrcaMasterKensaSortQueryService` の残 1 件は、現状の動的 JOIN/ORDER 形状のままでは smallest viable diff での解消が難しい。
- Lane B の converter residue は件数が多いが、設計パターンは単一であるため、次 wave では機械的にまとまって落とせる余地が大きい。
- Lane D の targeted file cluster は今回で消化できたため、次 wave は support/admin/orca の残クラスタへ集中できる。
- `reporting/target/static-analysis` は今回も baseline inventory の主対象には含めていない。

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
- Historical Wave 2 end baseline: `144`
- Historical Wave 1 start baseline: `329`

## Wave 3 Changes

- Lane A:
  - Reworked `open.orca.rest.OrcaMasterKensaSortQueryService` into an allowlisted query shape so the dynamic SQL tail no longer appears in the integrated baseline.
- Lane B:
  - Added `open.dolphin.converter.ModelCopySupport`.
  - Replaced direct assignment patterns in the remaining converter / shared.converter targets with defensive copies.
  - Cleared the Wave 2 residue of `35` `EI_EXPOSE_REP2` findings in `open.dolphin.converter` / `open.dolphin.shared.converter`.
- Lane C:
  - Closed `DefaultOrcaLiveGateway` nullability and redundant-null-check tails.
  - Added defensive copies to ORCA push DTOs, transport results, and session trace state.
  - Cleared the Wave 2 residue of `59` findings in ORCA live / push / transport / sync / session code.
- Lane D:
  - Removed nullable-Boolean helper tails in admin/masterupdate resources.
  - Fail-closed list parsing in `KarteResource` / `StampResource`.
  - Removed targeted masterupdate unread-state tails and defensive-copied `AuditChainVerifier.VerificationResult`.
  - Fixed `OrcaPatientSyncStateStoreIT` to keep `testCompile` green after the record-oriented changes.

## After Counts

- Canonical command result: `FAIL` at SpotBugs check
- Total findings: `35`
- Delta from Wave 3 start: `-109`
- Delta from Historical Wave 2 start: `-214`
- Delta from Historical Wave 1 start: `-294`

## Top Bug Families

- `EI_EXPOSE_REP2`: `8`
- `EI_EXPOSE_REP`: `5`
- `NP_BOOLEAN_RETURN_NULL`: `4`
- `RCN_REDUNDANT_NULLCHECK_OF_NONNULL_VALUE`: `3`
- `UPM_UNCALLED_PRIVATE_METHOD`: `3`
- `DLS_DEAD_LOCAL_STORE`: `2`
- `AT_STALE_THREAD_WRITE_OF_PRIMITIVE`: `1`
- `CT_CONSTRUCTOR_THROW`: `1`
- `DB_DUPLICATE_BRANCHES`: `1`
- `HSM_HIDING_METHOD`: `1`
- `IT_NO_SUCH_ELEMENT`: `1`
- `MS_EXPOSE_REP`: `1`
- `NM_SAME_SIMPLE_NAME_AS_INTERFACE`: `1`
- `NP_LOAD_OF_KNOWN_NULL_VALUE`: `1`
- `REC_CATCH_EXCEPTION`: `1`
- `URF_UNREAD_FIELD`: `1`

## Top Packages

- `open.dolphin.rest`: `13`
- `open.dolphin.rest.orca`: `7`
- `open.dolphin.persistence.query`: `4`
- `open.dolphin.orca.adapter`: `3`
- `open.dolphin.security.audit`: `3`
- `open.dolphin.orca.converter`: `1`
- `open.dolphin.runtime`: `1`
- `open.dolphin.runtime.config`: `1`
- `open.dolphin.security.integrity`: `1`
- `open.dolphin.security.totp`: `1`

## Lane Residues

### Lane A

- Count: `0`
- Status:
  - `open.orca.rest.OrcaMasterKensaSortQueryService` no longer appears in the canonical report.

### Lane B

- Count: `0`
- Status:
  - `open.dolphin.converter` / `open.dolphin.shared.converter` `EI_EXPOSE_REP2` residue is cleared.

### Lane C

- Count: `0`
- Status:
  - `DefaultOrcaLiveGateway` and the targeted ORCA live / push / transport / session files are cleared from the canonical report.

### Lane D

- Count: `27`
- Main packages:
  - `open.dolphin.rest`: `13`
  - `open.dolphin.rest.orca`: `7`
  - `open.dolphin.persistence.query`: `4`
  - `open.dolphin.security.audit`: `3`
- Remaining classes:
  - `open.dolphin.rest.OperationsReadinessEvaluator$ReadinessSnapshot`: `2`
  - `open.dolphin.rest.orca.OrcaPatientSyncResource`: `2`
  - `open.dolphin.security.audit.AuthoritativeAuditRepository$AuditWriteCommand`: `2`
  - `open.dolphin.persistence.query.KarteDocumentQueryService`: `1`
  - `open.dolphin.persistence.query.OrcaUserLinkQueryService`: `1`
  - `open.dolphin.persistence.query.PatientQueryService`: `1`
  - `open.dolphin.persistence.query.UserQueryService`: `1`
  - `open.dolphin.rest.AbstractResource`: `1`
  - `open.dolphin.rest.AdminMasterUpdateResource`: `1`
  - `open.dolphin.rest.AdminOrcaConnectionTestSupport`: `1`
  - `open.dolphin.rest.AdminOrcaUserSupport`: `1`
  - `open.dolphin.rest.BlockWrapper`: `1`
  - `open.dolphin.rest.LocalDiagnosisResource`: `1`
  - `open.dolphin.rest.LogFilter`: `1`
  - `open.dolphin.rest.OperationsReadinessEvaluator`: `1`
  - `open.dolphin.rest.PatientModV2OutpatientSupport$OrcaApiResult`: `1`
  - `open.dolphin.rest.ReceptionRealtimeSseSupport`: `1`
  - `open.dolphin.rest.UserResource`: `1`
  - `open.dolphin.rest.orca.AbstractOrcaRestResource`: `1`
  - `open.dolphin.rest.orca.AbstractOrcaWrapperResource`: `1`
  - `open.dolphin.rest.orca.OrcaChartSupportSupport`: `1`
  - `open.dolphin.rest.orca.OrcaLiveDiseaseMasterResource`: `1`
  - `open.dolphin.rest.orca.OrcaSubjectiveResource`: `1`
  - `open.dolphin.security.audit.AuditTrailService`: `1`

### Outside Lane Scope

- Count: `8`
- Main packages:
  - `open.dolphin.orca.adapter`: `3`
  - `open.dolphin.orca.converter`: `1`
  - `open.dolphin.runtime`: `1`
  - `open.dolphin.runtime.config`: `1`
  - `open.dolphin.security.integrity`: `1`
  - `open.dolphin.security.totp`: `1`
- Remaining classes:
  - `open.dolphin.orca.adapter.OrcaPatientAdapter$PatientUpsertCommand`: `1`
  - `open.dolphin.orca.adapter.OrcaPatientAdapter$ReceptionCommand`: `1`
  - `open.dolphin.orca.adapter.OrcaPatientAdapter$SearchResult`: `1`
  - `open.dolphin.orca.converter.OrcaXmlMapper$1`: `1`
  - `open.dolphin.runtime.RuntimeConfigurationSupport`: `1`
  - `open.dolphin.runtime.config.ServerConfigurationValidator`: `1`
  - `open.dolphin.security.integrity.DocumentIntegrityService`: `1`
  - `open.dolphin.security.totp.TotpSecretProtector`: `1`

## Next Wave Boundary

1. Lane D first:
   `rest` / `rest.orca` / `persistence.query` / `security.audit` is now the only large targeted cluster.
2. Outside-lane cleanup second:
   `orca.adapter`, `orca.converter`, `runtime*`, and `security.*` are small enough to split by concern instead of carrying them with Lane D.
3. Lane A/B/C are closed for this snapshot:
   reopen them only if new findings are introduced by later refactors.

## Commands Used

```bash
mvn -f pom.server-modernized.xml -pl server-modernized -am -DskipTests compile

bash ./scripts/server-modernized/verify-static-analysis.sh

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
  cls=b.elements['Class']&.attributes&.[]('classname')&.to_s
  pkg=cls.sub(/\.[^\.\$]+(?:\$.*)?$/, '')
  counts[pkg]+=1
end
counts.sort_by{|k,v| [-v,k]}.each{|k,v| puts format('%3d %s', v, k)}
RUBY
```

## Notes / Unknown

- Wave 3 achieved the targeted burn-down: `144 -> 35`.
- The canonical verify now fails only on the remaining `35` SpotBugs findings; compile and test-compile stay green in the integrated snapshot.
- The next wave can be run as two independent tracks:
  - targeted Lane D cleanup (`27`)
  - outside-lane residue cleanup (`8`)
- `reporting/target/static-analysis` is not part of this baseline inventory.

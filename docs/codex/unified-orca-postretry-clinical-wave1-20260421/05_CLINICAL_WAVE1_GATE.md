# 05. WO-3/WO-4 Clinical Input Wave 1 integration

## Source docset

Use the included clinical Wave 1 reference docs:

```text
references/clinical-input-wave1-20260421/
```

This unified docset does not replace the clinical docset; it stages it inside the ORCA postretry master plan.

## Scope boundary

Clinical Wave 1 verifies local/server/component/static behavior only.

Do not claim:

- live ORCA verified
- medicalmodv2 live mutation verified
- diseasev3 live mutation verified
- subjectivesv2 live mutation verified
- Phase 3/4 verified
- fullflow verified

Correct claim style:

```text
Verified by targeted local/server/component tests: clinical local persistence coverage improved.
Not verified: Playwright/e2e runtime, live ORCA mutation, Phase 3/4, fullflow.
```

## WO-3: batch 1

### CWP-01 integration base

Use reference:

```text
references/clinical-input-wave1-20260421/01_CWP01_INTEGRATION_GATE.md
```

Expected CWP-01 artifact hash if present:

```text
bb7d646646b474cb345e108f25dfa0e3fad2db5a13d55b7285d94d85096c26f2
```

Run targeted Maven gate:

```bash
mvn -f pom.server-modernized.xml -pl server-modernized -am \
  -Dsurefire.failIfNoSpecifiedTests=false \
  -Dtest=CanonicalOrderDocumentFixtureTest,KarteDocumentOrderModulePersistenceTest,KarteRevisionServiceBeanOrderModuleCloneTest,KarteRevisionSnapshotContractTest,KarteRevisionDocumentResponseJsonTest,KarteDocumentSnapshotContractTest,DocumentIntegrityServiceTest test
```

### CWP-05 disease date/readback

Use reference prompt:

```text
references/clinical-input-wave1-20260421/subagents/CWP05_DISEASE_DATE_READBACK_PROMPT.md
```

Core goals:

- disease/diagnosis local persistence
- yyyy-MM-dd validation
- invalid dates reject with concrete error
- add/edit/delete/outcome readback
- no live diseasev3 claim

### CWP-02 SOAP server reload

Use reference prompt:

```text
references/clinical-input-wave1-20260421/subagents/CWP02_SOAP_SERVER_RELOAD_PROMPT.md
```

Core goals:

- SOAP S/O/A/P/free text saved locally
- server reload/remount restores display
- partial failure dirty semantics
- no subjectivesv2 live call claim

## WO-4: batch 2

### CWP-04 generic order matrix

Use reference prompt:

```text
references/clinical-input-wave1-20260421/subagents/CWP04_GENERIC_ORDER_MATRIX_PROMPT.md
```

### CWP-03 prescription local flow

Use reference prompt:

```text
references/clinical-input-wave1-20260421/subagents/CWP03_PRESCRIPTION_LOCAL_FLOW_PROMPT.md
```

### CWP-06 document two-phase failure

Use reference prompt:

```text
references/clinical-input-wave1-20260421/subagents/CWP06_DOCUMENT_TWO_PHASE_FAILURE_PROMPT.md
```

## Merge order

1. CWP-01
2. CWP-05
3. CWP-02
4. CWP-04
5. CWP-03
6. CWP-06

## Acceptance matrices

Use:

```text
references/clinical-input-wave1-20260421/05_ACCEPTANCE_MATRIX.md
references/clinical-input-wave1-20260421/06_DADS_AND_ORCA_BOUNDARY.md
```

## Output directories

WO-3:

```text
docs/implementation/unified-clinical-wave1-batch1-wo3-20260421/
```

WO-4:

```text
docs/implementation/unified-clinical-wave1-batch2-wo4-20260421/
```

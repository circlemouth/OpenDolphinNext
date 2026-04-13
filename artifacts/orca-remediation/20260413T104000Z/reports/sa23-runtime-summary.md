# SA-23 Runtime QA Summary

- RUN_ID: `20260413T104000Z`
- Branch HEAD base: `1c8eb05309fe86671b67e4f0da31ccbc0d9f6ccf`
- Scope: runtime QA / evidence bundle / live fullflow
- Result: live fullflow did not reach `order save -> finish -> ORCA send`

## Stable Evidence Paths

- Runtime ready: `qa/runtime-ready/runtime-ready-result.json`
- Acceptmodv2: `qa/acceptmodv2/accept-summary.md`
- Fullflow: `qa/fullflow/summary.md`
- Candidate probes: `evidence/sa23-candidate-probes.json`
- Patient import probe: `evidence/sa23-patient-import-01423.json`
- DB patient inventory: `evidence/sa23-db-patient-inventory.tsv`
- Setup/runtime logs: `tests/setup-modernized-env.log`, `tests/runtime-ready-smoke.log`, `tests/qa-acceptmodv2-weborca.log`, `tests/qa-fullflow-weborca.log`

## Execution Outcome

1. `runtime-ready-smoke.mjs`
   - PASS
   - `scheduleKey` / `encounterKey` handoff itself is readable from `appointments/list` fallback and charts open succeeds.
   - However charts evidence still shows official send context missing for smoke patient.
   - Missing fields shown in UI evidence: `Department_Code`, `Physician_Code`, `Insurance_Combination_Number`

2. `qa-acceptmodv2-weborca.mjs`
   - FAIL as live candidate gate
   - Stable path `qa/acceptmodv2/` uses `QA_PATIENT_ID=01415`
   - `network/network.json` records `POST /api/orca/official/visits/mutation`
   - Response: `apiResult=16`, `apiResultMessage=診療科・保険組合せで受付登録済みです。二重登録疑い`

3. `qa-fullflow-weborca.mjs`
   - FAIL before charts handoff
   - Stable path `qa/fullflow/` uses `QA_PATIENT_ID=01415`
   - `steps.log` records `reception row status=not-found`
   - Fatal: `canonical charts handoff did not become available after accept`
   - `request-xml/medicalmodv2.xml` is absent because ORCA send step was never reached

## Hard Blockers

1. Test-data blocker
   - `evidence/sa23-candidate-probes.json` shows local-searchable patients in current facility are limited.
   - `01415` and `00005` are local-searchable, but both return `apiResult=16` on official visit mutation.
   - `01425`, `01423`, `01053`, `00511`, `00013`, `00012` are not local-searchable in current facility.

2. Repo-side defect
   - `evidence/sa23-patient-import-01423.json` shows `POST /openDolphin/api/orca/official/patients/import` returns 500.
   - Error message: `Session layer failure in open.dolphin.rest.orca.OrcaPatientSyncResource$Proxy$_$$_WeldSubclass#importPatients`
   - This blocks the obvious remediation path of importing an ORCA-side patient into the current facility before rerunning live fullflow.

3. External/upstream blocker
   - `qa/acceptmodv2/console.json`, `qa/fullflow/console.json`, and `tests/setup-modernized-env.log` show ORCA-side instability.
   - Browser runtime repeatedly receives `502 Bad Gateway` on `/api/orca/official/appointments/medical-information`.
   - Setup log also warns that the ORCA DB container is not present, so master/appointment dependent routes are not trustworthy in this environment.

## Supplementary Evidence

- `qa/acceptmodv2-01425-local-miss/`
  - explicit evidence that a non-local patient candidate fails before selection with `patient search returned no selectable result`
- `qa/acceptmodv2-01415-duplicate/`, `qa/fullflow-01415-duplicate/`
  - preserved original run directories before stable path normalization

## Conclusion

- Current merged branch can pass runtime-ready smoke for the canonical reception-to-charts read path.
- Current environment cannot prove live fullflow through `order save -> finish -> ORCA send`.
- The blocking combination is not a single issue:
  - local candidate shortage / duplicate registration in current facility
  - official patient import 500 on the repo side
  - repeated upstream 502 on appointment medical-information

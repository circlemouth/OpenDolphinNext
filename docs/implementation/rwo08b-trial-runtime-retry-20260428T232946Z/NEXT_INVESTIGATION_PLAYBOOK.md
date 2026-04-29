# RWO-08B Next Investigation Playbook

RUN_ID: `20260428T232946Z`

## Purpose

This playbook exists so the next worker can either unblock RWO-08B safely or prove that the remaining blocker is outside automation scope.

Target scope is WebORCA / ORCA Trial only. Production ORCA, S3/MinIO/object storage, raw ORCA bodies, raw patient or insurance details, credentials, HAR, traces, screenshots, videos, request XML, and raw network dumps are out of scope for committed evidence.

## Current State

The local Trial runtime blocker is resolved. `server-modernized-dev` now receives `OPENDOLPHIN_ENVIRONMENT=trial-local`, so the Trial-only runtime fallback can resolve WebORCA Trial settings when an old local encrypted ORCA connection record cannot be decrypted.

Fresh read-only Trial evidence still blocks diagnostic Fullflow:

- duplicate-blocked candidates `00001` and `00005` were excluded;
- fresh candidate discovery selected only non-duplicate candidate `00002`;
- exact read-only preflight for `00002` passed;
- selected target is `00002`, date `2026-04-29`, class `01`;
- selected acceptance row hash is `b3b3d7c1416f047abb6450023e575fa39f53ed1d8f804aef8cf3551d945a5ddb`;
- `acceptlstv2` selected target row is target-ready;
- `medicalgetv2` class `01` returned `apiResult=15`, `medicalReadyRowCount=0`;
- `visitptlstv2` `Request_Number=01` returned one sanitized row, `visitReadyRowCount=0`;
- `identifierPreflightReady=false`.

Diagnostic Fullflow is not authorized while these facts remain true.

## Why This Blocks Electronic Chart Fullflow

The chart workflow can prove local UI and persistence behavior separately, but ORCA-backed clinical Fullflow requires a server-derived official ORCA target identity. The wrapper requires read-only proof that the target acceptance can be tied to official visit or medical identifiers before any diagnostic order-send flow.

The missing proof is not the existence of the patient or acceptance row. Those are present. The missing proof is voucher / sequential / insurance identifier evidence from an official read-only source:

- accepted medical proof requires `Perform_Date`, `Department_Code`, `Sequential_Number`, and `Insurance_Combination_Number`;
- accepted visit proof requires matching patient, visit date, department, insurance combination, plus `Voucher_Number` and `Sequential_Number`.

Without one of those proof rows, a later Fullflow could appear to run while still lacking a safe, official target identity for the actual ORCA order-send path.

## Official Sources Already Checked

- `https://www.orca.med.or.jp/receipt/users/tec/api/acceptancelst.html`
- `https://www.orca.med.or.jp/receipt/users/tec/api/medicalinfo.html`
- `https://www.orca.med.or.jp/receipt/users/tec/api/visitpatient.html`

Current implementation already supports:

- `acceptlstv2` as server-derived selected target source;
- `medicalgetv2` class `01` as visit-history identifier source;
- `visitptlstv2` `Request_Number=01` as alternative read-only identifier source when the row matches the selected acceptance target.

## What External Research Can Still Do

External research may still unblock RWO-08B only if it finds a different official, read-only ORCA endpoint or official endpoint semantics that can safely prove the missing identifiers without raw artifacts.

Research targets:

- official API overview pages for endpoints related to visits, reception, claims, accounting, billing, or medical history;
- endpoint pages under `https://www.orca.med.or.jp/receipt/users/tec/api/`;
- official samples showing whether another read-only endpoint returns voucher number, sequential number, insurance combination number, and patient/date/department identity;
- official semantics for when `visitptlstv2` omits patient / voucher / sequential / insurance fields.

Record only sanitized research evidence:

- URL checked;
- checked date;
- endpoint and request class;
- fields or semantics relevant to identifier proof;
- whether it can be used without raw ORCA bodies;
- claim boundary.

Do not copy raw patient data, raw insurance data, credentials, raw ORCA bodies, or credential-bearing URLs.

## What External Research Cannot Do

External research cannot by itself create missing Trial business state. It cannot prove that current Trial target `00002` has voucher / sequential / insurance identifiers if the artifact-free read-only wrapper still reports:

- `medicalReadyRowCount=0`;
- `visitReadyRowCount=0`;
- `identifierPreflightReady=false`.

If no new official read-only proof source is found, the remaining blocker is Trial business/test-data setup.

## Safe Decision Tree

1. Re-read the latest evidence:
   - `docs/implementation/rwo08b-trial-runtime-retry-20260428T232946Z/summary.sanitized.json`
   - this playbook
   - `docs/implementation/automation-handoff/NEXT_WORKER_PROMPT.md`
2. If investigating specs, use official ORCA sources first and commit only sanitized no-live research evidence.
3. If a new official read-only proof source is found:
   - implement a narrow parser/sanitizer;
   - add unit tests proving raw fields are not exposed;
   - add wrapper evidence that the new source is read-only;
   - rerun artifact-free read-only target-readiness;
   - run diagnostic Fullflow only if `identifierPreflightReady=true` in the same run.
4. If no new official read-only proof source is found:
   - do not rerun diagnostic Fullflow;
   - carry forward the Trial business/test-data blocker;
   - continue the next independent safe roadmap item.
5. If a new non-duplicate Trial target setup path is proposed:
   - require a complete endpoint packet before any live mutation;
   - keep live mutation sequential and main-worker controlled;
   - require duplicate-live checkpoint, payload identity/hash, no-live wrapper result, parser/sanitizer result, runtime readiness, endpoint-specific success criteria, stop conditions, and sanitized evidence policy.

## Commands To Reproduce Current Read-Only State

Use only when the local dev/Trial runtime is already configured and secrets are supplied through the approved ignored runtime path. Do not print environment values.

```sh
set -a
. ./orca.env.local
set +a
docker compose -f docker-compose.modernized.dev.yml up -d server-modernized-dev
```

Start the web client only if a browser-based discovery or exact preflight script needs it:

```sh
cd web-client
set -a
. ../orca.env.local
set +a
npm run dev -- --host 127.0.0.1
```

Fresh candidate discovery excluding duplicate-blocked candidates:

```sh
RUN_ID=<RUN_ID> QA_EXCLUDED_PATIENT_IDS=00001,00005 node web-client/scripts/qa-weborca-candidate-discovery.mjs
```

Exact read-only preflight for the current non-duplicate candidate:

```sh
RUN_ID=<RUN_ID> QA_PATIENT_ID=00002 node web-client/scripts/qa-weborca-readonly-preflight.mjs
```

Artifact-free target-readiness wrapper:

```sh
RUN_ID=<RUN_ID> node web-client/scripts/qa-rwo08b-target-readiness.mjs \
  --execute-readonly \
  --sanitized-evidence-only \
  --disable-browser-artifacts \
  --candidate-discovery-summary <fresh-candidate-discovery-summary.json> \
  --exact-preflight-summary <fresh-readonly-preflight-summary.json> \
  --acceptance-date 2026-04-29 \
  --class 01 \
  --medical-get-class 01 \
  --target-row-hash b3b3d7c1416f047abb6450023e575fa39f53ed1d8f804aef8cf3551d945a5ddb \
  --artifact-dir artifacts/diagnostic-fullflow/<RUN_ID>/rwo08b-target-readiness
```

The wrapper must remain blocking unless it records `identifierPreflightReady=true`.

## Completion Criteria For Returning To Fullflow

Fullflow may be queued or run only after all of the following are true in the same run:

- WebORCA / ORCA Trial target only;
- non-duplicate target selected;
- exact read-only preflight accepted;
- target row hash matches the server-derived selected acceptance;
- `identifierPreflightReady=true`;
- ready proof source is stated as `medicalgetv2`, `visitptlstv2`, or a newly implemented official read-only source;
- no raw ORCA bodies, credentials, patient details, insurance details, HAR, trace, video, screenshot, request XML, or raw network dump is committed or packaged;
- diagnostic Fullflow artifact policy and stop conditions are recorded before execution.

## Non-Claims

This playbook does not claim diagnostic Fullflow success, Trial order-send business acceptance, production ORCA readiness, S3/object-storage readiness, rollback rehearsal, owner final GO/NO-GO/PENDING, or final release readiness.

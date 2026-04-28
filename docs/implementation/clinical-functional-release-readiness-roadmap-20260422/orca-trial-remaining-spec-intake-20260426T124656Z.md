# ORCA Trial remaining spec intake

- RUN_ID: `20260426T124656Z`
- Intake source: ChatGPT sanitized handoff report supplied to automation.
- Repo context reported by source: HEAD `ba180009b`; target areas `web-client/` and `server-modernized/`.
- ORCA scope: WebORCA / ORCA Trial only.
- Excluded from this intake: production ORCA, S3/MinIO/object-storage, credentials, raw ORCA request/response bodies, raw patient details, raw insurance details, HAR, trace, video, screenshots, and raw network artifacts.
- Live execution by this intake: none.

## Placement decision

This file belongs under `docs/implementation/clinical-functional-release-readiness-roadmap-20260422/` because it is roadmap evidence for remaining Trial-backed release-readiness work. `docs/implementation/automation-handoff/HANDOFF_STATE.json` records the machine-readable pointer and next actions for automation.

## Official source URLs named by source report

The source report named these public / official references. This intake does not copy protected content or raw ORCA bodies.

- ORCA API overview: `https://www.orca.med.or.jp/receipt/users/tec/api/overview.html`
- ORCA `medicalmodv2`: `https://www.orca.med.or.jp/receipt/users/tec/api/medicalmod.html`
- ORCA `medicationgetv2`: `https://www.orca.med.or.jp/receipt/users/tec/api/medicationgetv2.html`
- ORCA `masterlastupdatev3`: `https://www.orca.med.or.jp/receipt/users/tec/api/masterlastupdatev3.html`
- ORCA `subjectivesv2`: `https://www.orca.med.or.jp/receipt/users/tec/api/subjectives.html`
- ORCA `diseasev3`: `https://www.orca.med.or.jp/receipt/users/tec/api/diseasemod.html`
- ORCA `acceptmodv2`: `https://www.orca.med.or.jp/receipt/users/tec/api/acceptmod.html`
- ORCA radiology comment / body-part guidance: `https://www.orca.med.or.jp/receipt/users/tec/api/comment842-830-bui-api.html`
- ORCA manual auto-calculation guidance: `https://www.orca.med.or.jp/receipt/users/tec/claim/`
- ORCA manual self-pay / document-fee guidance: `https://www.orca.med.or.jp/receipt/users/tec/claim/`
- CLAIM implementation reference: `https://www.orca.med.or.jp/receipt/users/tec/claim/claim-implement.html`

## Priority order for next safe work

1. `RWO-06H` / injection / class `310`: add read-only master-validity checks with `medicationgetv2` and `masterlastupdatev3` before any live Trial attempt.
2. `RWO-06G` / base-charge / class `110`: use `acceptmodv2` `Request_Number=00` read-only inquiry to determine whether the Trial encounter is first-visit compatible.
3. `RWO-06F` / instruction / class `130`: prove disease, disease class, same-month duplicate state, department, insurance, and facility-type preconditions without storing raw patient or insurance detail.
4. `RWO-06K` / radiology / class `700`: prepare changed no-live identity `002000099 + 170027910 + 820181000`; do not send prior rejected identity unchanged.
5. `RWO-06I` / surgery / class `500`: prepare official-sample-style adjunct rows around `150003110`, or a separately justified fallback such as `150001010`, no-live only first.
6. `RWO-06J` / test / class `600`: investigate specimen, judgment fee, duplicate state, blood draw, and auto-calculation assumptions before any changed retry.
7. `subjectivesv2`, `diseasev3`, `RWO-07`, and fullflow: build wrapper / no-live preflight evidence before further live or integrated attempts.

## Live stop conditions carried forward

Stop rather than execute live Trial when any of the following applies:

- Surgery, test, or radiology payload identity is unchanged from a rejected v2 identity.
- `subjectivesv2` remains at HTTP `502` without a corrected wrapper/input contract.
- `diseasev3` remains at HTTP `400` without a corrected wrapper/input contract.
- `acceptmodv2` returns duplicate `Api_Result=16`; duplicate acceptance is not success and cannot be used as a canonical handoff.
- Document fee mapping depends on `LOCAL_OTHER`; current fail-closed behavior is valid until a human billing decision defines an ORCA self-pay `095` / `096` mapping.
- A candidate requires credentials, raw ORCA bodies, raw patient details, raw insurance details, production ORCA, or object storage.

## Common ORCA operation mapping

### `medicalmodv2`

- Endpoint: `POST /api21/medicalmodv2?class=01/02/03/04`.
- `class=01`: create / registration.
- `class=02`: delete; requires `Medical_Uid`.
- `class=03`: replace / update; requires `Medical_Uid`.
- `class=04`: outpatient append.
- `Api_Result=80` means middle-ended registration error (`中途終了データ登録エラー`).
- HTTP `200` and presence of an ORCA result code are not business success. Success requires `Medical_Uid` and completion evidence in sanitized form.

### `subjectivesv2`

- Endpoint: `/orca25/subjectivesv2?class=01/02`.
- Root request element: `subjectivesmodreq`.
- `class=01`: create.
- `class=02`: delete.
- No update operation is defined in the supplied report.
- Delete removes all matching sequence rows.
- HTTP `502` is classified as transport/input contract failure until wrapper/no-live evidence proves otherwise.

### `diseasev3`

- Endpoint: `/orca22/diseasev3`.
- Root request element: `diseasereq`.
- Normal create/update uses blank `Request_Number`.
- `Request_Number=01` is for deleted-disease deletion / resequence behavior, not normal create/update.
- Delete uses `Disease_OutCome=O` with exact match.
- HTTP `400` is classified as wrapper/input contract failure until corrected no-live evidence exists.

2026-04-28 refresh: RUN_ID `20260428T050947Z` aligned the current create-only wrapper with the official-source no-query/no-body-`Request_Number` contract. The live-readiness identity is now `request-absent/class-absent`; no live retry is authorized from this intake alone.

### `acceptmodv2`

- `Request_Number=01`: create.
- `Request_Number=02`: delete.
- `Request_Number=03`: update.
- `Request_Number=04`: state update.
- `Request_Number=00`: read-only inquiry.
- Duplicate `Api_Result=16` is not success. Success requires acceptance fields and canonical handoff evidence.

## Family-specific intake

### Injection / class `310`

- Primary candidate: procedure `130000510`, drug `620000012`, material `700000031`, and comment `0085001`.
- Add read-only `medicationgetv2` and `masterlastupdatev3` master-validity checks before live.
- Treat comment validity as unconfirmed until verified.
- Stop if comment, drug, material, route, or quantity cannot be validated no-live.

### Base charge / class `110`

- Primary candidate: `111000110`.
- It requires a first-visit-compatible Trial encounter.
- Use `acceptmodv2` `Request_Number=00` read-only inquiry to classify initial, revisit, and same-day state without storing raw patient/insurance detail.
- `112007410` belongs to class `120` in the source report and must not be used to satisfy class `110` without a separate design decision.

### Instruction / class `130`

- Primary candidate: `113001810`.
- Preconditions: target disease, clinic facility semantics, monthly duplicate state, department, and insurance context.
- `Disease_Class` values `05` / `08` may affect acceptance.
- Human billing decision is likely required before live.

### Surgery / class `500`

- Bare `150003110` is already rejected and must not be repeated unchanged.
- Official-sample-style changed identity likely needs adjunct rows such as anesthesia/material and a surgery-date comment.
- Fallback `150001010` still requires clinical context and no-live contract evidence.

### Test / class `600`

- `160000310` was rejected as the prior v2 identity; do not repeat unchanged.
- Investigate specimen, judgment fee, duplicate same-day or same-month state, blood draw, and ORCA auto-calculation behavior.
- Fallback `160008010` is not guaranteed and must be treated as a fresh no-live candidate, not as an accepted route.

### Radiology / class `700`

- Preferred changed identity: `002000099 + 170027910 + 820181000`.
- Do not send `170000410` first because ORCA may auto-calculate it.
- Explicit `170000410` is only a fallback after duplicate/auto-calculation behavior is controlled no-live.

### Document fee / local other

- ORCA self-pay `095` / `096` code families exist according to the supplied report.
- Current `LOCAL_OTHER` fail-closed handling remains valid.
- Mapping document fees to ORCA requires a separate human billing decision.

## RWO-07 / operation mapping

- `medicalmodv2`: `class=01` create, `class=03` update, `class=02` delete, `class=04` outpatient append.
- `diseasev3`: blank `Request_Number` create/update; `Disease_OutCome=O` delete.
- `subjectivesv2`: `class=01` create, `class=02` delete, no update.
- `acceptmodv2`: `Request_Number=01` create, `02` delete, `03` update, `04` state update, `00` read-only.

## Claim boundary

- This intake is sanitized evidence organization only.
- It is not live Trial acceptance evidence.
- It is not production ORCA readiness.
- It is not S3/MinIO/object-storage readiness.
- It is not patient, insurance, billing, or fullflow success evidence.
- It does not authorize live Trial execution without endpoint-specific no-live wrapper evidence, duplicate-live checkpoint, sanitized preflight, and applicable approval scope.

## Safety flags

- liveTrialExecutedByThisIntake=false
- productionOrcaUsed=false
- s3ObjectStorageTouched=false
- credentialsCaptured=false
- rawOrcaBodiesCaptured=false
- patientInsuranceDetailsCaptured=false
- rawArtifactsCommittedOrPackaged=false
- legacyClientServerChanged=false

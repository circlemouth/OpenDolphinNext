# ORCA Trial specification research intake

- RUN_ID: `20260426T212101Z`
- Intake source: user-supplied ORCA Trial Specification Research Report.
- Intake classification: sanitized secondary research; not live acceptance evidence.
- Placement purpose: automation/handoff/roadmap guidance for no-live/read-only ORCA Trial preflights.
- Live ORCA execution by this intake: none.

## Scope and exclusions

This intake records public-source-backed conclusions and stop-before-live rules only. It does not include ORCA credentials, raw ORCA request/response bodies, raw patient details, raw insurance details, screenshots, HAR, traces, videos, object-storage artifacts, production ORCA evidence, or live mutation evidence.

The report can guide future endpoint-specific no-live work, but it does not authorize live Trial execution. Any future live attempt still requires endpoint-specific wrapper evidence, sanitized preflight, duplicate-live checkpoint, business-success criteria, and applicable approval scope.

## Source references

| Ref | Source URL | Use in this intake |
|---|---|---|
| [1] | `https://www.orca.med.or.jp/receipt/users/tec/api/overview.html` | ORCA API endpoint taxonomy and the presence of `medicalmodv2` / `acceptmodv2` style API families. |
| [2] | `https://www.orca.med.or.jp/receipt/users/tec/api/medicalmod.html` | `medicalmodv2` operation context and request/response success-boundary cautions. |
| [3] | `https://orcamanual.orca.med.or.jp/gairai/chapter/2-6-5/` | Injection clinical class / row-shape context for `.310` / `.320` / `.330` style injection inputs. |
| [4] | `https://www.orca.med.or.jp/receipt/users/tec/api/medicationgetv2.html` | Medication master row lookup path; known 9-digit code lookup should use `Request_Number=02`. |
| [5] | `https://www.orca.med.or.jp/receipt/users/tec/api/master_last_update.html` | Master last-update API context; it is not row-level proof for a specific procedure/material/comment code. |
| [6] | `https://www.orca.med.or.jp/receipt/users/tec/api/acceptmod.html` | `acceptmodv2` `Request_Number=00` read-only inquiry and acceptance-state interpretation boundary. |
| [7] | `https://orcamanual.orca.med.or.jp/gairai/chapter/2-6-1/` | Base-charge / consultation-fee context for first-visit compatibility checks. |
| [8] | `https://medley.life/medicines/prescription/4490011F1048/` | Public medication reference for `620000012`; treated as oral-tablet evidence, not injection evidence. |
| [9] | `https://www.orca.med.or.jp/receipt/users/tec/claim.html` | CLAIM implementation boundary; do not infer business success from transport-only indicators. |
| [10] | `https://medley.life/medicines/prescription/1144400A2197/` | Public candidate identity reference for injectable candidate `620076111`; read-only proof still required. |
| [11] | `https://www.qlife.jp/meds/rx40569.html` | Public candidate identity reference for injectable candidate `620007539`; read-only proof still required. |

## Conclusions carried into automation

### RWO-06H injection row-level master preflight

- `620000012` is treated as an oral tablet identity (`アルジキサール錠10`) based on public medication reference [8]. It must not be retried unchanged as an injectable medication candidate.
- Injectable alternatives `620076111` and `620007539` are candidate identities only [10][11]. They are not accepted payload rows until read-only ORCA proof validates the specific row in the Trial environment.
- For known 9-digit medication codes, the read-only medication master lookup should use `medicationgetv2` with `Request_Number=02` [4].
- `masterlastupdatev3` / master last-update evidence is not specific row-level proof [5]. Procedure, material, and comment rows require row-specific proof or a clearly documented fallback that fails closed before live.
- `HTTP 2xx`, generic zero-like result classes, `other_present`, or any non-row-specific response must not be treated as master validity.

### RWO-06G base-charge RN00 parser / preflight repair

- `acceptmodv2` `Request_Number=00` remains the right read-only mechanism for acceptance-state inquiry [6].
- A read-only response is not first-visit compatibility by itself. Before `baseChargeOrder/110` live work, automation needs sanitized evidence for a unique active acceptance plus consultation-fee / first-visit-compatible fields [6][7].
- Patient-info-only, accounting-completed-only, revisit-only, or same-day revisit conditions must stop before live.
- Base-charge live work must not proceed from HTTP `2xx`, raw patient-info presence, or a generic zero-like result alone.

### RWO-08B / L4 fullflow preconditions

- L4 fullflow remains blocked unless the target is fresh, exactly one active acceptance is available, duplicates are absent, and server-derived official visit identifiers are present before send.
- Required official identifiers are `Insurance_Combination_Number`, `Voucher_Number`, and `Sequential_Number`. They must be obtained from server/ORCA state, not synthesized by the client or test harness.
- Candidates `00001` and `00005` must not be repeated unchanged. Duplicate `Api_Result=16`, missing canonical keys, or no active/keyed active row is not a success condition.

## No-live priority update

1. `RWO-06H_READONLY_INJECTABLE_MASTER_ROW_PROOF`: replace the rejected/oral medication identity with a candidate injectable identity only after no-live source review; then prove the medication row with `medicationgetv2 Request_Number=02`. Do not use `masterlastupdatev3` as row-level proof.
2. `RWO-06G_RN00_PARSER_PREFLIGHT_REPAIR`: repair or tighten the `acceptmodv2 Request_Number=00` parser/preflight so it requires active acceptance plus consultation-fee/first-visit-compatible fields before any base-charge live path.
3. `RWO-08B_L4_FULLFLOW_OFFICIAL_IDENTIFIER_PREFLIGHT`: select a fresh target and prove unique active acceptance, no duplicate state, and server-derived official identifiers before any diagnostic fullflow retry.

## Misuse cases and stop-before-live rules

| Misuse case | Required behavior |
|---|---|
| Treating an oral tablet code as an injectable medication because a prior payload shape passed no-live serialization. | Stop before live; require row-level medication proof with an injectable candidate. |
| Treating `masterlastupdatev3`, HTTP `2xx`, or a zero-like status as proof that a specific master row exists. | Stop before live; require row-specific evidence or a fail-closed no-live blocker. |
| Treating patient-info presence or accounting-completed acceptance data as first-visit compatibility for base charge. | Stop before live; require unique active acceptance and consultation-fee / first-visit-compatible fields. |
| Synthesizing official fullflow identifiers or reusing duplicate candidates `00001` / `00005`. | Stop before send; require server-derived official identifiers and a fresh non-duplicate target. |

## Claim boundary

- This intake is sanitized secondary research only.
- It is not live Trial acceptance evidence.
- It is not production ORCA readiness.
- It is not S3/MinIO/object-storage readiness.
- It is not patient, insurance, billing, rollback, fullflow, or final release readiness evidence.
- It does not authorize live Trial mutation or diagnostic fullflow retry by itself.

## Safety flags

- liveTrialExecutedByThisIntake=false
- productionOrcaUsed=false
- s3ObjectStorageTouched=false
- credentialsCaptured=false
- rawOrcaBodiesCaptured=false
- patientInsuranceDetailsCaptured=false
- diagnosticRawArtifactsCaptured=false
- rawArtifactsCommittedOrPackaged=false
- legacyClientServerChanged=false

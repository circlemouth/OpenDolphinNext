# ORCA Trial Send Results

RUN_ID: `20260514T020603Z`

## Candidate Discovery And Preflight

| Step | Result |
| --- | --- |
| candidate discovery | `candidateCount=11`, `acceptedCandidateCount=11`, exact preflight required |
| readonly preflight `00001` | `accepted`, `acceptedForPhase3Attempt=true`, mutation blocked requests `0` |
| readonly preflight `00002` | `accepted`, `acceptedForPhase3Attempt=true`, mutation blocked requests `0` |

## acceptmodv2

| Target | Result | Interpretation |
| --- | --- | --- |
| Trial candidate `00001` | `businessAcceptedWithWarnings`, C7 accepted, target mutation request count `1` | 受付登録は成功。warning付きであり、warningを通常成功と同一視しない。 |
| Trial candidate `00002` via fullflow | response observed, `apiResult=K3`, acceptance evidence present, encounter key present | 受付登録証跡はあるが、fullflow は Charts handoff 不足で停止。 |

## Fullflow

| Attempt | Result | Interpretation |
| --- | --- | --- |
| `00002` first fullflow | stopped after accept; canonical Charts handoff did not become available | UI / harness handoff blocker。オーダー保存、会計送信、ORCA send には進んでいない。 |
| `00002` rerun | stopped by disabled accept button: already accepted today | 二重受付防止は機能。再受付して突破しない。 |

## Phase4 medicalmodv2 Safe Wrapper

Dry-run:

| Workflow | Dry-run result |
| --- | --- |
| prescription | passed, no live ORCA traffic |
| treatment-generic | passed, no live ORCA traffic |
| instruction-charge | passed, no live ORCA traffic |
| base-charge | passed, no live ORCA traffic |
| injection | passed, no live ORCA traffic |
| surgery | passed, no live ORCA traffic |
| test-order | passed, no live ORCA traffic |
| radiology | passed, no live ORCA traffic |

Live execution for non-repeated candidates:

| Workflow | Live result | Interpretation |
| --- | --- | --- |
| instruction-charge | `transportRejected`, `businessAccepted=false` | 成功扱いしない。 |
| base-charge | `transportRejected`, `businessAccepted=false` | 成功扱いしない。 |
| injection | `transportRejected`, `businessAccepted=false` | 成功扱いしない。 |
| surgery | `transportRejected`, `businessAccepted=false` | 成功扱いしない。 |
| radiology | `transportRejected`, `businessAccepted=false` | 成功扱いしない。 |

Skipped live repeats:

- `prescription` and `treatment-generic`: prior accepted duplicate-live checkpoint exists; repeated live send is not allowed.
- `test-order`: prior accepted duplicate-live checkpoint exists; repeated live send is not allowed.
- Previously rejected checkpoint payloads were not repeated.

## Safety Result

- HTTP 200 alone was not used as success evidence.
- ORCA warning and transport rejection were not treated as successful accounting.
- `診療録確定`、`処方確定`、`ORCA送信`、`診察終了`、`会計送信`、`会計済み` were kept separate in the result classification.

## Follow-up Fix Pass: `20260514T031538Z`

| Step | Result | Interpretation |
| --- | --- | --- |
| candidate discovery | `candidateCount=11`, `acceptedCandidateCount=11` | exact readonly preflight still required before mutation. |
| readonly preflight `00003` | `accepted`, mutation blocked requests `0` | candidate was valid for controlled Trial operation. |
| runtime-ready smoke | first pass reached Charts and `診察開始`; later rerun classified `missing_today_entry_precondition` | smoke now distinguishes missing current-day chart-ready entry from ORCA connectivity failure. |
| fullflow `00005` | accepted via `acceptmodv2`, opened Charts from Reception row-level `カルテ`, no query leak, treatment order save `200` | fixed handoff path verified. |
| fullflow later steps | prescription fallback produced `fallback-error`; normal finish/send did not complete | not business accepted; remains QA harness/runtime follow-up. |

Phase4 wrapper classification now includes sanitized `rejectionCause` for `transportRejected` / `businessRejected` / `notVerified`, so endpoint failures can be separated from ORCA business acceptance without storing raw response bodies.

# Order-family v2 candidate research for ORCA Trial reachability

- RUN_ID: `20260425T215740Z`
- Target repository: `OpenDolphin_WebClient`
- Review environment note: this report was prepared from the provided review package; no live ORCA Trial execution was performed for this investigation.
- Scope: source-backed, no-live research for order-family `medicalmodv2` candidates only.
- Excluded: production ORCA, S3/MinIO/object-storage settings, credentials, raw ORCA request/response bodies, patient detail, insurance detail, and legacy `client/` / `server/` changes.

## Required documents read

- `docs/implementation/clinical-functional-release-readiness-roadmap-20260422/WORKPLAN_TO_RELEASE.md`
- `docs/implementation/clinical-functional-release-readiness-roadmap-20260422/REMAINING_WORK_BREAKDOWN.md`
- `docs/implementation/clinical-functional-release-readiness-roadmap-20260422/RELEASE_GATE_MATRIX.md`
- `docs/implementation/clinical-functional-release-readiness-roadmap-20260422/FUNCTIONAL_CLAIMS_BOUNDARY.md`
- `docs/implementation/automation-handoff/NEXT_WORKER_PROMPT.md`
- `docs/implementation/automation-handoff/HANDOFF_STATE.json`

Additional repo evidence consulted:

- `docs/implementation/rwo06-order-v2-candidate-research-20260424T210000Z/CANDIDATE_RESEARCH.md`
- `docs/implementation/rwo06f-instruction-charge-medicalmodv2-20260424T044803Z/summary.sanitized.json`
- `docs/implementation/rwo06f2-rwo06g-order-family-transition-20260424T050223Z/summary.sanitized.json`
- `docs/implementation/rwo06h-injection-medicalmodv2-20260424T052654Z/summary.sanitized.json`
- `docs/implementation/rwo06i-surgery-medicalmodv2-20260424T055036Z/summary.sanitized.json`
- `docs/implementation/rwo06j-test-order-medicalmodv2-20260424T055036Z/summary.sanitized.json`
- `docs/implementation/rwo06k-radiology-medicalmodv2-20260424T061549Z/summary.sanitized.json`
- `docs/implementation/rwo06f-rwo06g-rwo06h-v2-no-live-20260425T030245Z/summary.sanitized.json`
- `docs/implementation/rwo06j-test-order-v2-live-20260424T222329Z/summary.sanitized.json`
- `docs/implementation/rwo06k-radiology-v2-live-20260425T001701Z/summary.sanitized.json`
- `docs/implementation/rwo06i-surgery-v2-live-20260425T020245Z/summary.sanitized.json`
- Payload identities under `web-client/qa/payloads/phase4/medicalmodv2_*_trial_reachability_v*.json` were inspected only for sanitized code identity and class-family mapping. Raw payload bodies were not copied into this report.

## Public / official source URLs used

- ORCA API overview: `https://www.orca.med.or.jp/receipt/users/tec/api/overview.html`
- ORCA `medicalmodv2` 中途終了データ作成 specification: `https://www.orca.med.or.jp/receipt/users/tec/api/medicalmod.html`
- ORCA `medicalmodv2` comment / radiology body-part note: `https://www.orca.med.or.jp/receipt/users/tec/api/comment842-830-bui-api.html`
- 社会保険診療報酬支払基金 基本マスター index: `https://www.ssk.or.jp/seikyushiharai/tensuhyo/kihonmasta/`
- 社会保険診療報酬支払基金 医科診療行為マスター: `https://www.ssk.or.jp/seikyushiharai/tensuhyo/kihonmasta/kihonmasta_01.html`
- JP Core Procedure Codes Medical CodeSystem: `https://jpfhir.jp/fhir/core/terminology/ig/CodeSystem-JP_ProcedureCodesMedical_CS`
- 厚生労働省 NDB / 外来 dataset search-visible source for common test names: `https://www.mhlw.go.jp/content/12400000/001262147.xlsx`

## Source interpretation notes

- ORCA API overview lists 診療行為 `/api21/medicalmodv2` with `class=01` as 中途データ登録. This report only considers `Request_Number=01` / registration-shape candidates and does not consider delete/change/outpatient-add flows.
- The ORCA `medicalmodv2` spec defines `class=01` registration and shows `Medical_Information` / `Medication_info` rows; it also defines `Api_Result=80` as `中途終了データ登録エラー`. Therefore HTTP 200 alone is not business success.
- The same ORCA spec warns that diagnosis, department, doctor, comment, insurance, and master-code validation can affect registration. Candidate code existence is only a prerequisite, not acceptance evidence.
- SSK maintains current 医科診療行為マスター; the page reviewed was last updated 2026-04-17 and exposed a 2026-04-17 full master file. JP Core mirrors the SSK medical procedure code system but its rendered page is a fragment, so it is useful for visible common codes but not a complete master lookup.
- ORCA radiology body-part guidance says radiology payloads should include the body-part code and corresponding imaging body-part selection comment where applicable. It also describes auto-calculation behavior for the simple head X-ray example.

## Existing rejected evidence summary

The table below intentionally omits Trial credentials, target patient details, insurance details, raw ORCA bodies, and full duplicate checkpoint keys. `Api_Result=80` is noted only where the sanitized evidence explicitly recorded it.

| Family | Class | v1 payload identity | v1 sanitized result | v1 rejection reason / next boundary | v2 state already in repo |
|---|---:|---|---|---|---|
| `instractionChargeOrder` / 指導料 | 130 | `medicalmodv2_instruction_charge_trial_reachability_v1.json`, sha `8b9ec7db74971f7c567945c75bee7ad1fa3cbbaba97c2f8a689c2a1f0c9af64e`, code `112007410` | live executed once; HTTP 200; `businessRejected`; nonzero business rejection | v1 code is a 再診料 code in public code sources and appears mismatched for class 130. Do not repeat unchanged v1. | v2 `113001810`, sha `043c2a657746820a96950d6c05e2179d65040123d677a028e9ab86bc9af98858`, no-live dry-run pass only; live not run; blocked until Trial disease/facility/monthly billing context is established. |
| `baseChargeOrder` / 基本診療料 | 110 | `medicalmodv2_base_charge_trial_reachability_v1.json`, sha `d2db1ff2ad68174bcb236498786c87a8fffa0879917712c7ca639aa2732b9d93`, code `110000110` | live executed once; HTTP 200; `businessRejected`; nonzero business rejection | v1 identity rejected. Do not repeat unchanged v1. Class 110 live retry depends on a Trial encounter state where first-visit billing is valid. | v2 `111000110`, sha `4c092e032dd6f56eb5542ad65b2b6b28a8e1c1c802900f83e795dbbdba7a403a`, no-live dry-run pass only; live not run; precondition is Trial encounter state allowing first-visit billing. |
| `injectionOrder` / 注射 | 310 | `medicalmodv2_injection_trial_reachability_v1.json`, sha `c01169729cb86d1c68211e4b01f6c38bf3dde0ac948100c53855ec91f1b9010e`, codes `620000012 + 700000031 + 0085001` | live executed once; HTTP 200; `businessRejected`; nonzero business rejection | v1 appears to lack a clear injection procedure-fee row. Do not repeat unchanged v1. | v2 `130000510` plus existing medication/material/comment rows, sha `1af0b23246e8f9ee79879b28a09888ecc719ec8f6381e2b798cd63fa020e3300`, no-live dry-run pass only; live not run. |
| `surgeryOrder` / 手術 | 500 | `medicalmodv2_surgery_trial_reachability_v1.json`, sha `23441f818148820c2b1364c6a7424b1255995738cd05fa35e1328f41db96c000`, codes `150000001 + 700000031 + 0085001` | live executed once; HTTP 200; `businessRejected`; nonzero business rejection | v1 rejected. Do not repeat unchanged v1. | v2 `150003110`, sha `f7fbb890b62b7211b47c2672e85f0e70acbcdee18c9cbe9d7ea24c7942bbaa0e`, no-live pass then live once; HTTP 200; `Api_Result=80`; `businessRejected`. Do not repeat unchanged v2. |
| `testOrder` / 検査 | 600 | `medicalmodv2_test_order_trial_reachability_v1.json`, sha `b4fd3a422ac38f51b73a2fb2a56d07e2418339878f9451a6d73eb185bbd334d2`, codes `160000010 + 160000011 + 008200001` | live executed once; HTTP 200; `businessRejected`; nonzero business rejection | v1 rejected. Do not repeat unchanged v1. | v2 `160000310`, sha `35f787437641e3aa16981465f62277ad9d080de0d93b8c105d5a63f43a3df9d9`, no-live pass then live once; HTTP 200; `Api_Result=80`; `businessRejected`. Do not repeat unchanged v2. |
| `radiologyOrder` / 画像診断 | 700 | `medicalmodv2_radiology_trial_reachability_v1.json`, sha `d4dede12f9c7a43ab3c20bf972ef35a44ef0a33411e91a22429e85e985004f9e`, codes `002001 + 170017510 + 700000001 + 0085001` | live executed once; HTTP 200; `businessRejected`; nonzero business rejection | v1 rejected. Do not repeat unchanged v1. | v2 `002000099 + 170027910`, sha `ba41ca8d029b362d197361def1653a334ea27032935a6979298548465df4d436`, no-live pass then live once; HTTP 200; `Api_Result=80`; `businessRejected`. Do not repeat unchanged v2. |

## Family-by-family v2 candidate table

### 1. `instractionChargeOrder` / 指導料 / class `130`

| Priority | Candidate code(s) | Name | Expected class | Required accompanying information | Notes / risk | Recommended next no-live action | Source URL |
|---:|---|---|---:|---|---|---|---|
| 1 | `113001810` | 特定疾患療養管理料（診療所） | 130 | Disease context that makes the management fee billable; facility type must match clinic semantics; monthly / same-month duplication state must be checked. | Already prepared as v2 and no-live passed. Not live-accepted evidence. Trial live should remain blocked until disease/facility/monthly context is explicitly established. | Keep as the main v2 candidate, but perform a no-live contract check that records the required disease/facility/monthly preconditions and rejects live if they are not satisfied. | `https://jpfhir.jp/fhir/core/terminology/ig/CodeSystem-JP_ProcedureCodesMedical_CS` |
| 2 | `113000310` | ウイルス疾患指導料１ | 130 | Disease and clinical context for virus-disease guidance. | Source-backed class-130-area code, but less generic than `113001810`; may require even narrower disease context. | Research-only fallback. Do not build live candidate until a Trial disease context is documented no-live. | same as above |
| 3 | `113000410` | 特定薬剤治療管理料１ | 130 | Drug therapy / management context and likely related medication or disease state. | Source-backed code, but not a simple smoke candidate because billing depends on clinical circumstances. | Research-only fallback; no live attempt without human billing decision and wrapper no-live checks. | same as above |

Recommendation: prioritize `113001810` only if the next worker can establish disease/facility/monthly billing context without exposing raw patient or insurance detail. Otherwise keep class 130 blocked as a business / Trial data decision.

### 2. `baseChargeOrder` / 基本診療料 / class `110`

| Priority | Candidate code(s) | Name | Expected class | Required accompanying information | Notes / risk | Recommended next no-live action | Source URL |
|---:|---|---|---:|---|---|---|---|
| 1 | `111000110` | 初診料 | 110 | Trial encounter state that permits first-visit billing; first/revisit fee row ordering must be contract-checked; duplicate same-day state must be checked. | Already prepared as v2 and no-live passed. Live not run. It should not be sent unless the encounter state really allows first-visit billing. | Keep as the only class-110 v2 candidate. Stop live if the target encounter is not first-visit-compatible. | `https://jpfhir.jp/fhir/core/terminology/ig/CodeSystem-JP_ProcedureCodesMedical_CS` |

Non-candidate note: `112007410` is 再診料 and ORCA’s sample places it under class `120`, not class `110`; it should not be used to satisfy the class-110 `baseChargeOrder` target unless the family/class mapping itself is changed by a separate design decision.

### 3. `injectionOrder` / 注射 / class `310`

| Priority | Candidate code(s) | Name | Expected class | Required accompanying information | Notes / risk | Recommended next no-live action | Source URL |
|---:|---|---|---:|---|---|---|---|
| 1 | `130000510` + existing v2 medication/material/comment rows | 皮内、皮下及び筋肉内注射（１回につき） | 310 | A master-valid injectable medication row, valid quantity, optional material row if required, and route semantics that match subcutaneous/intramuscular injection. | Already prepared as v2 and no-live passed. Live not run. The procedure-fee row is source-backed; the drug/material pair still needs no-live master validation. | Use as the primary next no-live payload candidate. Before live, verify medication/material code validity and wrapper XML ordering. | `https://jpfhir.jp/fhir/core/terminology/ig/CodeSystem-JP_ProcedureCodesMedical_CS` |
| 2 | `130003510` | 静脈内注射（１回につき） | 310 | IV-compatible injectable medication, quantity, and route; avoid using if existing medication row is not appropriate. | Source-backed fallback if the medication in the current test fixture is better suited to IV injection than subcutaneous/intramuscular. | Research-only fallback; build separate payload identity and no-live wrapper evidence if chosen. | same as above |
| 3 | `130009310` | 点滴注射（その他の場合）（入院中の患者以外の患者に限る）（１日につき） | 310 | Outpatient context, infusion volume/time assumptions, drug/solution rows. | Higher billing-dependency risk than simple injection. | Do not prioritize for smoke reachability unless `130000510` cannot be justified. | same as above |

Recommendation: `130000510` is the strongest v2 candidate because it is source-backed, already no-live-prepared, and has not yet been live-rejected. Do not move to live until the medication/material/comment rows pass no-live master and contract checks.

### 4. `surgeryOrder` / 手術 / class `500`

| Priority | Candidate code(s) | Name | Expected class | Required accompanying information | Notes / risk | Recommended next no-live action | Source URL |
|---:|---|---|---:|---|---|---|---|
| 1 | Changed identity based on `150003110` plus official-sample-style adjuncts such as local anesthetic row and surgery-day comment, if no-live validates them | 皮膚、皮下腫瘍摘出術（露出部）（長径２センチメートル未満） | 500 | Local anesthetic / material if required by fixture; surgery-day comment if required; no duplicate same-day surgery state. | The bare `150003110` v2 has already been live-rejected with `Api_Result=80`; do not repeat the same sha. ORCA’s own sample uses this procedure with additional rows, so a changed identity may be worth no-live testing. | Prepare a changed no-live candidate only if wrapper checks can express the official sample row structure without raw bodies. | `https://www.orca.med.or.jp/receipt/users/tec/api/medicalmod.html`; `https://jpfhir.jp/fhir/core/terminology/ig/CodeSystem-JP_ProcedureCodesMedical_CS` |
| 2 | `150001010` | 創傷処理（筋肉、臓器に達しないもの（長径５センチメートル未満）） | 500 | Wound context and any required comment/material assumptions. | Source-backed simpler surgery/procedure candidate. Still requires clinical context and may not be accepted by arbitrary Trial state. | Use as fallback v3 candidate after no-live contract check; never reuse old v1/v2 sha. | `https://jpfhir.jp/fhir/core/terminology/ig/CodeSystem-JP_ProcedureCodesMedical_CS` |
| 3 | `150003210` | 皮膚、皮下腫瘍摘出術（露出部）（長径２センチメートル以上４センチメートル未満） | 500 | Tumor removal context and size assumption. | Similar dependencies to `150003110`; not better for smoke unless a size-specific test context is documented. | Lower-priority research fallback. | same as above |

Recommendation: do not repeat `150003110` bare v2. Next no-live should either convert it into a changed official-sample-style payload identity or use `150001010` as a simpler fallback after contract checks.

### 5. `testOrder` / 検査 / class `600`

| Priority | Candidate code(s) | Name | Expected class | Required accompanying information | Notes / risk | Recommended next no-live action | Source URL |
|---:|---|---|---:|---|---|---|---|
| 1 | Changed identity around `160000310` | 尿中一般物質定性半定量検査 / 尿一般 | 600 | Test context; duplicate same-day state; judgment-fee behavior if ORCA auto-calculates or requires a companion row in this Trial context. | `160000310` v2 was already live-rejected with `Api_Result=80`; the code remains a source-backed common test, but the same payload sha must not be repeated. | Investigate why the prior v2 returned `Api_Result=80` no-live. Retry only with a changed business precondition or payload identity and focused no-live verification. | `https://www.mhlw.go.jp/content/12400000/001262147.xlsx`; `https://ftp.orca.med.or.jp/pub/data/mican/download/rinsyo_kensa_sample_2014-08-25.csv` |
| 2 | `160008010` | 末梢血液一般検査 | 600 | Blood test context; potential judgment-fee and specimen assumptions. | Source-visible common test from MHLW NDB search results, but not yet represented in repo no-live evidence. | Research-only fallback; build fresh no-live payload identity if `160000310` cannot be made contract-clean. | `https://www.mhlw.go.jp/content/12400000/001262147.xlsx` |

Recommendation: keep `160000310` as the best-known common test, but no live retry is justified until the `Api_Result=80` cause is narrowed no-live. A changed payload identity might need explicit handling of judgment-fee/auto-calculation assumptions.

### 6. `radiologyOrder` / 画像診断 / class `700`

| Priority | Candidate code(s) | Name | Expected class | Required accompanying information | Notes / risk | Recommended next no-live action | Source URL |
|---:|---|---|---:|---|---|---|---|
| 1 | Changed identity `002000099 + 170027910 + 820181000` | 頭 + 単純撮影（デジタル撮影） + 撮影部位（単純撮影）: 頭部 | 700 | Body-part code, imaging fee, and explicit body-part selection comment; auto-calculated diagnostic fee behavior must be understood. | Existing v2 used `002000099 + 170027910` and was live-rejected with `Api_Result=80`. ORCA guidance shows the same pair with `820181000` comment and notes auto-calculation of `170000410`. | Prepare changed no-live candidate with explicit `820181000` comment and wrapper contract checks for body-part/comment ordering; do not repeat existing v2 sha. | `https://www.orca.med.or.jp/receipt/users/tec/api/comment842-830-bui-api.html` |
| 2 | `002000099 + 170027910 + 170000410 + 820181000` | 頭 + 単純撮影（デジタル撮影） + 単純撮影(イ)の写真診断 + 撮影部位 comment | 700 | Same as above, but diagnostic fee is explicitly sent instead of relying only on auto-calculation. | ORCA guidance shows both an auto-calculation pattern and a pattern where `170000410` is also set. Risk: explicit fee could duplicate auto-calculated behavior depending on Trial setup. | Lower-priority no-live-only fallback; reject if duplicate diagnostic fee risk cannot be controlled. | same as above |

Recommendation: radiology should move next to no-live changed-identity work, not live. The strongest candidate is the ORCA-documented head simple X-ray with explicit selection comment.

## Recommended priority order

1. `injectionOrder/310`: `130000510` v2 is source-backed, no-live-prepared, and not yet live-rejected. It is the cleanest next no-live-to-live candidate, provided medication/material rows are master-valid.
2. `baseChargeOrder/110`: `111000110` v2 is source-backed and no-live-prepared, but live must stop unless first-visit encounter state is proven without exposing patient/insurance detail.
3. `instractionChargeOrder/130`: `113001810` v2 is source-backed and no-live-prepared, but live must stop unless disease/facility/monthly context is proven.
4. `radiologyOrder/700`: prepare changed no-live identity `002000099 + 170027910 + 820181000`; existing v2 is already businessRejected and must not be repeated.
5. `surgeryOrder/500`: prepare changed no-live identity around the official-sample-style `150003110` rows or fallback to `150001010`; existing bare v2 is already businessRejected and must not be repeated.
6. `testOrder/600`: keep `160000310` as a source-backed common test, but investigate `Api_Result=80` no-live before any changed retry; unchanged v2 is forbidden.

## No-live verification prerequisites for next worker

The next implementation/verification worker should satisfy these before any live Trial attempt:

1. Candidate identity
   - Use a new payload sha for any family whose v1/v2 was businessRejected.
   - Record only sanitized identity: family, class, candidate code(s), payload path, sha256, request number, class code, and attempt number.
   - Do not record credentials, auth/session tokens, patient details, insurance details, or raw request/response bodies.
2. Contract check
   - Confirm `Request_Number=01` and `classCode=01` only.
   - Confirm `Medical_Information` class matches family: 130, 110, 310, 500, 600, or 700.
   - Confirm `Medication_info` row order and `Medication_Number` handling.
   - Confirm local-only fields remain stripped.
   - Confirm no `Request_Number` 02/03/04 delete/change/outpatient-add behavior is introduced.
3. Wrapper check
   - JSON validation / schema check passes.
   - XML construction or wrapper serialization test passes for the selected family.
   - Wrapper dry-run uses no live ORCA action.
   - Runtime readiness checks, if run, store no raw health/readiness body.
4. Family-specific no-live checks
   - Instruction: disease/facility/monthly billing precondition explicitly documented; stop if absent.
   - Base: first-visit encounter state explicitly documented; stop if absent.
   - Injection: medication/material code validity and quantity semantics checked.
   - Surgery: adjunct local anesthetic/comment requirements checked if using official-sample-style identity.
   - Test: duplicate/judgment-fee/autocalculation assumptions checked before changing `160000310` retry.
   - Radiology: body-part code + imaging code + `820181000` comment ordering checked; auto-calculated `170000410` behavior explicitly handled.
5. Duplicate-live checkpoint
   - Check prior sanitized duplicate-live records by family, request number, class code, target, and payload sha without displaying target detail.
   - Stop if the candidate payload sha equals a known businessRejected sha and no changed business precondition exists.
6. Artifact hygiene
   - Focused secret scan must pass with zero hits.
   - Forbidden artifact scan must pass with zero hits.
   - Raw artifacts must not be committed or packaged.

## Stop conditions before live Trial

Stop and do not attempt live Trial if any of the following is true:

- Candidate is identical to a previously businessRejected v1/v2 payload sha.
- Candidate relies only on HTTP 200 reachability or public master existence as success evidence.
- Required disease, encounter, facility, monthly, route, body-part, or judgment-fee context is unknown.
- No-live wrapper dry-run or serialization check fails.
- Runtime readiness is unavailable or would require storing raw health/readiness bodies.
- Any credential, auth/session token, patient detail, insurance detail, or raw ORCA request/response body would need to be displayed or stored.
- Any S3, MinIO, or object-storage setting/credential becomes part of the task.
- The worker cannot produce a sanitized duplicate-live checkpoint and attempt-number plan.

## Claim boundary

- This research is not live acceptance evidence.
- This research is not production ORCA readiness.
- This research is not S3/object-storage readiness.
- This research is not fullflow/L4 success.
- This research does not make any final release readiness or release GO claim.
- Existing v2 live rejections for `testOrder/600`, `radiologyOrder/700`, and `surgeryOrder/500` remain blockers until changed no-live evidence plus changed live preconditions are produced.
- Existing v2 no-live preparation for `instractionChargeOrder/130`, `baseChargeOrder/110`, and `injectionOrder/310` is useful but not Trial business acceptance.

## Safety flags

- liveTrialExecutedByThisInvestigation=false
- credentialsCaptured=false
- rawArtifactsCommittedOrPackaged=false
- productionOrcaUsed=false
- s3ObjectStorageTouched=false
- legacyClientServerChanged=false

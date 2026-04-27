# ChatGPT research intake validation

RUN_ID: `20260427T125006Z`

## Result

`CHATGPT_RESEARCH_INTAKE_VALIDATED_FOR_NO_LIVE_WORK_ORDERS`

The owner supplied ChatGPT research responses for:

- `RWO-08B` fresh fullflow target absence.
- ORCA Trial business rejections across blocked endpoint/order families.

This intake validates the responses as sufficient to drive follow-up no-live/read-only Work Orders, with corrections and safety boundaries. It does not authorize live Trial retry, fullflow execution, production ORCA, S3/object-storage setup, or raw artifact capture.

## Validation Verdict

The gathered information is sufficient for follow-up automation to proceed with safe repo-local and read-only diagnostics.

It is not sufficient to claim:

- RWO-08B resolution.
- A fresh fullflow target.
- exact selected-candidate preflight acceptance.
- Phase 3 / Phase 4 / fullflow execution.
- ORCA Trial business acceptance for blocked families.
- final release readiness.

## Accepted Findings

### RWO-08B

The interpretation of `local_exact_match_missing` is accepted as a blocker diagnosis, not a Trial-patient absence claim.

Repo verification confirmed that:

- `qa-weborca-candidate-discovery.mjs` and `qa-weborca-readonly-preflight.mjs` produce `local_exact_match_missing` when local exact match count is zero.
- `summarizeLocalSelectableDiagnostic` currently collapses several local failure modes into one coarse reason.
- `LocalPatientSearchResource` performs local patient search under the actor facility.
- `OrcaPatientSyncRunner` uses `patientlst1v2` / `patientlst2v2` sync planning, cursor state, date windows, and `includeTestPatient` settings.

The next useful automation task is therefore to split `local_exact_match_missing` into a safer diagnostic taxonomy without changing production behavior or running mutation.

### ORCA Trial Business Rejections

The ORCA business rejection research is accepted as no-live guidance. Official-source checks support the broad conclusions:

- `patientgetv2` is a GET patient-basic-info read path.
- `medicationgetv2` `Request_Number=01` and `02` have different meanings: RN01 is input-code / master lookup, RN02 is selectable-comment lookup for a 9-digit medical code.
- `medicalmodv2` documents `80` as intermediate-data registration error and `90` as other-terminal / lock condition.
- `diseasev3`, `subjectivesv2`, `acceptmodv2`, and `medicalmodv2` mutation paths require endpoint-specific contracts and cannot be retried from this research alone.

## Corrections Before Adoption

| Research statement | Intake correction |
|---|---|
| Subagents should be `gpt-5.4-high`. | Do not encode model-specific subagent requirements in repo Work Orders. Follow current runtime/developer/AGENTS rules. |
| Local import/sync may be needed. | Automation may inspect sync status/cursor/config read-only, but must not execute import/sync to manufacture a fresh target without explicit owner/operator input. |
| ORCA business rejections have likely causes. | Treat causes as hypotheses until proven by sanitized no-live/read-only evidence. |
| `utm_source=chatgpt.com` source URLs. | Normalize to official ORCA URLs only in committed evidence. |
| Candidate discovery accepted count. | Candidate discovery alone remains non-authoritative and must not authorize Phase 3/fullflow. |

## Next Work Order Priority

1. `RWO-08B_LOCAL_EXACT_MATCH_DIAGNOSTIC`
   - Highest priority because it directly addresses the fullflow blocker.
   - Scope: repo-local no-live taxonomy review plus optional read-only runtime diagnostics if already safe.

2. `RWO-06G_BASE_CHARGE_RN00_FIRST_VISIT_GATE`
   - Validate first-visit compatibility from read-only RN00 evidence before any `baseChargeOrder/110` live work.

3. `RWO-06H_INJECTION_RN01_RN02_SPLIT`
   - Split RN01 master-valid proof from RN02 selectable-comment proof so injection row proof is not overclaimed.

4. `RWO-06H_INJECTION_TARGET_FRESHNESS_READONLY`
   - Investigate fresh/lock-free target preconditions after the prior API result `90`.

5. `RWO-06F_INSTRUCTION_CHARGE_CONTEXT_READONLY`
   - Use disease / insurance / monthly-context read-only evidence before any `instractionChargeOrder/130` live work.

6. `RWO-06I_SURGERY_ROW_RULE_SPEC_RESEARCH`
   - Continue official-source no-live research for surgery row/adjunct semantics before another surgery payload identity.

## Preserved RWO-08B Detail From Owner-Supplied Research

The following details must be carried forward by later workers:

- `selectedCandidateAfterExclusion` must become non-null before any exact selected-candidate preflight, Phase 3, Phase 4, or fullflow work.
- `00001` and `00005` remain excluded as duplicate/no-active-entry blocked candidates and must not be reused by changing surrounding conditions.
- `00002` through `00011` currently need differential local diagnosis, not another blind candidate discovery pass.
- The local patient gate requires exactly one normalized target patient ID exact match; `recordsReturned >= 1` is not sufficient.
- Facility/session/import scope must be represented only as sanitized equality booleans or hashes.
- Candidate discovery alone must keep `candidateDiscoveryAloneAuthorizesPhase3=false`.
- If the only blocker is local sync/import freshness, automation must stop as owner/operator input required rather than executing import/sync to create a target.

Recommended RWO-08B diagnostic taxonomy:

- `local_absent`
- `local_prefix_only_nonexact`
- `local_id_format_mismatch_possible`
- `facility_scope_mismatch_possible`
- `sync_precondition_unknown`
- `ui_render_mismatch_possible`

Allowed RWO-08B runtime evidence, if a safe read-only path is already available, is limited to official exact-existence booleans, local `recordsReturned`, exact/nonexact counts, ID length/class/hash-only diagnostics, facility equality booleans/hashes, and mutation-route count.

## Preserved ORCA Business-Rejection Detail

Later workers must treat the ORCA Trial rejection findings as hypotheses requiring endpoint-specific no-live/read-only proof:

- `baseChargeOrder/110`: require `acceptmodv2` Request_Number `00` sanitized first-visit compatibility and a repo-local row-order contract that the consultation fee is the first row of the first set and not duplicated.
- `injectionOrder/310`: split `medicationgetv2` Request_Number `01` master-valid proof from Request_Number `02` selectable-comment proof; treat prior `Api_Result=90` as fresh/lock-free target unproven until read-only evidence says otherwise.
- `instractionChargeOrder/130`: require disease, disease-class, insurance, facility, and same-month context proof before any live work; owner/operator business context may be needed for facility or billing-rule judgment.
- `surgeryOrder/500`: official-sample-style rows are not business acceptance; require Trial-date master proof, adjunct/comment rationale, and changed identity before a retry can be considered.
- `subjectivesv2`: classify current `404` / `502` issues as transport or route-contract problems, not ORCA business rejection.
- `diseasev3`: keep as mutating and require endpoint-specific Request_Number and before-state contracts before any live mutation discussion.
- `acceptmodv2` Request_Number `02` / `03` / `04`: require server-derived `Acceptance_Id`, date/time, department, physician, insurance, and duplicate checkpoint inventory before any mutating use.
- Accepted test/radiology references are regression anchors and should be ledger-locked rather than resent.

## Additional Queue Candidates Preserved

The full research response also recommended these additional no-live/read-only or human-context queue candidates. They are not all higher priority than `RWO-08B_LOCAL_EXACT_MATCH_DIAGNOSTIC`, but they should remain visible for subsequent automation:

- `RWO-06F_OWNER_BUSINESS_CONTEXT`
- `RWO-06G_BASE_CHARGE_ROW_ORDER_CONTRACT`
- `RWO-06I_SURGERY_MASTER_ADJUNCT_PREFLIGHT`
- `SOAP_SUBJECTIVESV2_ROUTE_CONTRACT`
- `DISEASEV3_ENDPOINT_SEMANTICS_CONTRACT`
- `DISEASEV3_READONLY_BASELINE`
- `ACCEPTMODV2_RN02_03_04_TARGET_INVENTORY`
- `ACCEPTMODV2_RN02_03_04_STOP_GATE`
- `PHASE4_ACCEPTED_REFERENCE_LEDGER_LOCK`
- `GLOBAL_NO_RAW_EVIDENCE_POLICY_ENFORCEMENT`

No currently blocked family is live-retry-ready from the research alone.

## Immediate Active Handoff

The next worker should execute `RWO-08B_LOCAL_EXACT_MATCH_DIAGNOSTIC`.

This should:

- inspect current local selectable taxonomy;
- split `local_exact_match_missing` into actionable sanitized categories;
- inspect local search and sync preconditions;
- optionally run read-only diagnostics only if the existing runtime path is safe and does not capture raw artifacts;
- stop if resolving the blocker requires local import/sync execution, fresh Trial target provisioning, raw artifacts, or owner/operator business input.

## Claim Boundary

Allowed claim: ChatGPT research responses were validated and converted into safe no-live/read-only follow-up tasks.

Not claimed: RWO-08B resolution, fresh fullflow target, exact selected-candidate preflight acceptance, fullflow success, ORCA Trial business acceptance for blocked families, production ORCA readiness, S3/object-storage readiness, rollback rehearsal, owner final GO/NO-GO/PENDING, or final release readiness.

## Security Notes

- Credentials printed or captured: `false`
- Raw ORCA request/response bodies captured: `false`
- Raw patient/insurance details captured: `false`
- Diagnostic artifacts captured: `false`
- Raw artifacts committed or packaged: `false`
- Production ORCA attempted: `false`
- S3/MinIO/object-storage configuration requested or used: `false`

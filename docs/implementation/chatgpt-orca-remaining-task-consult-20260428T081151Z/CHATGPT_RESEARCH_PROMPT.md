# ChatGPT Research Prompt: ORCA Remaining Task Unblock Review

RUN_ID: `20260428T081151Z`

Use this prompt with the accompanying repository review package ZIP:

- `OpenDolphin_WebClient-review-package-curated-20260428T081151Z.zip`

## Role

You are an external senior release-readiness reviewer for OpenDolphinNext. Your job is to determine whether any currently blocked Trial-backed release-readiness tasks can be unblocked by specification research, repository inspection, safer no-live preflight design, or better classification.

Do not assume access to credentials, live ORCA Trial, production ORCA, S3/MinIO/object storage, raw diagnostic artifacts, or patient/insurance detail. Work only from the attached repository package and public official specifications.

## Required Safety Boundaries

- Do not request, infer, print, or fabricate ORCA credentials, cookies, session IDs, Authorization headers, CSRF values, S3/MinIO/object-storage values, raw patient data, raw insurance data, raw ORCA request/response bodies, HAR, traces, screenshots, videos, or raw network dumps.
- Do not propose production ORCA execution.
- Do not propose S3/MinIO/object-storage setup or dummy object-storage credentials.
- Do not treat HTTP 200, `Api_Result=00`, dry-run success, wrapper exit 0, read-only preflight, master freshness, or code validity as business success by itself.
- Do not authorize live mutation from research alone. Research may only justify repo-local tests, read-only probes, wrapper dry-runs, sanitized preflight packets, or a clearly bounded owner/operator question.
- Keep `RWO-11/RWO-09` rollback rehearsal, release-candidate stop, paired restore, restored-target smoke, operator acceptance, and final owner GO/NO-GO/PENDING as external owner/operator release-management gates unless explicit owner reassignment text is provided.

## Primary Repository Files To Inspect First

Inside the ZIP, inspect these files first:

1. `docs/implementation/automation-handoff/HANDOFF_STATE.json`
2. `docs/implementation/automation-handoff/NEXT_WORKER_PROMPT.md`
3. `docs/implementation/automation-handoff/AUTOMATION_THROUGHPUT_POLICY.md`
4. `docs/implementation/clinical-functional-release-readiness-roadmap-20260422/WORKPLAN_TO_RELEASE.md`
5. `docs/implementation/clinical-functional-release-readiness-roadmap-20260422/REMAINING_WORK_BREAKDOWN.md`
6. `docs/implementation/clinical-functional-release-readiness-roadmap-20260422/RELEASE_GATE_MATRIX.md`
7. `docs/runbooks/release-validation.md`
8. `docs/architecture/server-modernization-overview.md`
9. `web-client/README.md`
10. `web-client/scripts/qa-phase4-instruction-charge-preconditions.mjs`
11. `web-client/scripts/qa-phase4-injection-master-validity.mjs`
12. `web-client/scripts/qa-phase4-surgery-master-proof.mjs`
13. `web-client/scripts/qa-phase4-acceptmodv2-target-inventory.mjs`
14. `web-client/scripts/qa-phase4-acceptmodv2-operation.mjs`
15. `web-client/scripts/qa-fullflow-weborca.mjs`
16. `web-client/scripts/qa-lib/phase4-instruction-charge-preconditions-evidence.mjs`
17. `web-client/scripts/qa-lib/phase4-master-validity-evidence.mjs`
18. `web-client/scripts/qa-lib/phase4-medicalmodv2-safe-evidence.mjs`
19. `web-client/scripts/qa-lib/phase4-acceptmodv2-target-inventory-evidence.mjs`
20. `web-client/scripts/qa-lib/phase4-acceptmodv2-operation-evidence.mjs`
21. `web-client/scripts/__tests__/phase4InstructionChargePreconditionsEvidence.test.ts`
22. `web-client/scripts/__tests__/phase4MasterValidityEvidence.test.ts`
23. `web-client/scripts/__tests__/phase4Medicalmodv2SafeEvidence.test.ts`
24. `web-client/scripts/__tests__/phase4Acceptmodv2TargetInventoryEvidence.test.ts`
25. `web-client/scripts/__tests__/phase4Acceptmodv2OperationEvidence.test.ts`

Then inspect the latest relevant sanitized evidence directories referenced by `HANDOFF_STATE.json`, especially summaries for:

- `rwo06f-readonly-context-wrapper-gap-closure-20260428T073657Z`
- `rwo06f-no-live-precondition-packet-hardening-20260428T070626Z`
- `rwo06h-fresh-lock-free-target-preflight-20260427T091616Z`
- `rwo06i-surgery-v3-adjunct-master-proof-20260427T094613Z`
- `rwo08b-local-exact-match-diagnostic-20260427T135043Z` if present
- `acceptmodv2-target-inventory-parser-fix-20260427T231541Z`
- `acceptmodv2-rn020304-duplicate-preflight-20260428T000407Z`
- `acceptmodv2-rn02-server-derived-action-20260428T010135Z`

## Official Sources To Research

Prefer official ORCA sources first. Check and cite exact URLs and checked dates.

Start from:

- `https://www.orca.med.or.jp/receipt/tec/api/overview.html`
- `https://www.orca.med.or.jp/receipt/users/tec/api/medicalmod.html`
- `https://www.orca.med.or.jp/receipt/users/tec/api/medicationgetv2.html`
- `https://www.orca.med.or.jp/receipt/users/tec/api/masterlastupdatev3.html`
- `https://www.orca.med.or.jp/receipt/users/tec/api/diseasemod2.html`
- `https://www.orca.med.or.jp/receipt/users/tec/api/diseasegetv2.html`
- `https://www.orca.med.or.jp/receipt/users/tec/api/acceptance.html`
- `https://www.orca.med.or.jp/receipt/users/tec/api/acceptancelst.html`

If an endpoint has moved, use the official overview to locate the current endpoint page. Public or third-party sources may be used only as secondary leads and must be marked unconfirmed unless matched to official documentation.

## Current Remaining Tasks To Analyze

### 1. `RWO-06F_OWNER_BUSINESS_CONTEXT`

Current state:

- Human-pending after read-only evidence.
- The representative `instractionChargeOrder/130` candidate is not live-ready.
- Existing evidence says candidate code and some read-only statuses exist, but disease context, monthly duplicate context, department/insurance context, and owner/operator business context remain insufficient or not proven.

Questions:

- From official ORCA `medicalmodv2` and related docs, what specific class-130 / guidance-fee preconditions can be proven by no-live or read-only APIs?
- Is there an official read-only endpoint or request class that can prove disease-class compatibility, monthly duplicate state, department/physician/insurance readiness, or facility configuration without raw patient/insurance/disease detail?
- Which gaps are pure specification/repo-wrapper gaps versus true owner/operator business-context decisions?
- Can a safer next no-live task be defined that would reduce or eliminate the human-pending part?
- If owner input is still required, write the shortest exact owner question, with allowed answers and what each answer unlocks.

### 2. `RWO-06H_FRESH_LOCK_FREE_TARGET_PREFLIGHT`

Current state:

- Injection `injectionOrder/310` retry is blocked after an `Api_Result=90`-type rejection.
- Existing evidence found no safe read-only wrapper that proves target lock release or selects a fresh target without live mutation or raw patient/insurance detail.

Questions:

- Does official ORCA documentation define a safe way to check or infer lock/fresh-target readiness for `medicalmodv2` without mutation?
- Can `acceptlstv2`, `medicalgetv2`, `medicationgetv2`, or another official read-only endpoint safely classify a target as retryable, fresh, locked, stale, or unsuitable using only sanitized fields and row hashes?
- Can the repo add a no-live or read-only preflight that reduces ambiguity without exposing raw details?
- If no, what exact safety stop should remain, and what owner/operator/Trial-side action would be needed?

### 3. `RWO-06I_SURGERY_V3_ADJUNCT_MASTER_PROOF_PREFLIGHT`

Current state:

- Surgery v3 candidate was prepared from official-sample-style rows but remains blocked before live.
- The missing piece is adjunct/material/comment row proof and a safe way to avoid repeating rejected v1/v2 identities.

Questions:

- From official `medicalmodv2`, `medicationgetv2`, `masterlastupdatev3`, and any relevant master lookup docs, what row-level proof is required for surgery procedure, material, and comment rows?
- Is `medicationgetv2 Request_Number=02` appropriate for all v3 row types, or are some rows under a different master/API?
- Can `masterlastupdatev3` prove only freshness, or can it prove row-level validity for the specific adjunct rows?
- What no-live wrapper/parser tests should be added before any live v3 attempt?
- If official docs cannot prove row-level validity, propose a precise blocker and next source-backed candidate discovery task.

### 4. `RWO-08B_L4_FULLFLOW_OFFICIAL_IDENTIFIER_PREFLIGHT`

Current state:

- Fullflow is skipped because fresh target, unique active acceptance, no duplicate, and server-derived official identifiers are not safely established.
- Diagnostic artifacts may be captured only local/untracked; committed evidence must be sanitized summaries.

Questions:

- Can the existing acceptlstv2 target inventory and RN02 server-derived action patterns be reused to hydrate fullflow official identifiers safely?
- What exact server-derived identifiers are needed before Charts handoff and before ORCA order send?
- Which identifiers can be represented as sanitized row hashes or presence flags, and which must never be serialized publicly?
- Can an artifact-free fullflow preflight be designed, or is diagnostic mode still required?
- What is the smallest repo-local no-live task that moves fullflow from `skipped_environment_unavailable` to a precise preflight blocker or ready state?

### 5. `RWO-11/RWO-09_ROLLBACK_OWNER_DECISION`

Current state:

- Current automation boundary treats rollback rehearsal, release-candidate stop, paired restore, restored-target smoke, operator acceptance, and final owner GO/NO-GO/PENDING as external owner/operator gates.

Questions:

- Do any repository docs or runbooks contain missing non-live/static checks that automation can still complete without executing release-management actions?
- Is the external-gate classification coherent with the runbooks and roadmap?
- If a later owner explicitly reassigns this gate to automation, what minimum target/command/evidence inputs must be provided before it is safe to execute?

## Required Output Format

Return a concise but complete report in Japanese with these sections:

1. `結論`
   - State whether any blocked task can be unblocked by specification research or repo-local no-live work.

2. `タスク別判定`
   - For each task above, classify as exactly one:
     - `unblockable_by_repo_no_live_work`
     - `unblockable_by_official_spec_research_then_repo_work`
     - `requires_owner_operator_business_input`
     - `requires_live_trial_readonly_probe`
     - `blocked_safety_stop_should_remain`
     - `external_release_management_gate`
   - Include the reason in 2-5 bullets.

3. `公式仕様調査結果`
   - URL, checked date, endpoint/request class, relevant mapping, and derived safe next action.
   - Do not include raw ORCA bodies or patient/insurance details.

4. `推奨する次の自動化タスク`
   - Provide a prioritized list of concrete repo-local tasks.
   - Each task must include allowed files/modules, forbidden actions, required tests, and sanitized evidence path.

5. `owner/operator に聞くべき最短質問`
   - Only include questions that cannot be resolved by official specs or repo inspection.
   - Each question must have clear answer options and what each option unlocks.

6. `実装・証跡への提案`
   - Point to exact repository files that should be changed or inspected.
   - Suggest tests or wrappers to add.

7. `ライブ実行可否`
   - Explicitly state whether any live Trial mutation is authorized by this review. Expected default: no.

8. `非請求・非主張`
   - List what must not be claimed: production ORCA readiness, S3/object-storage readiness, final release readiness, fullflow success, broad all-order coverage, rollback acceptance, owner GO/NO-GO.

9. `次ワーカー用プロンプト案`
   - Draft a ready-to-use `NEXT_WORKER_PROMPT.md` if and only if a safe repo-local next task exists.
   - Keep it scoped, no-live unless a complete live packet is explicitly justified, and sanitized-only.

## Review Standard

Be conservative. If official docs are ambiguous, say so and preserve the safety stop. If a no-live task can reduce ambiguity without credentials, raw artifacts, live mutation, production ORCA, or S3/object storage, propose it concretely.

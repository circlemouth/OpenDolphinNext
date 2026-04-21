# 09. Subagent prompts

Use these prompts as bounded Work Order prompts. Do not launch all at once.

## WO-1 Subagent A: ORCA evidence hygiene

```text
You are Subagent A for WO-1 ORCA post-retry evidence hygiene.
Work only in your assigned worktree.
Use model gpt-5.4-high.

Do not run Phase 3. Do not run Phase 4. Do not run mutation.

Task:
Fix Phase 3 retry evidence/package hygiene:
- artifact-sha256.txt presence and verification
- final ZIP summary hash/size/file count correctness
- final ZIP source-scope scan target hash correctness
- timestamped command logs
- phase3ExecutionRunId / preflightIdentityRunId / childHarnessEvidenceRunId split
- worktree_clean not overclaimed
- full_source_secret_scan_claim not overclaimed
- extracted_review_subset packageMode unless full repo archive

Add/update package validation tests for the above.

Deliver subagent report under docs/implementation/unified-orca-postretry-wo1-20260421/.
```

## WO-1 Subagent B: C7/business hardening

```text
You are Subagent B for WO-1 C7/business hardening.
Work only in your assigned worktree.
Use model gpt-5.4-high.

Do not run Phase 3. Do not run Phase 4. Do not run mutation.

Task:
Harden C7 dynamic payload gate and business evidence:
- requestNumber01ValueVerified=true only when requestNumber value is 01
- reject 00/02/03/04/blank/null/object/array/missing/wrong value
- reject wrong candidate or patient
- reject zero or multiple mutation captures
- K3 acceptedWithWarnings only with registration evidence + C7 accepted
- HTTP 200 alone, wrapper exit 0 alone, apiResult=60, Request_Number=00 are not success

Add focused tests.

Deliver subagent report under docs/implementation/unified-orca-postretry-wo1-20260421/.
```

## WO-2 Subagent A: Static/DADS recovery

```text
You are Subagent A for WO-2 static/DADS recovery.
Work only in your assigned worktree.
Use model gpt-5.4-high.

Do not run Phase 3. Do not run Phase 4. Do not run mutation.

Task:
Reproduce and fix:
- npm run typecheck
- npm run build
- npm run test:ci

Known areas:
- dadsClinicalInputContract.test.tsx
- AppRouter.login-redirect.test.tsx
- WorkspaceTabBar.test.tsx
- AdministrationPage.connection.test.tsx

Use only references/dads_app_ui_design_rules_20260411.md for DADS decisions.
Prefer fixes over waivers.

Deliver subagent report under docs/implementation/unified-static-dads-recovery-wo2-20260421/.
```

## WO-3/WO-4 Clinical subagents

Use the original prompts in:

```text
references/clinical-input-wave1-20260421/subagents/
```

Do not rewrite them inline unless necessary. Main agent must enforce the unified ORCA boundary and no-mutation policy.
```

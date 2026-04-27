# External gate boundary and ChatGPT research prompts

RUN_ID: `20260427T125006Z`

## Result

`EXTERNAL_GATE_BOUNDARY_RECORDED_AND_RESEARCH_PROMPTS_PREPARED`

This record implements the owner instruction that `RWO-11/RWO-09` release-management gates are not executed by the hourly `orca` automation, and prepares standalone prompts for ChatGPT research agents to investigate the two remaining blocker families that may need external reasoning or ORCA business-context research.

## RWO-11 / RWO-09 Automation Boundary

The hourly `orca` automation must not perform, select, repeatedly reclassify, or block on these `RWO-11/RWO-09` release-management gates:

- rollback rehearsal
- release-candidate deployment stop
- paired restore
- restored-target smoke
- operator acceptance
- final owner GO/NO-GO/PENDING decision capture

These gates are external owner/operator release-management gates for this automation. The automation may preserve non-claim boundaries and continue safe independent no-live/static roadmap work, but it must not infer or manufacture rollback/operator/final-decision evidence.

This boundary applies even if older roadmap or handoff documents mention prior owner reassignment. A later explicit owner instruction is required to change this boundary.

## Prepared Research Prompts

| Prompt | Purpose |
|---|---|
| `CHATGPT_PROMPT_RWO08B_FRESH_FULLFLOW_TARGET.md` | Ask a ChatGPT research agent to investigate how to resolve the missing fresh/local-selectable fullflow target without credentials, raw artifacts, or live mutation. |
| `CHATGPT_PROMPT_ORCA_TRIAL_BUSINESS_REJECTIONS.md` | Ask a ChatGPT research agent to investigate whether ORCA Trial business rejections can be explained by official ORCA semantics, billing context, row/class combinations, or endpoint preconditions. |

Both prompts are standalone and include the relevant context, constraints, known evidence, expected output, and forbidden actions. They are written for research only; they do not authorize live ORCA mutation, production ORCA work, S3/object-storage work, credential handling, or raw artifact capture.

## Claim Boundary

Allowed claim: the automation boundary and research-agent prompts are recorded.

Not claimed: RWO-08B resolution, new fresh fullflow target, ORCA Trial business acceptance, rollback rehearsal, operator acceptance, final owner GO/NO-GO/PENDING, production ORCA readiness, S3/object-storage readiness, or final release readiness.

## Security Notes

- Credentials printed or captured: `false`
- Raw ORCA request/response bodies captured: `false`
- Raw patient/insurance details captured: `false`
- Diagnostic artifacts captured: `false`
- Raw artifacts committed or packaged: `false`
- Production ORCA attempted: `false`
- S3/MinIO/object-storage configuration requested or used: `false`


# ChatGPT Prompt: ORCA Trial Specification Research

RUN_ID: `20260426T212101Z`

Use this prompt with the attached repository review ZIP. The ZIP is a sanitized code/documentation package for OpenDolphinNext `web-client` and `server-modernized`; it intentionally excludes legacy `client/` and `server/`, generated artifacts, raw diagnostic artifacts, credentials, and object-storage configuration.

## Role

You are an ORCA / 日レセ integration specification reviewer. Review the provided repository package and current progress documents, then research official/public ORCA specifications as needed. Focus on safe next steps for WebORCA / ORCA Trial only.

## Safety Scope

- Target scope is WebORCA / ORCA Trial only.
- Do not advise production ORCA execution.
- Do not request, infer, or print credentials, cookies, sessions, Authorization headers, CSRF values, raw ORCA request/response bodies, patient details, insurance details, or credential-bearing URLs.
- Do not propose S3/MinIO/object-storage setup, dummy object-storage credentials, or storage readiness claims.
- Treat `client/` and `server/` as out of scope even if referenced historically.
- Distinguish official specification facts from inference and Trial-data hypotheses.

## Repository Entry Points To Read

Start with:

- `docs/implementation/orca-spec-research-package-20260426T212101Z/PACKAGE_CONTEXT.md`
- `docs/implementation/automation-handoff/NEXT_WORKER_PROMPT.md`
- `docs/implementation/automation-handoff/HANDOFF_STATE.json`
- `docs/implementation/automation-handoff/AUTOMATION_THROUGHPUT_POLICY.md`
- `docs/implementation/clinical-functional-release-readiness-roadmap-20260422/WORKPLAN_TO_RELEASE.md`
- `docs/implementation/clinical-functional-release-readiness-roadmap-20260422/REMAINING_WORK_BREAKDOWN.md`
- `docs/implementation/clinical-functional-release-readiness-roadmap-20260422/RELEASE_GATE_MATRIX.md`
- `docs/runbooks/release-validation.md`
- `web-client/README.md`
- `server-modernized/`
- `web-client/scripts/qa-phase4-safe-medicalmodv2.mjs`
- `web-client/scripts/qa-phase4-injection-master-validity.mjs`
- `web-client/scripts/qa-phase4-base-charge-first-visit.mjs`
- `web-client/scripts/qa-fullflow-weborca.mjs`

Key evidence to inspect:

- `docs/implementation/rwo06h-injection-master-validity-readonly-20260426T140206Z/FINAL_REPORT.md`
- `docs/implementation/rwo06h-injection-master-validity-readonly-20260426T140206Z/summary.sanitized.json`
- `docs/implementation/rwo06g-base-charge-first-visit-readonly-20260426T150137Z/FINAL_REPORT.md`
- `docs/implementation/rwo06g-base-charge-first-visit-readonly-20260426T150137Z/summary.sanitized.json`
- `docs/implementation/clinical-functional-release-readiness-roadmap-20260422/order-family-v2-candidate-research-20260425T215740Z.md`
- `docs/implementation/clinical-functional-release-readiness-roadmap-20260422/orca-trial-remaining-spec-intake-20260426T124656Z.md`
- RWO-08B fullflow evidence documents under `docs/implementation/rwo08b-*`

## Questions To Answer

1. For `medicalmodv2` `injectionOrder` / Claim007 class `310`, what official ORCA specification or public source confirms the required row shape, class code, quantity/unit semantics, and valid code families for procedure, medication, material, and comment rows?
2. The current candidate uses medication code `620000012`, procedure code `130000510`, material code `700000031`, and comment code `0085001`. The read-only Trial check found medication `620000012` was not validated while the other rows were validated. Based on official/public sources, what changed candidate identity or read-only lookup strategy should be tried next before any live mutation?
3. For `medicalmodv2` `baseChargeOrder` / Claim007 class `110`, what ORCA semantics distinguish first-visit/revisit/basic consultation fee rows, and what Trial encounter state must be proven before live mutation?
4. Is `acceptmodv2` `Request_Number=00` the correct read-only/inquiry mechanism for proving base-charge first-visit compatibility? If yes, what parsed fields/classes should count as sufficient evidence? If no, what safer read-only preflight should replace it?
5. For L4 fullflow, current blockers include duplicate acceptance/no active row, Charts handoff stopping before order send, and missing official visit identifiers. Based on ORCA official route semantics, what read-only preconditions should be established before retrying diagnostic fullflow?
6. Identify any repository wrapper/parser/sanitizer gaps that could cause false success from HTTP 200, zero-like `Api_Result`, or generic parser behavior.
7. Recommend the next 3 safe no-live/read-only Work Orders in priority order. Each recommendation must include:
   - endpoint/request class;
   - target/payload identity or how to select it without raw patient/insurance details;
   - required official/public evidence;
   - expected sanitized success fields;
   - stop conditions;
   - explicit non-claims.

## Required Output

Produce a concise research report with:

- Source-backed findings with URLs or official document names.
- A distinction between official spec facts, Trial-data observations, and hypotheses.
- A recommended next-action table.
- A list of unsafe actions to avoid.
- No raw credentials, raw ORCA bodies, raw patient/insurance details, or production/S3 claims.

# ChatGPT Research Prompt: ORCA Trial business rejections

You are a research-only ChatGPT agent helping the OpenDolphinNext release-readiness effort.

Your task is to investigate whether several WebORCA / ORCA Trial business rejections can be explained or narrowed using official ORCA API semantics, billing context, row/class rules, or safe no-live evidence. This is research only. You must not run live mutation, request credentials, or rely on raw ORCA bodies.

## Repository / Project Context

Project: OpenDolphin WebClient modernization.

Relevant scope:

- `web-client/qa/payloads/phase4/`
- `web-client/scripts/qa-phase4-safe-medicalmodv2.mjs`
- `web-client/scripts/qa-phase4-*.mjs`
- `web-client/scripts/qa-lib/phase4-*.mjs`
- `docs/implementation/automation-handoff/HANDOFF_STATE.json`
- `docs/implementation/clinical-functional-release-readiness-roadmap-20260422/`
- individual evidence directories under `docs/implementation/rwo06*/`

Out of scope:

- production ORCA
- production credentials
- production patient data
- S3 / MinIO / object-storage setup
- live Trial retry without a changed precondition and complete endpoint packet
- raw ORCA request/response bodies
- raw patient or insurance details
- credentials, cookies, sessions, Authorization headers, CSRF values
- screenshots, HAR, traces, videos, raw network dumps as research evidence
- legacy `client/` or `server/` changes

## Current Known Rejection / Blocker Summary

The following are sanitized, high-level facts. Do not ask for raw bodies.

### Accepted or partially accepted reference points

- `prescription` and representative `treatment/generic` `medicalmodv2` identities have scoped L3 Trial business acceptance in prior evidence.
- `testOrder/600` v3 has scoped L3 Trial business acceptance:
  - payload: `web-client/qa/payloads/phase4/medicalmodv2_test_order_trial_reachability_v3.json`
  - SHA-256: `6a4e1800dbc6993c08c90d01a5ed57e490c0b38a346b6966325bfa0d86a61a28`
  - candidate codes: `160000310`, `831000000`
- `radiologyOrder/700` v3 has scoped L3 Trial business acceptance:
  - payload: `web-client/qa/payloads/phase4/medicalmodv2_radiology_trial_reachability_v3.json`
  - SHA-256: `144850285178276d543ebb424610cbf91a2e188b8dc597f957cc882577c4a16a`
  - candidate codes: `002000099`, `170027910`, `820181000`

### Blocked or rejected families

1. `instractionChargeOrder/130`
   - representative `medicalmodv2` class `130`
   - v2 payload SHA-256: `043c2a657746820a96950d6c05e2179d65040123d677a028e9ab86bc9af98858`
   - current state: live remains blocked because disease/facility/monthly/department/insurance context was not proven without raw detail.
   - read-only precondition probes did not prove disease context, monthly duplicate context, or department/insurance context; facility summary was observed sanitized.

2. `baseChargeOrder/110`
   - representative `medicalmodv2` class `110`
   - v2 payload SHA-256: `4c092e032dd6f56eb5542ad65b2b6b28a8e1c1c802900f83e795dbbdba7a403a`
   - current state: live remains blocked.
   - `acceptmodv2` Request_Number `00` first-visit compatibility check returned sanitized `2xx` / `nonzero_numeric` / `not_verified_or_not_first_visit_compatible`.
   - Need a first-visit-compatible Trial encounter state before any live attempt.

3. `injectionOrder/310`
   - representative `medicalmodv2` class `310`
   - v3 payload SHA-256: `6878f9a087dc029cd9f6a28b9863ab69fa68515913f009575c8006e67e40ab5d`
   - selected candidate row proof included `621894701` via sanitized `medicationgetv2 Request_Number=02`
   - one scoped live Trial attempt returned HTTP `200`, API result `90`, classified as `businessRejected`
   - no repeat live send is allowed without a changed precondition.
   - Follow-up classified likely changed precondition needed: fresh or lock-free target; no safe read-only target-lock/fresh-target proof currently exists.

4. `surgeryOrder/500`
   - representative `medicalmodv2` class `500`
   - v2 live attempt returned HTTP `200`, API result `80`, classified as `businessRejected`
   - v3 payload SHA-256: `f1046a303a1d78e12c6409efc7cb68bcb96bc6737428846c24e2fa4981af9421`
   - v3 candidate rows: `150003110`, `641210099`, `840000042`
   - read-only row proof failed for those rows; no new source-backed surgery identity was established.
   - Official sample-like rows are not sufficient as Trial business acceptance.

5. `subjectivesv2` / SOAP
   - prior attempts were classified as HTTP 404/502 transport rejection, not business acceptance.
   - Process note: repeated unchanged sends are not valid fix-and-retry cycles.

6. `diseasev3`
   - create live checkpoint was transport/business rejected in prior evidence and requires endpoint-specific no-live semantics and success criteria before retry.

7. `acceptmodv2` Request_Number `02` / `03` / `04`
   - no-live wrapper/parser contracts exist.
   - RN02 is blocked before live due to missing active acceptance row, server-derived `Acceptance_Id`, matching patient/date/scope, department/physician scope, and duplicate-live checkpoint.
   - RN03/RN04 require analogous server-derived prerequisites and endpoint-specific completion evidence.

## Official Sources To Prefer

Use ORCA official sources first:

- `https://www.orca.med.or.jp/receipt/tec/api/overview.html`
- endpoint pages under `https://www.orca.med.or.jp/receipt/users/tec/api/`
- likely relevant pages:
  - `medicalmod.html`
  - `medicationgetv2.html`
  - `diseasemod2.html`
  - accept/visit-related endpoint docs discovered from the official API overview
- ORCA official/manual pages for outpatient input classes, service class codes, surgery/input rows, injection rows, basic consultation fees, instruction fees, disease prerequisites, and claim-send semantics.

Public/non-official sources may be used only as secondary leads and must be labeled unconfirmed unless confirmed by ORCA official documentation.

## Research Goal

Determine whether the business rejections likely come from:

- wrong service class / row ordering;
- missing prerequisite rows;
- invalid master code for Trial date;
- missing disease or billing context;
- first-visit / revisit mismatch;
- locked or duplicate target encounter;
- wrong department/physician/insurance scope;
- missing server-derived official identifiers;
- endpoint/request-number semantics mismatch;
- Trial dataset limitations;
- payload shape or quantity/unit assumptions.

For each blocked family, propose the safest next no-live/read-only action, not a live retry.

## Required Output

Return a research memo with these sections:

1. `Executive Summary`
2. `Per-Family Findings`
3. `Likely Rejection Causes`
4. `Official Documentation Evidence`
5. `Safe No-Live / Read-Only Next Actions`
6. `What Would Justify a Future Live Retry`
7. `Do Not Do`
8. `Recommended Automation Queue Updates`

For every recommendation, classify it as one of:

- `repo_local_no_live`
- `requires_readonly_trial_runtime`
- `requires_official_spec_research`
- `requires_owner_or_operator_business_context`
- `out_of_scope_for_automation`

## Hard Safety Rules

Do not request, infer, print, or store credentials.

Do not ask for raw ORCA bodies, raw patient details, raw insurance details, cookies, sessions, Authorization headers, CSRF values, HAR, traces, screenshots, videos, request XML, or raw network dumps.

Do not recommend production ORCA, S3/object-storage setup, or live Trial mutation as the immediate next step.

Do not treat HTTP 200, API result `00`, wrapper exit `0`, dry-run success, official sample rows, or read-only row existence alone as business success.

Do not recommend repeating any rejected live send unchanged.

Any future live retry recommendation must require all of:

- changed payload identity or changed target/precondition;
- source-backed row/class rationale;
- sanitized read-only proof where applicable;
- duplicate-live checkpoint decision;
- runtime readiness;
- parser/sanitizer contract;
- endpoint-specific business success criteria;
- stop conditions;
- sanitized evidence policy.


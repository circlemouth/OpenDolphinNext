# OpenDolphinNext clinical input test Wave 1 coordinator report

## Identity

```text
RUN_ID: 20260421T044925Z
coordinator worktree: /Users/Hayato/Documents/GitHub/OpenDolphin_WebClient
base branch: master
base commit: 02aa1434d20615c22c23fe5cbf80938e725cfd88
coordinator HEAD before report commit: e38109bff
date: 2026-04-21
timezone: Asia/Tokyo
```

## Forbidden-action attestation

```text
external web used: no
ORCA official specification web lookup: no
live ORCA mutation: no
Phase 3: no
Phase 4: no
fullflow: no
reception registration mutation: no
raw HAR/trace/video/screenshot/raw XML/raw network body evidence included: no
credentials/cookies/tokens included: no
production clinical implementation fix: no
legacy client/ or server/ changed: no
```

Wave 1 changes are limited to test source, test fixtures/utilities, evidence packaging utility hardening, and test-only reports. No server/web clinical production behavior was changed.

## Subagent branches and worktrees

| Agent | Scope | Branch | Worktree | Commit | Merge commit | Merge decision |
|---|---|---|---|---|---|---|
| A | chart / karte document server persistence tests | `codex/wave1-agent-a-order-karte-document-tests` | `/Users/Hayato/Documents/GitHub/odn-wave1-agent-a` | `47c8ef1066724e624ceb5e8f41ce7af98f6b7b1e` | `400b1b7c8` | merged as-is |
| C | disease / diagnosis and SOAP readback tests | `codex/wave1-agent-c-disease-soap-readback-tests` | `/Users/Hayato/Documents/GitHub/odn-wave1-agent-c` | `b4d4c933970cfc547b35062bbb4da6a8260b122c` | `e5ca88a2b` | merged as-is |
| B | order local persistence matrix and ORCA boundary tests | `codex/wave1-agent-b-order-local-orca-boundary-tests` | `/Users/Hayato/Documents/GitHub/odn-wave1-agent-b` | `35a31fd9f8abd725061739cadb9bb52c52bc0ed5` | `537d10217` | merged as-is |
| D | DADS UI contract and dynamic evidence packaging tests | `codex/wave1-agent-d-dads-evidence-tests` | `/Users/Hayato/Documents/GitHub/odn-wave1-agent-d` | `dd51d594d83fec44a5f153bbfb1abfb071c523ac` | `e38109bff` | merged as-is |

Merge order followed the plan: A, C, B, D.

## Changed files

### Reports

- `docs/codex/clinical-input-test-wave1-20260421/results/AGENT_A_REPORT.md`
- `docs/codex/clinical-input-test-wave1-20260421/results/AGENT_B_REPORT.md`
- `docs/codex/clinical-input-test-wave1-20260421/results/AGENT_C_REPORT.md`
- `docs/codex/clinical-input-test-wave1-20260421/results/AGENT_D_REPORT.md`
- `docs/codex/clinical-input-test-wave1-20260421/results/WAVE1_COORDINATOR_REPORT.md`

### Server test source

- `server-modernized/src/test/java/open/dolphin/session/KarteDocumentOrderModulePersistenceTest.java`
- `server-modernized/src/test/java/open/dolphin/session/KarteRevisionServiceBeanOrderModuleCloneTest.java`
- `server-modernized/src/test/java/open/dolphin/rest/LocalDiagnosisResourceTest.java`
- `server-modernized/src/test/java/open/dolphin/rest/orca/LocalChartSubjectiveResourceTest.java`

### Web client test source

- `web-client/src/features/charts/__tests__/DiagnosisEditPanel.readback.test.tsx`
- `web-client/src/features/charts/__tests__/SoapNotePanel.serverReadback.test.tsx`
- `web-client/src/features/charts/__tests__/soapSubjectivesOrcaBoundary.test.tsx`
- `web-client/src/features/charts/__tests__/orderLocalPersistenceMatrix.test.ts`
- `web-client/src/features/charts/__tests__/prescriptionOrderLocalRoundtripBoundary.test.ts`
- `web-client/src/features/charts/__tests__/orderLocalOrcaBoundary.test.ts`
- `web-client/src/features/charts/__tests__/orderSetFieldPreservation.test.ts`
- `web-client/src/features/charts/__tests__/dadsClinicalInputContract.test.tsx`
- `web-client/src/features/charts/__tests__/dadsOrderContract.test.ts`

### Review package tests/utilities

- `tests/review-package/create-review-package.test.mjs`
- `tests/review-package/dynamicEvidencePackaging.test.mjs`
- `scripts/create-review-package.sh`
- `scripts/tools/scan-review-bundle.mjs`

The `scripts/` changes are evidence packaging utility hardening: review packages now exclude/reject `.env`, `*.env`, `raw-network/`, and `raw-xml/` paths in addition to the existing raw artifact exclusions.

## Tests added

### Agent A

- Order-containing `/karte/document` service persistence with `medOrder` module payload encoding, parent binding, `docPk` propagation, and integrity seal invocation.
- DETAIL readback preservation of module info, `beanJson`, decoded payload, and document parent reference.
- Revision restore/revise preservation of order module metadata/payload and parent rebinding.
- Revision diff detection of changed order module entity/digest.
- `DocumentModelCloner` non-aliasing for mutable nested order bundle data.
- Delete-chain marking for linked documents and order modules.

### Agent C

- Local diagnosis create/update/delete readback including start/end/outcome/category/principal/suspected fields.
- Candidate and ORCA mirror boundary tests.
- Characterization/blocker tests for `yyyy-MM-dd` date nulling, invalid date acceptance, reversed date acceptance, and unknown outcome persistence.
- SOAP local document persistence/readback, Free-to-`S` mapping, `P` category behavior, and local `/api/local/charts/subjectives` boundary.
- Characterization/blocker test for invalid SOAP `performDate` fallback.

### Agent B

- Generic local order matrix covering prescription, injection, lab/test, physiology, bacteria, radiology, treatment, surgery, other/local-only, comments, and dependent material rows.
- Prescription save -> reload -> edit -> delete -> copy-from-previous-chart local API lifecycle.
- Static medicalmodv2 payload/block tests for sendable and unsupported/local-only order types.
- Order set lossy-risk test for extended fields currently stripped by chart order set storage.

### Agent D

- DADS UI contract tests for SOAP disabled reason, disease state visibility, disease edit blocked reason, document labels/errors, and order primary action hierarchy.
- Dynamic evidence packaging tests accepting sanitized command summaries and rejecting raw trace/HAR/screenshots/raw-network/raw-xml/env paths.
- Review package regression updates for env/raw evidence exclusion.

## Commands run and results

| Phase | Command | CWD | Result | Summary |
|---|---|---|---:|---|
| Agent A post-merge | `mvn -f pom.server-modernized.xml -pl server-modernized -am -Dsurefire.failIfNoSpecifiedTests=false -Dtest=KarteDocumentOrderModulePersistenceTest,KarteRevisionServiceBeanOrderModuleCloneTest test` | repo root | PASS | 6 server tests passed. |
| Agent C post-merge server | `mvn -f pom.server-modernized.xml -pl server-modernized -am -Dsurefire.failIfNoSpecifiedTests=false -Dtest=LocalDiagnosisResourceTest,LocalChartSubjectiveResourceTest,OrcaDiseaseMirrorSyncSupportTest test` | repo root | PASS | 20 server tests passed. Synthetic invalid-date cases emitted existing parser stack traces; recorded as blocker C-LOG-001, not included as raw evidence. |
| Agent C post-merge web | `npm test -- --run src/features/charts/__tests__/DiagnosisEditPanel.readback.test.tsx src/features/charts/__tests__/SoapNotePanel.serverReadback.test.tsx src/features/charts/__tests__/soapSubjectivesOrcaBoundary.test.tsx` | `web-client` | PASS | 3 files / 5 tests passed; web guard pretest passed. |
| Agent B post-merge web | `npm run test -- --run src/features/charts/__tests__/orderLocalPersistenceMatrix.test.ts src/features/charts/__tests__/prescriptionOrderLocalRoundtripBoundary.test.ts src/features/charts/__tests__/orderLocalOrcaBoundary.test.ts src/features/charts/__tests__/orderSetFieldPreservation.test.ts` | `web-client` | PASS | 4 files / 15 tests passed; web guard pretest passed. |
| Agent D post-merge web | `npm test -- --run src/features/charts/__tests__/dadsClinicalInputContract.test.tsx src/features/charts/__tests__/dadsOrderContract.test.ts` | `web-client` | PASS | 2 files / 7 tests passed; web guard pretest passed. |
| Agent D post-merge package | `node --test tests/review-package/dynamicEvidencePackaging.test.mjs && node --test tests/review-package/create-review-package.test.mjs` | repo root | PASS | 2 + 22 Node tests passed. |
| Aggregate server | `mvn -f pom.server-modernized.xml -pl server-modernized -am -Dsurefire.failIfNoSpecifiedTests=false -Dtest=KarteDocumentOrderModulePersistenceTest,KarteRevisionServiceBeanOrderModuleCloneTest,LocalDiagnosisResourceTest,LocalChartSubjectiveResourceTest,OrcaDiseaseMirrorSyncSupportTest test` | repo root | PASS | 26 server tests passed. Synthetic invalid-date stack traces remain known blocker evidence. |
| Aggregate web | `npm test -- --run <9 merged chart test files>` | `web-client` | PASS | 9 files / 27 Vitest tests passed; web guard pretest passed. |
| Aggregate package | `node --test tests/review-package/dynamicEvidencePackaging.test.mjs tests/review-package/create-review-package.test.mjs` | repo root | PASS | 24 Node tests passed. |
| Static hygiene | `git diff --check` | repo root | PASS | No whitespace errors. |

Subagent-local setup commands included `npm ci` in B/C/D worktrees because Vitest dependencies were absent there. Coordinator aggregate web tests used the existing coordinator `web-client/node_modules`.

## Failures and blockers

| ID | Severity | Area | Description | Required next action |
|---|---:|---|---|---|
| A-001 | High | `/karte/document` audit | No stable POST/PUT audit hook was identified for document create/update. Delete audit exists. | Follow-up production implementation package for sanitized POST/PUT document audit events and tests. |
| A-002 | Medium | DB persistence evidence | Agent A tests use mocked `EntityManager`/service contracts and do not prove full PostgreSQL JSONB roundtrip. | Add embedded/integration DB roundtrip if release gate requires storage-level evidence. |
| C-DIAG-DATE-001 | High | diagnosis date | UI-style `yyyy-MM-dd` diagnosis dates are accepted but persisted as `null`. | Production fix: accept canonical date-only or fail closed with 400. |
| C-DIAG-DATE-002 | High | diagnosis date | Invalid diagnosis dates are accepted and persisted as `null`. | Production fix: reject invalid dates with safe client error. |
| C-DIAG-DATE-003 | High | diagnosis chronology | `endDate` before `startDate` is accepted. | Production fix: server-side chronological validation. |
| C-DIAG-OUTCOME-001 | Medium | diagnosis outcome | Unknown outcome values are persisted. | Production fix: define and enforce allowlist or document free-text policy. |
| C-SOAP-DATE-001 | High | SOAP performDate | Invalid SOAP `performDate` silently falls back to current date while persisting. | Production fix: fail closed or provide explicit audited fallback policy and UI warning. |
| C-LOG-001 | Medium | parser logging | Invalid date tests emit parser stack traces. | Production fix: sanitize parser logging and return safe error without stack exposure. |
| C-ORCA-SPEC-001 | Medium | ORCA mutation gates | diseasev3 and subjectivesv2 remain unverified by Wave 1 design. | 要 ORCA 公式仕様確認 in a permitted future gate. |
| B-LOS-001 | Medium | order set | Chart order set storage strips `admin`, `adminCode`, `bundleNumber`, `materialItems`, `commentItems`, `bodyPart`, `subtype`, and `bacteria`. | Production follow-up if order set reuse must preserve these fields. |
| B-SPEC-001 | Low | ORCA payload | Static medicalmodv2 payload assertions are repo-contract based only. | 要 ORCA 公式仕様確認 for carrier compatibility in future scope. |
| DADS-D-001 | High | SOAP UI | SOAP textareas lack real label/support/`aria-describedby` and rely on placeholder guidance. | Production UI follow-up for field labels/support/error slots. |
| DADS-D-002 | Medium | Disease UI | Disease date fields lack visible date guidance examples; ended disease visibility under `details` needs clinical decision. | Production UI follow-up for date guidance and ended-disease visibility policy. |
| DADS-D-003 | High | Document UI | Document fields use placeholder examples and ordinary validation uses alert/assertive live region. | Production UI follow-up for support text and static ordinary validation. |
| DADS-D-004 | Medium | Order UI | Disabled control reason coverage is not exhaustive. | Production UI follow-up for visible nearby disabled reasons/enabling conditions. |
| DADS-D-005 | Medium | Clinical context | Patient identity visibility in every save/send context remains unverified. | Add save/send context patient identity tests and UI fixes if needed. |

## ORCA boundary statement

Wave 1 did not perform live ORCA mutation, live ORCA order registration, live ORCA disease mutation, live ORCA subjectives mutation, Phase 3, Phase 4, fullflow, or reception registration mutation.

All passing evidence is local/server/unit/static/MSW-compatible test evidence only. It must not be described as live ORCA success. Static medicalmodv2 and local boundary tests are not ORCA official compatibility proof. Any ORCA carrier ambiguity remains `要 ORCA 公式仕様確認`.

## DADS coverage statement

Wave 1 added focused DADS contract coverage for SOAP disabled reasons, disease clinical state visibility, disease edit-block reasons, document labels/errors, and order primary action hierarchy. This is partial coverage only. It does not prove full DADS compliance, contrast compliance, full keyboard/focus behavior, or Playwright runtime success.

Known DADS blockers are recorded above and were not fixed because production UI changes are out of Wave 1 scope.

## Dynamic evidence limitations

- No raw HAR, trace, video, screenshot, raw XML, raw network body, credential, cookie, or token evidence was added.
- Review packaging utility/tests now reject `.env`, `*.env`, `raw-network/`, and `raw-xml/` in addition to existing raw artifact exclusions.
- A passing package source-scope scan or sanitized command summary must not be represented as full-source secret cleanliness, clean checkout proof, Playwright runtime proof, or live ORCA success.

## Not-run commands and reasons

| Command / suite | Reason |
|---|---|
| live ORCA mutation / order registration / disease mutation / subjectives mutation | Explicitly forbidden in Wave 1. |
| Phase 3 / Phase 4 / fullflow | Explicitly forbidden in Wave 1. |
| reception registration mutation | Explicitly forbidden in Wave 1. |
| external ORCA official specification lookup | Explicitly forbidden; future items marked `要 ORCA 公式仕様確認`. |
| Playwright E2E | Agent D achieved the Wave 1 assertions with component/static tests. Playwright config can retain trace/screenshot on failure, so no Playwright raw artifacts were generated in this wave. |
| `npm run ci` | Broader than Wave 1 targeted aggregate. Not run to avoid conflating targeted clinical-input tests with full web release gate. |
| `mvn -f pom.server-modernized.xml -pl server-modernized -am -Pstatic-analysis verify` | Broader than Wave 1 targeted aggregate. Not run in this wave. |
| `runtime-ready-smoke.mjs` and WebORCA QA scripts | Runtime/live ORCA gates are outside Wave 1 and include prohibited Phase/fullflow paths. |

## Next wave recommendation

1. Create a production implementation wave for high-severity diagnosis/SOAP date validation: reject invalid inputs fail-closed, support or reject date-only explicitly, enforce diagnosis chronology, and sanitize parser logging.
2. Add `/karte/document` POST/PUT audit events and tests with sanitized actor/document/karte/outcome/correlation data.
3. Decide whether order set reuse must preserve extended order fields, then implement field preservation and replace the current lossy-risk characterization with positive roundtrip tests.
4. Run a DADS production UI follow-up for SOAP labels/support, disease date guidance, document placeholder/error rendering, disabled-control reasons, and patient identity in save/send contexts.
5. In a permitted future ORCA gate, confirm static medicalmodv2, diseasev3, and subjectivesv2 carrier assumptions against official ORCA specifications and live-readiness policy. Mark all such work `要 ORCA 公式仕様確認` until confirmed.

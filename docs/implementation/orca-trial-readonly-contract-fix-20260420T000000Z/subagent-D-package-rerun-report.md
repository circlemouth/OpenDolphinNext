# Subagent D package rerun hygiene report

RUN_ID: `20260420T114225Z`

## Scope

- Branch: `codex/subagent-package-rerun-20260420`
- Base commit: `4e788dd34aa3cf67f041e1f67ddb2edcf62094b3`
- Worktree: `/Users/Hayato/Documents/GitHub/opendolphin-subagent-package-rerun`
- Live ORCA rerun: not run
- Phase 3 / Phase 4 / fullflow: not run
- Mutation request: not run

This branch only updates package/rerun hygiene scripts, tests, and docs. It does not assume A/B/C are already merged and does not execute the final live read-only rerun.

## Threat model before editing

| Threat / misuse case | Control added or verified |
| --- | --- |
| Nested old ZIP silently carries stale or raw evidence from prior `docs/implementation/` packages. | `create-review-package.sh`, `scan-review-bundle.mjs`, and `validate-review-package-metadata.mjs` now default-reject nested `.zip` entries, including old `OpenDolphin_WebClient-review-package-*.zip`. Intentional nested ZIP inclusion remains unsupported unless a future tool adds explicit manifest justification plus recursive scanning. |
| Validation scans a preliminary ZIP while the final ZIP differs. | Finalizer now requires final ZIP metadata validation and final ZIP source-scope secret scan logs to carry `target_path` and `target_sha256` matching the final ZIP. |
| Secret scan claims more scope than it actually scanned. | `full_source_secret_scan_claim=not_claimed` and `worktree_clean=not_verified` remain enforced. Finalizer requires current RUN_ID-scoped evidence dir, `candidate-rows.sanitized.json`, `command-log.jsonl`, and review log manifest run ID match before writing `secret-scan.sanitized.txt`. |
| Rerun artifact accidentally authorizes or executes mutation. | The documented command plan stops after discovery if `acceptedCandidateCount=0`, and after exact selected-candidate read-only preflight if candidates exist. Phase 3/4/fullflow/mutation commands are explicitly out of plan. |

## Changes

- `scripts/create-review-package.sh`
  - Excludes nested `.zip`, old review package ZIPs, HAR, trace/video/screenshot, raw network/request/response evidence dirs, and generated artifact dirs from tracked source packaging.
  - Records nested ZIP policy in `REVIEW_PACKAGE_MANIFEST.txt`.
- `scripts/tools/scan-review-bundle.mjs`
  - Rejects nested ZIPs and broader raw evidence path categories inside review bundles.
- `scripts/tools/validate-review-package-metadata.mjs`
  - Rejects nested ZIPs in final review packages and continues to bind package source-scope scan to final ZIP SHA/path.
- `scripts/tools/orca-readonly-evidence-finalizer.mjs`
  - Requires `candidate-rows.sanitized.json` and `command-log.jsonl`.
  - Requires status fields for source commit match, official patientget status, insurance/appointment status and classification, selector/local/medical-information readiness, primary rejection reason, rejection reasons, and sanitize result.
  - Extracts `REVIEW_PACKAGE_MANIFEST.txt` from the final ZIP into the evidence dir.
  - Verifies final ZIP source-scope scan and metadata validation logs target the final ZIP path and SHA-256.
  - Scans only current RUN_ID evidence and rejects nested ZIPs except the final review ZIP.
- `scripts/tools/README.md`
  - Documents the stricter package/finalizer inputs and nested ZIP default-exclude policy.
- `tests/review-package/create-review-package.test.mjs`
  - Covers old review package ZIP exclusion, raw path rejection, current RUN_ID finalizer inputs, and expanded final summary fields.

## Exact command plan for main integration after A/B/C merge

Use a new `RUN_ID` on the merged integration source. Do not reuse this subagent `RUN_ID`.

```bash
RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)"
EVIDENCE_DIR="docs/implementation/orca-trial-readonly-diagnostics-${RUN_ID}"
mkdir -p "${EVIDENCE_DIR}"
git rev-parse HEAD > "${EVIDENCE_DIR}/source-commit.txt"
git branch --show-current > "${EVIDENCE_DIR}/source-branch.txt"
```

Confirm local services only. Do not include raw credential, cookie, Authorization, JSESSIONID, CSRF, raw ORCA body, raw patient detail, raw insurance detail, HAR, trace, video, raw screenshot, or raw network dump.

```bash
curl -ksS -o /dev/null -w '%{http_code}\n' https://127.0.0.1:8443/openDolphin/api/health
curl -ksS -o /dev/null -w '%{http_code}\n' https://127.0.0.1:5173/
curl -ksS -o /dev/null -w '%{http_code}\n' https://127.0.0.1:8443/openDolphin/api/session/me
```

Expected status before rerun: server health `200`, Vite `200`, `/api/session/me` `200`. If any is not `200`, stop and classify as environment/session readiness blocker.

Read-only discovery only:

```bash
cd web-client
RUN_ID="${RUN_ID}" node scripts/qa-weborca-candidate-discovery.mjs
cd ..
```

Copy only sanitized discovery outputs into `${EVIDENCE_DIR}`:

- `candidate-rows.sanitized.json`
- `command-log.jsonl`
- sanitized discovery summary/status JSON

Decision rule:

- If `acceptedCandidateCount=0`, stop. Phase 3/4/fullflow/mutation remain `not_run`, `targetMutationRequestCount=0`, `checkedRequests=0`.
- If `acceptedCandidateCount>0`, run exact selected-candidate read-only preflight only, then stop.
- If exact preflight returns `acceptedForPhase3Attempt===true`, still stop.

Exact selected-candidate read-only preflight only, when discovery accepted a candidate:

```bash
cd web-client
RUN_ID="${RUN_ID}" QA_PATIENT_ID="<accepted sanitized candidate patientId>" node scripts/qa-weborca-readonly-preflight.mjs
cd ..
```

Forbidden in this Phase 2.5 rerun:

```text
node scripts/qa-acceptmodv2-weborca.mjs
node scripts/qa-fullflow-weborca.mjs
Phase 3
Phase 4
fullflow
any mutation request
```

Build the review package from merged source and sanitized evidence only:

```bash
./scripts/create-review-package.sh \
  --run-id "${RUN_ID}" \
  --out-dir "${EVIDENCE_DIR}" \
  --name-suffix -with-readonly-diagnostics \
  --include-review-log-manifest "${EVIDENCE_DIR}/REVIEW_LOG_INCLUSIONS_MANIFEST.txt"
```

Validate the final ZIP metadata. The command log must include `target_path` and `target_sha256` for the final ZIP.

```bash
FINAL_ZIP="${EVIDENCE_DIR}/OpenDolphin_WebClient-review-package-${RUN_ID}-with-readonly-diagnostics.zip"
FINAL_ZIP_SHA="$(shasum -a 256 "${FINAL_ZIP}" | awk '{print $1}')"

./scripts/tools/command-log-wrapper.sh \
  --run-id "${RUN_ID}" \
  --log "${EVIDENCE_DIR}/final-package-metadata-validation.log" \
  --cwd "$(pwd)" \
  --target-path "${FINAL_ZIP}" \
  --target-sha256 "${FINAL_ZIP_SHA}" \
  -- node scripts/tools/validate-review-package-metadata.mjs "${FINAL_ZIP}"
```

Finalize sanitized evidence and package sidecar summary:

```bash
node scripts/tools/orca-readonly-evidence-finalizer.mjs \
  --run-id "${RUN_ID}" \
  --evidence-dir "${EVIDENCE_DIR}" \
  --status-json "${EVIDENCE_DIR}/final-summary.status.sanitized.json" \
  --candidate-rows-json "${EVIDENCE_DIR}/candidate-rows.sanitized.json" \
  --command-log-jsonl "${EVIDENCE_DIR}/command-log.jsonl" \
  --package-zip "${FINAL_ZIP}" \
  --package-summary "${FINAL_ZIP}.summary.txt" \
  --package-secret-scan-log "${FINAL_ZIP}.secret-scan-review-bundle.log" \
  --metadata-validation-log "${EVIDENCE_DIR}/final-package-metadata-validation.log" \
  --review-log-manifest "${EVIDENCE_DIR}/REVIEW_LOG_INCLUSIONS_MANIFEST.txt"
```

Expected final artifacts:

- `final-summary.sanitized.md`
- `final-summary.sanitized.json`
- `candidate-rows.sanitized.json`
- `command-log.jsonl`
- `artifact-sha256.txt`
- `secret-scan.sanitized.txt`
- `REVIEW_PACKAGE_MANIFEST.txt`
- `REVIEW_LOG_INCLUSIONS_MANIFEST.txt`
- final ZIP metadata validation log
- final ZIP source-scope secret scan log
- package sidecar summary txt

## Tests run

| Command | Exit code | Result |
| --- | ---: | --- |
| `bash -n scripts/create-review-package.sh scripts/tools/command-log-wrapper.sh` | 0 | pass |
| `node --check scripts/tools/validate-review-package-metadata.mjs && node --check scripts/tools/scan-review-bundle.mjs && node --check scripts/tools/orca-readonly-evidence-finalizer.mjs && node --check tests/review-package/create-review-package.test.mjs` | 0 | pass |
| `node --test tests/review-package/create-review-package.test.mjs` | 1 then 0 | Initial failure was a test expectation for the old raw-artifact rejection message; updated expectation to accept the new excluded-path fail-closed message. Final run passed `22/22`. |

## Security result

- No live ORCA rerun was executed.
- No Phase 3 / Phase 4 / fullflow command was executed.
- No acceptmodv2 mutation or other mutation request was executed.
- No raw credential, cookie, Authorization, JSESSIONID, CSRF, raw ORCA body, raw patient detail, raw insurance detail, HAR, trace, video, raw screenshot, or raw network dump was added.
- `full_source_secret_scan_claim` remains `not_claimed` unless a future full source scan is explicitly run.
- `worktree_clean` remains `not_verified` for support review packages unless package-included git logs prove clean state.

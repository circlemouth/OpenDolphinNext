# Test Logs

RUN_ID: `20260423T070049Z`

| Check | Result | Sanitized evidence |
|---|---|---|
| `shasum -a 256 web-client/qa/payloads/phase4/medicalmodv2_phase4_dummy_current_wrapper_v1.json` | PASS | Matched `e0f34fa28177155bf19cc0476863bf540f8b1ff4d844ddf189b88ab327645618`. |
| sanitized runtime presence precheck | SKIP_TRIGGER | Required non-S3 runtime inputs missing; values not printed. |
| `docker info --format '{{.ServerVersion}}'` | PASS | Docker daemon available; version only recorded. |
| `node --check web-client/scripts/qa-phase4-safe-medicalmodv2.mjs` | PASS | No output. |
| `node --check web-client/scripts/qa-lib/phase4-medicalmodv2-safe-evidence.mjs` | PASS | No output. |
| wrapper dry-run | PASS | [phase4-medicalmodv2-summary.sanitized.json](/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient/docs/implementation/rwo06-phase4-medicalmodv2-skip-20260423T070049Z/wrapper-dry-run/phase4-medicalmodv2-summary.sanitized.json). |
| `npm test --prefix web-client -- --run scripts/__tests__/phase4Medicalmodv2SafeEvidence.test.ts` | PASS | 1 file / 6 tests passed; pretest web guard passed. |
| `bash -n setup-modernized-env.sh` | PASS | No output. |
| `jq empty docs/implementation/automation-handoff/HANDOFF_STATE.json` | PASS | No output. |
| `git diff --check` | PASS | No output. |
| `bash server-modernized/tools/ci/check-doc-links.sh` | PASS | No output. |
| `bash server-modernized/tools/ci/check-no-generated-artifacts.sh --root "$(git rev-parse --show-toplevel)"` | PASS | No output. |
| strict secret value scan | PASS | Zero hits for credential-bearing value/header patterns in current evidence directory. |
| forbidden artifact scan | PASS | Zero retained HAR/trace/video/screenshot/raw-network/request-XML artifacts in current evidence directory. |
| `bash server-modernized/tools/ci/check-config-contract.sh` | PASS | No output. |
| `bash server-modernized/tools/ci/check-no-direct-runtime-lookup.sh --root "$(git rev-parse --show-toplevel)"` | PASS | No output. |
| `bash server-modernized/tools/ci/check-no-runtime-ddl.sh` | PASS | No output. |
| `bash server-modernized/tools/ci/check-persistence-entities.sh` | PASS | No output. |

Credentials captured: no.

Raw artifacts captured: no.

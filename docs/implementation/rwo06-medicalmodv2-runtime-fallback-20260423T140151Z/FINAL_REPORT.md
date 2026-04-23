# RWO-06 medicalmodv2 Runtime Fallback and Live Classification

RUN_ID: `20260423T140151Z`

## Result

The non-S3 Trial runtime readiness blocker is fixed for the current `trial-local` / WebORCA Trial profile. The backend now reports readiness HTTP `200` with the ORCA check `UP`, `mode=weborca`, `credentialConfigured=true`, and `clientAuthConfigured=false`.

One safe wrapper live Trial `medicalmodv2` attempt was then executed as allowed by the active handoff. It was not accepted by ORCA business rules:

- endpoint: `POST /api/orca/official/chart-support/medical-mod-v2`
- target: `00001/00001`
- request class: `medicalmodv2`
- payload SHA-256: `e0f34fa28177155bf19cc0476863bf540f8b1ff4d844ddf189b88ab327645618`
- live action: `executed_once`
- HTTP status: `200`
- response classification: `businessRejected`
- `apiResult`: `14`
- business accepted: `false`
- completion evidence: information timestamp present; medical UID, invoice number, and data ID absent

## Root Cause

The readiness failure was caused by the approved local Trial runtime depending on a stored ORCA facility snapshot that could be absent or undecryptable after local key rotation. In the `trial-local` profile, the runtime already has an approved WebORCA Trial connection path, but `OrcaConnectionConfigStore` did not use it as a constrained, non-persisted fallback.

The fix adds a fail-closed fallback that is available only when all of these conditions hold:

- runtime environment is `trial-local`
- requested facility matches the runtime facility
- runtime ORCA target is WebORCA Trial over HTTPS
- WebORCA mode is explicit or inferred from the Trial host
- runtime ORCA user/password are present

The fallback is not persisted and does not enable client certificate auth. Non-Trial and production-like runtimes continue to fail closed.

## Verification

- Focused server tests passed:
  `mvn -f pom.server-modernized.xml -pl server-modernized -am -Dtest=OrcaConnectionConfigStoreTest,OperationsHealthResourceTest,RestOrcaTransportTest -Dsurefire.failIfNoSpecifiedTests=false test`
  Result: 31 tests, 0 failures, 0 errors.
- `setup-modernized-env.sh` completed with `OPENDOLPHIN_RUNTIME_PROFILE=orca-trial-no-object-storage`.
- Status-only readiness probe passed:
  `/api/health` HTTP `200`; `/api/health/readiness` HTTP `200`; ORCA check `UP`.
- Safe wrapper dry-run passed with no live ORCA traffic:
  `wrapper-dry-run/phase4-medicalmodv2-summary.sanitized.json`.
- Safe wrapper live Trial attempt executed once:
  `wrapper-live/phase4-medicalmodv2-summary.sanitized.json`.

## Evidence

- [summary.sanitized.json](/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient/docs/implementation/rwo06-medicalmodv2-runtime-fallback-20260423T140151Z/summary.sanitized.json)
- [dry-run wrapper summary](/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient/docs/implementation/rwo06-medicalmodv2-runtime-fallback-20260423T140151Z/wrapper-dry-run/phase4-medicalmodv2-summary.sanitized.json)
- [live wrapper summary](/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient/docs/implementation/rwo06-medicalmodv2-runtime-fallback-20260423T140151Z/wrapper-live/phase4-medicalmodv2-summary.sanitized.json)

## Claim Boundary

This run proves only the constrained `trial-local` WebORCA Trial runtime fallback and one sanitized `medicalmodv2` live classification. It does not prove `medicalmodv2` business acceptance, production ORCA readiness, S3/object-storage readiness, fullflow success, or final release readiness.

Credentials captured: `false`.
Raw artifacts captured: `false`.

## Next Task

Investigate `apiResult=14` / `businessRejected` using sanitized no-live contract tests and request-construction review. Do not run another live retry until a repo-local fix or payload-contract change is made, focused no-live verification passes, and the safe wrapper dry-run/readiness preflight passes.

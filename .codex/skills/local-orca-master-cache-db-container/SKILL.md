---
name: local-orca-master-cache-db-container
description: Use when working in OpenDolphin_WebClient to build, verify, or import OpenDolphin local ORCA master cache canonical artifacts from the submodule ORCA DB container. Covers facility-side tool-only ETL, local dev import, scheduler/upload handoff, and safety evidence without making ORCA DB a production runtime dependency.
---

# Local ORCA Master Cache From DB Container

Use this skill for OpenDolphin_WebClient tasks that ask to start the submodule ORCA DB container, extract master data, build a canonical artifact, import it into OpenDolphin local master cache, or prepare periodic production update operations.

## Safety Boundary

- Touch only OpenDolphin local master cache / master-update state / artifact metadata.
- Do not treat the cache as ORCA source of truth, chart source of truth, prescription source of truth, billing source of truth, ORCA send success, accounting reflection, or interaction safety confirmation.
- Production OpenDolphin runtime and scheduler must not connect to ORCA DB, `ORCADS`, `ORCA_DB_*`, or `jma-receipt-docker-db-1`.
- ORCA DB container is allowed only as facility-side/tool-only ETL input or dev/staging parity oracle.
- Do not log or preserve ORCA credentials, DB credentials, credential-bearing URLs, raw ORCA bodies, patient data, internal SQL errors, or stack traces in evidence.
- `NOT_IMPORTED` / `UNAVAILABLE` / `STALE` must stay visible as state, never as “0件”.

## Quick Workflow

1. Run the repository preflight:
   - `date -u +%Y%m%dT%H%M%SZ`
   - `git status --short`
   - Confirm `client/` and legacy `server/` are read-only.
2. Build the DB-container artifact.
   - Preferred runner:
     ```bash
     ORCA_DB_PASSWORD=<local-secret> \
       server-modernized/tools/local-master-cache/run-db-container-local-master-cache-import.sh
     ```
   - For local dev import into the running OpenDolphin Postgres:
     ```bash
     ORCA_DB_PASSWORD=<local-secret> \
       server-modernized/tools/local-master-cache/run-db-container-local-master-cache-import.sh --import-local-dev
     ```
   - Add `--run-orca-master-update` only when the local ORCA container should run its standard master update before extraction.
3. Production handoff:
   - Do not use `--import-local-dev`.
   - Publish only the generated ZIP and sha256 to an HTTPS allowlisted artifact location.
   - Configure cloud OpenDolphin with `MASTER_UPDATE_LOCAL_ORCA_MASTER_CACHE_SOURCE_URL`, `MASTER_UPDATE_SOURCE_ALLOWED_HOSTS`, and `MASTER_UPDATE_SCHEDULER_ENABLED=true`, or use the admin upload UI/API with step-up.
4. Verify after import:
   - Confirm `opendolphin.local_orca_master_dataset.cache_status=CURRENT`.
   - Confirm 14 required master types exist.
   - Query representative APIs such as drug, address, order inputsets, and interactions; responses must include local cache metadata and must not hit ORCA DB.
   - Check recent server logs for absence of `ORCA_DATASOURCE_CONNECTION_FAILURE`, `ORCADS`, and `jma-receipt-docker-db-1` during master API calls.
5. Run focused gates:
   ```bash
   bash -n server-modernized/tools/local-master-cache/build-from-orca-db-container.sh
   bash -n server-modernized/tools/local-master-cache/run-db-container-local-master-cache-import.sh
   mvn -f pom.server-modernized.xml -pl server-modernized -am \
     -Dtest=LocalOrcaMasterCacheImportServiceTest,MasterUpdateArtifactsTest,MasterUpdateCatalogTest,MasterUpdateServiceTest,MasterUpdateSchedulerTest,LocalOrcaMasterCacheBoundaryTest,FreshSchemaBaselineTest \
     -Dsurefire.failIfNoSpecifiedTests=false test
   bash server-modernized/tools/ci/check-no-direct-runtime-lookup.sh --root "$(git rev-parse --show-toplevel)"
   git diff --check
   ```
6. Final inventory:
   ```bash
   rg -n "jma-receipt-docker-db-1|ORCADS|ORCA_DB_|orca\\.db|TBL_|tbl_" \
     server-modernized web-client docs setup-modernized-env.sh docker-compose*.yml
   ```

## Evidence Rules

- Keep generated artifacts under `artifacts/local-master-cache/<RUN_ID>/`.
- Keep only sanitized artifact ZIP, sha256/manifest summaries, and command summaries.
- Remove cookies, CSRF tokens, raw session files, extracted CSVs, and temporary DB copies before final reporting.
- In the final report, classify DB-direct references as:
  - A: production runtime direct DB lookup that must be removed
  - B: ORCA official API source-of-truth integration
  - C: dev-only / tool-only / test-only isolated reference
  - D: docs / reference / archive only

## Key Files

- `server-modernized/tools/local-master-cache/build-from-orca-db-container.sh`
- `server-modernized/tools/local-master-cache/run-db-container-local-master-cache-import.sh`
- `server-modernized/tools/local-master-cache/import-canonical-artifact-to-local-dev-db.sql`
- `docs/runbooks/local-master-cache-import.md`
- `docs/contracts/orca-master-api.md`
- `docs/contracts/runtime-config.md`
- `docs/contracts/orca-route-taxonomy.md`

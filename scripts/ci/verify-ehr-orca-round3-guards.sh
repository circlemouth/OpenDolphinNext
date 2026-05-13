#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

cd "$ROOT_DIR"
mvn -f pom.server-modernized.xml -pl server-modernized -am -Dsurefire.failIfNoSpecifiedTests=false \
  -Dtest=PublicRouteInventoryContractTest,WebXmlEndpointExposureTest test

cd "$ROOT_DIR/web-client"
npm run verify:web-guard

if [[ -d dist ]]; then
  npm run verify:prod-bundle-secrets
else
  echo "[verify-ehr-orca-round3-guards] web-client/dist not found; run 'cd web-client && npm run build' for production bundle secret scan."
fi

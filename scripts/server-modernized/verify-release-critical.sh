#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TESTS="AdminConfigResourceTest,PublicRouteInventoryContractTest,WebXmlEndpointExposureTest,ChartEventServiceBeanNotifyEventTest,ChartEventStreamResourceTest,OrcaApiProxySupportTest"

cd "${ROOT_DIR}"
bash ./scripts/ci/verify-phase3-surface-guards.sh server

mvn -f pom.server-modernized.xml \
  -pl server-modernized \
  -am \
  -Dtest="${TESTS}" \
  -Dsurefire.failIfNoSpecifiedTests=false \
  test

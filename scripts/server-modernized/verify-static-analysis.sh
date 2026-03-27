#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

cd "${ROOT_DIR}"
bash ./scripts/ci/verify-phase3-surface-guards.sh all

mvn -B -ntp \
  -f pom.server-modernized.xml \
  -Pstatic-analysis,dependency-hygiene \
  -Dstatic.analysis.enforce=true \
  -DskipTests \
  -pl reporting,server-modernized \
  -am \
  verify

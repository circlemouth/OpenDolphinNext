#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

cd "${ROOT_DIR}"
mvn -f pom.server-modernized.xml \
  -pl reporting \
  -am \
  -Dtest=PdfSigningServiceTest \
  -Dsurefire.failIfNoSpecifiedTests=false \
  test

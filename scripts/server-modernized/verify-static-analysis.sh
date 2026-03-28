#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

cd "${ROOT_DIR}"
exec mvn -f pom.server-modernized.xml -pl server-modernized -am -Pstatic-analysis verify

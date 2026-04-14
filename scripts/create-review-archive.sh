#!/usr/bin/env bash

set -euo pipefail

cat <<'EOF' >&2
scripts/create-review-archive.sh is retired.

Use the reviewer submission packet workflow instead:
  ./scripts/create-reviewer-submission-packet.sh --run-id <RUN_ID> --accepted-ref <BRANCH>
  ./scripts/validate-reviewer-submission-packet.sh --run-id <RUN_ID> --accepted-ref <BRANCH>

The old logs-only archive is not an accepted reviewer submission artifact.
EOF
exit 1

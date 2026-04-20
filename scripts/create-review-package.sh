#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
SCAN_REVIEW_BUNDLE_SCRIPT="$SCRIPT_DIR/tools/scan-review-bundle.mjs"
ZIP_COMPAT_SCRIPT="$SCRIPT_DIR/tools/zip-compat.mjs"

if ROOT_DIR="$(git rev-parse --show-toplevel 2>/dev/null)"; then
  IS_GIT_WORKTREE=1
else
  ROOT_DIR="$(pwd -P)"
  IS_GIT_WORKTREE=0
fi
cd "$ROOT_DIR"

usage() {
  cat <<'USAGE'
Usage:
  ./scripts/create-review-package.sh [--run-id RUN_ID] [--out-dir PATH] [--name-suffix SUFFIX] [--include-review-log-manifest PATH]

Options:
  --run-id                       Package id in format YYYYMMDDTHHMMSSZ (default: current UTC timestamp)
  --out-dir                      Directory to output the zip file (default: ./artifacts/review-bundles)
  --name-suffix                  Suffix appended after RUN_ID in the zip filename, e.g. -with-dynamic-evidence
  --include-review-log-manifest  Add this manifest and its bullet-listed log files as package evidence
  -h, --help                     Show this message

Creates one reviewer package zip for this repository using git tracked files as the base.
When run from an extracted source subset without .git metadata, it packages the
present subset files with git commit, branch, and clean-state truth set to
not_verified.
The package excludes:
  - client/
  - server/
  - artifacts/
  - node_modules/
  - dist/, target/, build/, out/
  - tmp/, output/, coverage/, test-results/
  - caches and temporary editor/runtime outputs
Additionally, if present, the package includes:
  - qa/browser-manual-qa-progress.json
  - qa/browser-manual-qa-report.md
If --include-review-log-manifest is provided, the package also includes that
manifest and the manifest's "- path" entries, resolved relative to the manifest
directory. Manifest-listed evidence may be generated/untracked, but must stay
inside the repository and outside excluded roots. This is for sanitized review
log evidence only; it does not make the zip a clean git checkout and it does
not include .git metadata.
USAGE
}

RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_DIR="./artifacts/review-bundles"
PACKAGE_PREFIX="OpenDolphin_WebClient-review-package"
PACKAGE_NAME_SUFFIX=""
REVIEW_LOG_MANIFEST=""
PACKAGE_MODE="extracted_review_subset"
OPTIONAL_INCLUDE_FILES=(
  "qa/browser-manual-qa-progress.json"
  "qa/browser-manual-qa-report.md"
)

while [[ $# -gt 0 ]]; do
  case "$1" in
    --run-id)
      RUN_ID="${2:-}"
      shift 2
      ;;
    --out-dir)
      OUT_DIR="${2:-}"
      shift 2
      ;;
    --name-suffix)
      PACKAGE_NAME_SUFFIX="${2:-}"
      shift 2
      ;;
    --include-review-log-manifest)
      REVIEW_LOG_MANIFEST="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ -n "$PACKAGE_NAME_SUFFIX" && ! "$PACKAGE_NAME_SUFFIX" =~ ^[-._A-Za-z0-9]+$ ]]; then
  echo "--name-suffix may only contain alphanumeric characters, dash, dot, and underscore" >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "node command not found" >&2
  exit 1
fi

if [[ ! -f "$SCAN_REVIEW_BUNDLE_SCRIPT" ]]; then
  echo "review bundle scanner not found: $SCAN_REVIEW_BUNDLE_SCRIPT" >&2
  exit 1
fi

if [[ ! -f "$ZIP_COMPAT_SCRIPT" ]]; then
  echo "zip compatibility tool not found: $ZIP_COMPAT_SCRIPT" >&2
  exit 1
fi

calculate_sha256() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  else
    shasum -a 256 "$1" | awk '{print $1}'
  fi
}

file_size_bytes() {
  wc -c < "$1" | awk '{print $1}'
}

zip_create_from_file_list() {
  local zip_path="$1"
  local file_list="$2"
  if command -v zip >/dev/null 2>&1; then
    zip -q "$zip_path" -@ < "$file_list"
  else
    node "$ZIP_COMPAT_SCRIPT" create-from-stdin "$zip_path" < "$file_list"
  fi
}

zip_add_junk_file() {
  local zip_path="$1"
  local file_path="$2"
  if command -v zip >/dev/null 2>&1; then
    zip -q "$zip_path" "$file_path" -j
  else
    node "$ZIP_COMPAT_SCRIPT" create "$zip_path" --junk-paths "$file_path"
  fi
}

zip_list_entries() {
  local zip_path="$1"
  if command -v zipinfo >/dev/null 2>&1; then
    zipinfo -1 "$zip_path"
  else
    node "$ZIP_COMPAT_SCRIPT" list "$zip_path"
  fi
}

absolute_file_path() {
  local input_path="$1"
  local input_dir
  local input_base
  input_dir="$(dirname "$input_path")"
  input_base="$(basename "$input_path")"
  printf '%s/%s\n' "$(cd "$input_dir" && pwd -P)" "$input_base"
}

repo_relative_path() {
  local input_path="$1"
  local input_dir
  local input_base
  local input_abs
  input_dir="$(dirname "$input_path")"
  input_base="$(basename "$input_path")"
  input_abs="$(cd "$input_dir" && pwd -P)/$input_base"
  case "$input_abs" in
    "$ROOT_DIR"/*)
      printf '%s\n' "${input_abs#"$ROOT_DIR"/}"
      ;;
    *)
      echo "review log manifest entry is outside repository: $input_path" >&2
      exit 1
      ;;
  esac
}

is_excluded_package_path() {
  case "$1" in
    .git|.git/*|client/*|server/*|artifacts/*|web-client/artifacts/*|node_modules/*|*/node_modules/*|dist/*|*/dist/*|target/*|*/target/*|build/*|*/build/*|out/*|*/out/*|coverage/*|*/coverage/*|test-results/*|*/test-results/*|tmp/*|output/*|.cache/*|*/.cache/*|.vite/*|*/.vite/*|.parcel-cache/*|*/.parcel-cache/*|.turbo/*|*/.turbo/*|.nyc_output/*|*/.nyc_output/*|*.tsbuildinfo|*/.DS_Store|*/Thumbs.db)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

is_excluded_source_path() {
  case "$1" in
    *.log|*/*.log)
      return 0
      ;;
  esac
  is_excluded_package_path "$1"
}

validate_sanitized_review_evidence_path() {
  local repo_path="$1"
  local lower_path
  lower_path="$(printf '%s' "$repo_path" | tr '[:upper:]' '[:lower:]')"

  case "$lower_path" in
    *raw*|*/har/*|*.har|*network*|*requests*|*request-xml*|*response-xml*|*stacktrace*|*screenshot*|*trace*|*/traces/*|*/video/*|*/videos/*|*.xml|*.html|*.htm|*.png|*.jpg|*.jpeg|*.webm|*.mp4|*.zip|*.gz|*.tgz)
      if [[ "$lower_path" != *".sanitized."* ]]; then
        echo "review log manifest entry appears to be a raw artifact and is not allowed: $repo_path" >&2
        exit 1
      fi
      ;;
  esac

  case "$lower_path" in
    *.log|*.md|*.txt|*.sanitized.json|*summary.json|*report.json|*progress.json|*manifest.json|*manifest.txt|*command-log.json)
      return 0
      ;;
    *)
      echo "review log manifest entry must be a sanitized summary, report, manifest, or command log: $repo_path" >&2
      exit 1
      ;;
  esac
}

validate_command_log_evidence() {
  local log_path="$1"

  if [[ ! -s "$log_path" ]]; then
    echo "review log manifest entry is empty and cannot be pass evidence: $log_path" >&2
    exit 1
  fi

  grep -Eq '^command=' "$log_path" || {
    echo "review command log missing command metadata: $log_path" >&2
    exit 1
  }
  grep -Eq '^cwd=' "$log_path" || {
    echo "review command log missing cwd metadata: $log_path" >&2
    exit 1
  }
  grep -Eq '^(runId|RUN_ID)=' "$log_path" || {
    echo "review command log missing runId metadata: $log_path" >&2
    exit 1
  }
  grep -Eq '^start(_utc)?=' "$log_path" || {
    echo "review command log missing start metadata: $log_path" >&2
    exit 1
  }
  grep -Eq '^end(_utc)?=' "$log_path" || {
    echo "review command log missing end metadata: $log_path" >&2
    exit 1
  }
  grep -Eq '^exit(_code)?=' "$log_path" || {
    echo "review command log missing exit code metadata: $log_path" >&2
    exit 1
  }
}

validate_json_command_log_evidence() {
  local log_path="$1"

  if [[ ! -s "$log_path" ]]; then
    echo "review JSON command log is empty and cannot be pass evidence: $log_path" >&2
    exit 1
  fi

  node - "$log_path" <<'NODE'
const fs = require('node:fs');
const logPath = process.argv[2];
let parsed;
try {
  parsed = JSON.parse(fs.readFileSync(logPath, 'utf8'));
} catch {
  console.error(`review JSON command log is not valid JSON: ${logPath}`);
  process.exit(1);
}

const entries = Array.isArray(parsed) ? parsed : parsed?.commands;
if (!Array.isArray(entries) || entries.length === 0) {
  console.error(`review JSON command log must contain a non-empty command array: ${logPath}`);
  process.exit(1);
}

const required = ['command', 'cwd', 'runId', 'start', 'end', 'exit_code'];
for (const [index, entry] of entries.entries()) {
  for (const key of required) {
    if (entry?.[key] === undefined || entry?.[key] === null || entry?.[key] === '') {
      console.error(`review JSON command log entry ${index} missing ${key}: ${logPath}`);
      process.exit(1);
    }
  }
}
NODE
}

validate_package_source_secret_scan_log() {
  local log_path="$1"
  local repo_path="$2"

  grep -Eq '^exit(_code)?=0$' "$log_path" || {
    echo "secret-scan-review-bundle.log is not passing command evidence: $repo_path" >&2
    exit 1
  }
  grep -Eq '^result=PASS$' "$log_path" || {
    echo "secret-scan-review-bundle.log is missing PASS result evidence: $repo_path" >&2
    exit 1
  }
  grep -Eq '^target_path=' "$log_path" || {
    echo "secret-scan-review-bundle.log is missing exact target path evidence: $repo_path" >&2
    exit 1
  }
  grep -Eq '^target_sha256=[0-9a-f]{64}$' "$log_path" || {
    echo "secret-scan-review-bundle.log is missing exact target sha256 evidence: $repo_path" >&2
    exit 1
  }
  grep -Fq 'review bundle included source scope secret scan passed:' "$log_path" || {
    echo "secret-scan-review-bundle.log does not prove package source-scope secret scan passed: $repo_path" >&2
    exit 1
  }
}

SECRET_SCAN_FILE_COUNT=0
scan_review_evidence_for_forbidden_secrets() {
  local evidence_path="$1"
  local evidence_label="$2"
  local patterns=(
    "authorization_header:(^|[[:space:]])authorization[[:space:]]*[:=]"
    "cookie_header:(^|[[:space:]])set-cookie[[:space:]]*:|(^|[[:space:]])cookie[[:space:]]*:"
    "jsessionid:jsessionid[[:space:]]*[=:]"
    "csrf_token:(^|[^A-Za-z0-9_])(x-csrf-token|csrf[-_]?token|csrf)[[:space:]\"'_-]*[:=]"
    "raw_session:(raw[-_]?session|session[-_]?id|session_id|session)[[:space:]\"'_-]*[:=]"
    "raw_password:(raw[-_]?password|password|passwd|pwd)[[:space:]\"'_-]*[:=][[:space:]\"']*[^[:space:]\"',;}]+"
    "credential_url:[A-Za-z][A-Za-z0-9+.-]*://[^/?#[:space:]@]+:[^/?#[:space:]@]+@"
  )

  SECRET_SCAN_FILE_COUNT=$((SECRET_SCAN_FILE_COUNT + 1))
  for item in "${patterns[@]}"; do
    local name="${item%%:*}"
    local pattern="${item#*:}"
    if LC_ALL=C grep -Eiq "$pattern" "$evidence_path"; then
      echo "forbidden credential pattern found in included review evidence: path=$evidence_label pattern=$name" >&2
      exit 1
    fi
  done
}

mkdir -p "$OUT_DIR"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

FILE_LIST="$TMP_DIR/file-list.txt"
RAW_FILE_LIST="$TMP_DIR/raw-file-list.txt"
MANIFEST_FILE="$TMP_DIR/REVIEW_PACKAGE_MANIFEST.txt"
REVIEW_LOG_INCLUSIONS_FILE="$TMP_DIR/REVIEW_LOG_INCLUSIONS_MANIFEST.txt"
PACKAGE_FILE="$OUT_DIR/${PACKAGE_PREFIX}-${RUN_ID}${PACKAGE_NAME_SUFFIX}.zip"
PACKAGE_SUMMARY_FILE="${PACKAGE_FILE}.summary.txt"
PACKAGE_SUMMARY_BASENAME="$(basename "$PACKAGE_SUMMARY_FILE")"
PACKAGE_SCAN_LOG="${PACKAGE_FILE}.secret-scan-review-bundle.log"
PACKAGE_SCAN_LOG_BASENAME="$(basename "$PACKAGE_SCAN_LOG")"

if [[ "$IS_GIT_WORKTREE" -eq 1 ]]; then
  GIT_COMMIT="$(git rev-parse HEAD 2>/dev/null || printf 'not_verified')"
  GIT_BRANCH="$(git branch --show-current 2>/dev/null || true)"
  if [[ -z "$GIT_BRANCH" ]]; then
    GIT_BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || printf 'not_verified')"
  fi

  git -c core.quotePath=false ls-files -- \
    . \
    ':(exclude)client/**' \
    ':(exclude)server/**' \
    ':(exclude)artifacts/**' \
    ':(exclude)web-client/artifacts/**' \
    ':(exclude)node_modules/**' \
    ':(exclude)**/node_modules/**' \
    ':(exclude)dist/**' \
    ':(exclude)**/dist/**' \
    ':(exclude)target/**' \
    ':(exclude)**/target/**' \
    ':(exclude)build/**' \
    ':(exclude)**/build/**' \
    ':(exclude)out/**' \
    ':(exclude)**/out/**' \
    ':(exclude)coverage/**' \
    ':(exclude)**/coverage/**' \
    ':(exclude)test-results/**' \
    ':(exclude)**/test-results/**' \
    ':(exclude)tmp/**' \
    ':(exclude)output/**' \
    ':(exclude).cache/**' \
    ':(exclude)**/.cache/**' \
    ':(exclude).vite/**' \
    ':(exclude)**/.vite/**' \
    ':(exclude).parcel-cache/**' \
    ':(exclude)**/.parcel-cache/**' \
    ':(exclude).turbo/**' \
    ':(exclude)**/.turbo/**' \
    ':(exclude).nyc_output/**' \
    ':(exclude)**/.nyc_output/**' \
    ':(exclude)**/*.log' \
    ':(exclude)**/*.tsbuildinfo' \
    ':(exclude)**/.DS_Store' \
    ':(exclude)**/Thumbs.db' \
    > "$RAW_FILE_LIST"
else
  GIT_COMMIT="not_verified"
  GIT_BRANCH="not_verified"
  find . -type f ! -path './.git/*' -print | sed 's#^\./##' | while IFS= read -r subset_path; do
    if ! is_excluded_source_path "$subset_path"; then
      printf '%s\n' "$subset_path"
    fi
  done > "$RAW_FILE_LIST"
fi

WORKTREE_CLEAN="not_verified"

: > "$FILE_LIST"
TRACKED_MISSING=()
while IFS= read -r tracked_path; do
  if [[ -e "$tracked_path" ]]; then
    printf '%s\n' "$tracked_path" >> "$FILE_LIST"
  else
    TRACKED_MISSING+=("$tracked_path")
  fi
done < "$RAW_FILE_LIST"

TRACKED_FILE_COUNT="$(wc -l < "$FILE_LIST" | awk '{print $1}')"
TRACKED_MISSING_FILE_COUNT="${#TRACKED_MISSING[@]}"

OPTIONAL_INCLUDED=()
for include_path in "${OPTIONAL_INCLUDE_FILES[@]}"; do
  if [[ -f "$include_path" ]] && ! grep -Fxq "$include_path" "$FILE_LIST"; then
    validate_sanitized_review_evidence_path "$include_path"
    scan_review_evidence_for_forbidden_secrets "$include_path" "$include_path"
    printf '%s\n' "$include_path" >> "$FILE_LIST"
    OPTIONAL_INCLUDED+=("$include_path")
  fi
done

REVIEW_LOG_INCLUDED=()
BUNDLE_INCLUDED_SOURCE_SCOPE_SECRET_SCAN_CLAIM="not_claimed"
BUNDLE_INCLUDED_SOURCE_SCOPE_SECRET_SCAN_EVIDENCE="none"
if [[ -n "$REVIEW_LOG_MANIFEST" ]]; then
  if [[ ! -f "$REVIEW_LOG_MANIFEST" ]]; then
    echo "review log manifest not found: $REVIEW_LOG_MANIFEST" >&2
    exit 1
  fi

  MANIFEST_DIR="$(dirname "$REVIEW_LOG_MANIFEST")"
  MANIFEST_REPO_PATH=""
  if [[ "$IS_GIT_WORKTREE" -eq 1 ]]; then
    MANIFEST_REPO_PATH="$(git -c core.quotePath=false ls-files --full-name -- "$REVIEW_LOG_MANIFEST" | head -n 1)"
  fi
  if [[ -z "$MANIFEST_REPO_PATH" ]]; then
    MANIFEST_REPO_PATH="$(repo_relative_path "$REVIEW_LOG_MANIFEST")"
  fi
  if is_excluded_package_path "$MANIFEST_REPO_PATH"; then
    echo "review log manifest is excluded from review packages: $MANIFEST_REPO_PATH" >&2
    exit 1
  fi
  scan_review_evidence_for_forbidden_secrets "$REVIEW_LOG_MANIFEST" "$MANIFEST_REPO_PATH"
  if ! grep -Fxq "$MANIFEST_REPO_PATH" "$FILE_LIST"; then
    printf '%s\n' "$MANIFEST_REPO_PATH" >> "$FILE_LIST"
    REVIEW_LOG_INCLUDED+=("$MANIFEST_REPO_PATH")
  fi

  while IFS= read -r log_path; do
    [[ -z "$log_path" ]] && continue
    if [[ "$log_path" = /* || "$log_path" == *".."* ]]; then
      echo "unsafe review log manifest entry: $log_path" >&2
      exit 1
    fi
    repo_path="$MANIFEST_DIR/$log_path"
    if [[ ! -f "$repo_path" ]]; then
      echo "review log manifest entry not found: $repo_path" >&2
      exit 1
    fi
    case "$repo_path" in
      *.log)
        validate_command_log_evidence "$repo_path"
        ;;
      *command-log.json)
        validate_json_command_log_evidence "$repo_path"
        ;;
    esac
    tracked_repo_path=""
    if [[ "$IS_GIT_WORKTREE" -eq 1 ]]; then
      tracked_repo_path="$(git -c core.quotePath=false ls-files --full-name -- "$repo_path" | head -n 1)"
    fi
    if [[ -n "$tracked_repo_path" ]]; then
      repo_path="$tracked_repo_path"
    else
      repo_path="$(repo_relative_path "$repo_path")"
    fi
    if is_excluded_package_path "$repo_path"; then
      echo "review log manifest entry is excluded from review packages: $repo_path" >&2
      exit 1
    fi
    validate_sanitized_review_evidence_path "$repo_path"
    scan_review_evidence_for_forbidden_secrets "$repo_path" "$repo_path"
    if [[ "$(basename "$repo_path")" == "secret-scan-review-bundle.log" ]]; then
      validate_package_source_secret_scan_log "$repo_path" "$repo_path"
      BUNDLE_INCLUDED_SOURCE_SCOPE_SECRET_SCAN_CLAIM="passed"
      if [[ "$BUNDLE_INCLUDED_SOURCE_SCOPE_SECRET_SCAN_EVIDENCE" == "none" ]]; then
        BUNDLE_INCLUDED_SOURCE_SCOPE_SECRET_SCAN_EVIDENCE="$repo_path"
      else
        BUNDLE_INCLUDED_SOURCE_SCOPE_SECRET_SCAN_EVIDENCE="${BUNDLE_INCLUDED_SOURCE_SCOPE_SECRET_SCAN_EVIDENCE},${repo_path}"
      fi
    fi
    if ! grep -Fxq "$repo_path" "$FILE_LIST"; then
      printf '%s\n' "$repo_path" >> "$FILE_LIST"
      REVIEW_LOG_INCLUDED+=("$repo_path")
    fi
  done < <(sed -n 's/^- //p' "$REVIEW_LOG_MANIFEST")
fi

FILE_COUNT="$(wc -l < "$FILE_LIST" | awk '{print $1}')"
OPTIONAL_INCLUDE_COUNT="${#OPTIONAL_INCLUDED[@]}"
REVIEW_LOG_INCLUDE_COUNT="${#REVIEW_LOG_INCLUDED[@]}"
if [[ "$REVIEW_LOG_INCLUDE_COUNT" -gt 0 || "$OPTIONAL_INCLUDE_COUNT" -gt 0 ]]; then
  SECRET_SCAN_SCOPE="dynamic_review_evidence_only"
  DYNAMIC_SECRET_SCAN_CLAIM="passed"
  SECRET_SCAN_CLEAN_LABEL="dynamic_review_evidence_passed"
else
  SECRET_SCAN_SCOPE="no_dynamic_review_evidence"
  DYNAMIC_SECRET_SCAN_CLAIM="not_applicable"
  SECRET_SCAN_CLEAN_LABEL="not_applicable"
fi
if [[ "$OPTIONAL_INCLUDE_COUNT" -gt 0 ]]; then
  OPTIONAL_INCLUDES_CSV="$(printf '%s\n' "${OPTIONAL_INCLUDED[@]}" | paste -sd, -)"
else
  OPTIONAL_INCLUDES_CSV="none"
fi
if [[ "$REVIEW_LOG_INCLUDE_COUNT" -gt 0 ]]; then
  REVIEW_LOG_INCLUDES_CSV="$(printf '%s\n' "${REVIEW_LOG_INCLUDED[@]}" | paste -sd, -)"
else
  REVIEW_LOG_INCLUDES_CSV="none"
fi

if [[ "$FILE_COUNT" -eq 0 ]]; then
  echo "No tracked files remained after exclusions" >&2
  exit 1
fi

TRACKED_MISSING_BLOCK=""
if [[ "$TRACKED_MISSING_FILE_COUNT" -gt 0 ]]; then
  TRACKED_MISSING_BLOCK="$(
    {
      echo "tracked_missing_files_begin"
      for missing_path in "${TRACKED_MISSING[@]}"; do
        printf 'path=%s reason=tracked_by_git_but_absent_in_worktree source=git_ls_files category=source-test-docs criticality=critical\n' "$missing_path"
      done
      echo "tracked_missing_files_end"
    }
  )"
else
  TRACKED_MISSING_BLOCK="tracked_missing_files=none"
fi

cat > "$MANIFEST_FILE" <<EOF
review_package_name=${PACKAGE_PREFIX}-${RUN_ID}${PACKAGE_NAME_SUFFIX}.zip
packageMode=${PACKAGE_MODE}
run_id=${RUN_ID}
created_at_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)
root_dir=.
source_git_metadata_available=$([[ "$IS_GIT_WORKTREE" -eq 1 ]] && printf 'yes' || printf 'no')
source_commit=${GIT_COMMIT}
source_branch=${GIT_BRANCH}
worktree_clean=${WORKTREE_CLEAN}
tracked_file_count=${FILE_COUNT}
tracked_git_file_count=${TRACKED_FILE_COUNT}
tracked_missing_file_count=${TRACKED_MISSING_FILE_COUNT}
${TRACKED_MISSING_BLOCK}
optional_include_count=${OPTIONAL_INCLUDE_COUNT}
optional_includes=${OPTIONAL_INCLUDES_CSV}
review_log_include_count=${REVIEW_LOG_INCLUDE_COUNT}
review_log_includes=${REVIEW_LOG_INCLUDES_CSV}
review_log_schema=command_logs_require_command_cwd_runId_start_end_exit_code_and_non_empty_content
review_log_inclusions_manifest_entry=REVIEW_LOG_INCLUSIONS_MANIFEST.txt
package_integrity_summary_file=${PACKAGE_SUMMARY_BASENAME}
zip_file_count=recorded_in_external_sidecar
zip_size_bytes=recorded_in_external_sidecar
zip_sha256=recorded_in_external_sidecar
git_metadata_included=no
clean_checkout_claim=not_verified
git_claim_evidence_policy=git claims require package-included local git command logs; this support zip does not include .git metadata or claim clean checkout truth
secret_scan_scope=${SECRET_SCAN_SCOPE}
dynamic_review_evidence_secret_scan_claim=${DYNAMIC_SECRET_SCAN_CLAIM}
secret_scan_file_count=${SECRET_SCAN_FILE_COUNT}
secret_scan_claim=${SECRET_SCAN_CLEAN_LABEL}
dynamic_secret_scan_claim=${DYNAMIC_SECRET_SCAN_CLAIM}
bundle_included_source_scope_secret_scan_claim=${BUNDLE_INCLUDED_SOURCE_SCOPE_SECRET_SCAN_CLAIM}
bundle_included_source_scope_secret_scan_evidence=${BUNDLE_INCLUDED_SOURCE_SCOPE_SECRET_SCAN_EVIDENCE}
full_source_secret_scan_claim=not_claimed
package_source_secret_scan_claim=recorded_in_external_sidecar
package_source_secret_scan_scope=final_review_zip_post_creation
package_source_secret_scan_evidence=${PACKAGE_SCAN_LOG_BASENAME}
orca_phase2_5_zero_candidate_verdict=PARTIAL_TEST_DATA_OR_HARNESS_READINESS_BLOCKER
orca_phase2_5_zero_candidate_semantics=acceptedCandidateCount_0_means_00001_to_00011_lack_current_read_only_mutation_ready_evidence_across_harness_api_auth_parser_readiness_exact_preflight_criteria_not_official_initial_patient_absence
guarantee_scope=extracted_review_subset_excludes_legacy_client_server_artifacts_generated_dirs_and_rejects_forbidden_dynamic_evidence_secrets
non_guarantee_scope=not_clean_checkout_evidence_not_full_source_secret_scan_not_live_orca_evidence_not_git_truth
policy=tracked-files-plus-optional-qa
excluded_roots=client/,server/,artifacts/
excluded_generated_dirs=node_modules/,dist/,target/,build/,out/,tmp/,output/,coverage/,test-results/
excluded_cache_dirs=.cache/,.vite/,.parcel-cache/,.turbo/,.nyc_output/
raw_artifact_policy=raw_orca_artifacts_har_network_request_response_screenshot_trace_video_and_xml_are_not_allowed_as_manifest_listed_review_evidence
notes=Repository reviewer support package without artifacts or legacy client sources. Includes sanitized browser manual QA summary files when present. This zip has no .git directory and must not be used as clean checkout evidence or full-source secret-scan evidence.
EOF

cat > "$REVIEW_LOG_INCLUSIONS_FILE" <<EOF
review_log_inclusions_manifest_version=1
run_id=${RUN_ID}
created_at_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)
review_log_schema=command_logs_require_command_cwd_runId_start_end_exit_code_and_non_empty_content
review_log_include_count=${REVIEW_LOG_INCLUDE_COUNT}
review_log_includes=${REVIEW_LOG_INCLUDES_CSV}
source_manifest=$([[ -n "$REVIEW_LOG_MANIFEST" ]] && printf '%s' "$MANIFEST_REPO_PATH" || printf 'none')
dynamic_review_evidence_secret_scan_claim=${DYNAMIC_SECRET_SCAN_CLAIM}
bundle_included_source_scope_secret_scan_claim=${BUNDLE_INCLUDED_SOURCE_SCOPE_SECRET_SCAN_CLAIM}
bundle_included_source_scope_secret_scan_evidence=${BUNDLE_INCLUDED_SOURCE_SCOPE_SECRET_SCAN_EVIDENCE}
package_source_secret_scan_evidence=${PACKAGE_SCAN_LOG_BASENAME}
empty_log_policy=empty_logs_do_not_count_as_pass_evidence
EOF

rm -f "$PACKAGE_FILE"
rm -f "$PACKAGE_SUMMARY_FILE"
rm -f "$PACKAGE_SCAN_LOG"
zip_create_from_file_list "$PACKAGE_FILE" "$FILE_LIST"
zip_add_junk_file "$PACKAGE_FILE" "$MANIFEST_FILE"
zip_add_junk_file "$PACKAGE_FILE" "$REVIEW_LOG_INCLUSIONS_FILE"

BAD_PATHS="$(zip_list_entries "$PACKAGE_FILE" | grep -E '^(\.git/|client/|server/|artifacts/|web-client/artifacts/|node_modules/|dist/|target/|build/|out/|tmp/|output/|coverage/|test-results/|.*/node_modules/|.*/dist/|.*/target/|.*/build/|.*/out/|.*/coverage/|.*/test-results/)' || true)"
if [[ -n "$BAD_PATHS" ]]; then
  echo "Excluded paths were found in package:" >&2
  echo "$BAD_PATHS" >&2
  exit 1
fi

ZIP_FILE_COUNT="$(zip_list_entries "$PACKAGE_FILE" | wc -l | awk '{print $1}')"
ZIP_SIZE="$(file_size_bytes "$PACKAGE_FILE")"
ZIP_SHA="$(calculate_sha256 "$PACKAGE_FILE")"
PACKAGE_FILE_ABS="$(absolute_file_path "$PACKAGE_FILE")"

SCAN_START_UTC="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
{
  echo "command_log_version=1"
  printf 'command=node %q %q\n' "$SCAN_REVIEW_BUNDLE_SCRIPT" "$PACKAGE_FILE"
  echo "cwd=$ROOT_DIR"
  echo "runId=${RUN_ID}"
  echo "start_utc=${SCAN_START_UTC}"
  echo "target_path=${PACKAGE_FILE}"
  echo "target_sha256=${ZIP_SHA}"
  echo "--- command output ---"
} > "$PACKAGE_SCAN_LOG"
set +e
(
  cd "$ROOT_DIR" || exit 125
  node "$SCAN_REVIEW_BUNDLE_SCRIPT" "$PACKAGE_FILE"
) >> "$PACKAGE_SCAN_LOG" 2>&1
SCAN_EXIT_CODE=$?
set -e
SCAN_END_UTC="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
{
  echo "--- command summary ---"
  echo "end_utc=${SCAN_END_UTC}"
  echo "exit_code=${SCAN_EXIT_CODE}"
  if [[ "$SCAN_EXIT_CODE" -eq 0 ]]; then
    echo "result=PASS"
  else
    echo "result=FAIL"
  fi
} >> "$PACKAGE_SCAN_LOG"

if [[ "$SCAN_EXIT_CODE" -ne 0 ]]; then
  echo "Final review ZIP secret scan failed. See: $PACKAGE_SCAN_LOG" >&2
  exit "$SCAN_EXIT_CODE"
fi

PACKAGE_SCAN_LOG_SHA="$(calculate_sha256 "$PACKAGE_SCAN_LOG")"

cat > "$PACKAGE_SUMMARY_FILE" <<EOF
review_package_name=$(basename "$PACKAGE_FILE")
packageMode=${PACKAGE_MODE}
review_package_file=$(basename "$PACKAGE_FILE")
run_id=${RUN_ID}
created_at_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)
zip_file_count=${ZIP_FILE_COUNT}
zip_size_bytes=${ZIP_SIZE}
zip_sha256=${ZIP_SHA}
manifest_entry=REVIEW_PACKAGE_MANIFEST.txt
review_log_inclusions_manifest_entry=REVIEW_LOG_INCLUSIONS_MANIFEST.txt
source_git_metadata_available=$([[ "$IS_GIT_WORKTREE" -eq 1 ]] && printf 'yes' || printf 'no')
source_commit=${GIT_COMMIT}
source_branch=${GIT_BRANCH}
secret_scan_scope=${SECRET_SCAN_SCOPE}
dynamic_review_evidence_secret_scan_claim=${DYNAMIC_SECRET_SCAN_CLAIM}
secret_scan_file_count=${SECRET_SCAN_FILE_COUNT}
secret_scan_claim=${SECRET_SCAN_CLEAN_LABEL}
dynamic_secret_scan_claim=${DYNAMIC_SECRET_SCAN_CLAIM}
bundle_included_source_scope_secret_scan_claim=${BUNDLE_INCLUDED_SOURCE_SCOPE_SECRET_SCAN_CLAIM}
bundle_included_source_scope_secret_scan_evidence=${BUNDLE_INCLUDED_SOURCE_SCOPE_SECRET_SCAN_EVIDENCE}
full_source_secret_scan_claim=not_claimed
package_source_secret_scan_claim=passed
package_source_secret_scan_scope=final_review_zip_post_creation
package_source_secret_scan_evidence=${PACKAGE_SCAN_LOG_BASENAME}
package_source_secret_scan_log_sha256=${PACKAGE_SCAN_LOG_SHA}
package_source_secret_scan_target_path=${PACKAGE_FILE}
package_source_secret_scan_target_abs_path=${PACKAGE_FILE_ABS}
package_source_secret_scan_target_sha256=${ZIP_SHA}
orca_phase2_5_zero_candidate_verdict=PARTIAL_TEST_DATA_OR_HARNESS_READINESS_BLOCKER
orca_phase2_5_zero_candidate_semantics=acceptedCandidateCount_0_means_00001_to_00011_lack_current_read_only_mutation_ready_evidence_across_harness_api_auth_parser_readiness_exact_preflight_criteria_not_official_initial_patient_absence
worktree_clean=${WORKTREE_CLEAN}
git_claim_evidence_policy=git claims require package-included local git command logs; this support zip does not include .git metadata or claim clean checkout truth
hash_note=external summary avoids self-referential package hash drift
EOF

echo "[INFO] created ${PACKAGE_FILE}"
echo "[INFO] files=${ZIP_FILE_COUNT} size=${ZIP_SIZE} sha256=${ZIP_SHA}"
echo "[INFO] package_summary=${PACKAGE_SUMMARY_FILE}"
echo "[DONE] RUN_ID=${RUN_ID}"

#!/usr/bin/env node
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);

function usage() {
  console.error(`usage: node scripts/tools/orca-readonly-evidence-finalizer.mjs \\
  --run-id RUN_ID \\
  --evidence-dir DIR \\
  --status-json STATUS_JSON \\
  --package-zip REVIEW_PACKAGE_ZIP \\
  --package-summary REVIEW_PACKAGE_ZIP.summary.txt \\
  --package-secret-scan-log REVIEW_PACKAGE_ZIP.secret-scan-review-bundle.log \\
  --metadata-validation-log final-package-metadata-validation.log \\
  [--review-log-manifest REVIEW_LOG_INCLUSIONS_MANIFEST.txt]`);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function parseArgs(items) {
  const values = new Map();
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (item === '--help' || item === '-h') {
      usage();
      process.exit(0);
    }
    if (!item.startsWith('--')) fail(`unknown argument: ${item}`);
    const key = item.slice(2);
    const value = items[index + 1];
    if (!value || value.startsWith('--')) fail(`missing value for --${key}`);
    values.set(key, value);
    index += 1;
  }
  return values;
}

const options = parseArgs(args);

function requiredOption(name) {
  const value = options.get(name);
  if (!value) fail(`--${name} is required`);
  return value;
}

const runId = requiredOption('run-id');
const evidenceDir = path.resolve(requiredOption('evidence-dir'));
const statusJsonPath = path.resolve(requiredOption('status-json'));
const packageZipPath = path.resolve(requiredOption('package-zip'));
const packageSummaryPath = path.resolve(requiredOption('package-summary'));
const packageSecretScanLogPath = path.resolve(requiredOption('package-secret-scan-log'));
const metadataValidationLogPath = path.resolve(requiredOption('metadata-validation-log'));
const reviewLogManifestPath = options.has('review-log-manifest')
  ? path.resolve(options.get('review-log-manifest'))
  : path.join(evidenceDir, 'REVIEW_LOG_INCLUSIONS_MANIFEST.txt');

const finalSummaryJsonPath = path.join(evidenceDir, 'final-summary.sanitized.json');
const finalSummaryMdPath = path.join(evidenceDir, 'final-summary.sanitized.md');
const secretScanPath = path.join(evidenceDir, 'secret-scan.sanitized.txt');
const artifactShaPath = path.join(evidenceDir, 'artifact-sha256.txt');

function readRequiredText(filePath, label) {
  if (!existsSync(filePath)) fail(`${label} not found: ${filePath}`);
  const text = readFileSync(filePath, 'utf8');
  if (text.trim() === '') fail(`${label} is empty: ${filePath}`);
  return text;
}

function parseKeyValue(text) {
  const values = new Map();
  for (const line of text.split(/\r?\n/)) {
    const index = line.indexOf('=');
    if (index > 0) values.set(line.slice(0, index), line.slice(index + 1));
  }
  return values;
}

function kvRequired(values, key, label) {
  const value = values.get(key);
  if (value === undefined || value === '') fail(`${label} missing ${key}`);
  return value;
}

function sha256File(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

function relativeToEvidence(filePath) {
  return path.relative(evidenceDir, filePath).replaceAll(path.sep, '/');
}

function loadJson(filePath, label) {
  try {
    return JSON.parse(readRequiredText(filePath, label));
  } catch (error) {
    fail(`${label} is not valid JSON: ${error.message}`);
  }
}

function validateCommandLog(text, label) {
  const values = parseKeyValue(text);
  for (const key of ['command', 'cwd', 'runId']) kvRequired(values, key, label);
  if (!values.has('start') && !values.has('start_utc')) fail(`${label} missing start metadata`);
  if (!values.has('end') && !values.has('end_utc')) fail(`${label} missing end metadata`);
  if (!values.has('exit') && !values.has('exit_code')) fail(`${label} missing exit code metadata`);
  const output = text.match(/^--- command output ---\r?\n([\s\S]*?)\r?\n--- command summary ---/m)?.[1] ?? '';
  if (output.trim() === '') fail(`${label} has empty command output evidence`);
  return values;
}

function statusRequired(status, key) {
  const value = status[key];
  if (value === undefined || value === null || value === '') fail(`status JSON missing ${key}`);
  return value;
}

function normalizeStatusValue(value) {
  if (Array.isArray(value)) return value.map((item) => String(item)).join(',');
  return String(value);
}

function upsertKeyValues(filePath, updates) {
  const seen = new Set();
  const lines = readRequiredText(filePath, 'package summary').split(/\r?\n/);
  const nextLines = lines.map((line) => {
    const index = line.indexOf('=');
    if (index <= 0) return line;
    const key = line.slice(0, index);
    if (!updates.has(key)) return line;
    seen.add(key);
    return `${key}=${updates.get(key)}`;
  });
  for (const [key, value] of updates) {
    if (!seen.has(key)) nextLines.push(`${key}=${value}`);
  }
  writeFileSync(filePath, nextLines.join('\n').replace(/\n*$/, '\n'), 'utf8');
}

function walkFiles(dirPath) {
  const result = [];
  for (const entry of readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      result.push(...walkFiles(fullPath));
    } else if (entry.isFile()) {
      result.push(fullPath);
    }
  }
  return result;
}

const forbiddenRawPathPattern =
  /(^|\/)(?:har|traces?|videos?|raw-screenshots?|screenshots?|raw-network-dumps?|network|requests|request-xml|response-xml)(\/|$)|(?:^|\/).*\.har$|(?:^|\/).*\.(?:png|jpe?g|webm|mp4|trace)$/i;

const forbiddenSecretRules = [
  {
    name: 'authorization-value',
    pattern:
      /\bauthorization\b\s*[:=]\s*['"]?(?:Basic|Bearer)\s+(?!(?:should-not-ship|REPLACE_WITH|[{<]|redacted\b))[A-Za-z0-9._~+/=-]{8,}/i,
  },
  {
    name: 'cookie-value',
    pattern: /(^|\s)(?:set-)?cookie\s*:\s*[^;\s=]+=(?!(?:should-not-ship|REPLACE_WITH|[$\{<]|redacted\b|secret\b))[^;\s]{8,}/i,
  },
  {
    name: 'jsessionid-value',
    pattern:
      /\bjsessionid\b\s*[=:]\s*(?!(?:should-not-ship|REPLACE_WITH|jsessionid\[|[$\{<]|redacted\b|secret\b))[A-Za-z0-9._-]{8,}/i,
  },
  {
    name: 'csrf-token-value',
    pattern:
      /\b(?:x-csrf-token|csrf[-_]?token)\b[\s"_-]*[:=]\s*['"]?(?!(?:should-not-ship|REPLACE_WITH|[$\{<]|null\b|redacted\b|csrfToken\b|extract|refreshed|scenario|Boolean))[A-Za-z0-9._-]{24,}/i,
  },
  {
    name: 'raw-session-value',
    pattern:
      /\b(?:raw[-_]?session|session[-_]?id|session_id)\b[\s"_-]*[:=]\s*['"]?(?!(?:should-not-ship|REPLACE_WITH|[$\{<]|null\b|redacted\b|response|session|scenario|Boolean))[A-Za-z0-9._-]{24,}/i,
  },
  {
    name: 'credential-bearing-url',
    pattern: /[A-Za-z][A-Za-z0-9+.-]*:\/\/(?![$\{<])[^/?#\s@]+:(?![$\{<])[^/?#\s@]+@/i,
  },
  {
    name: 'raw-password-value',
    pattern:
      /\b(?:raw[-_]?password|password|passwd|pwd)\b[\s"_-]*[:=][\s"']*(?!(?:should-not-ship|REPLACE_WITH|[$\{<]|redacted\b|masked\b|placeholder\b|not_claimed\b|not_verified\b|sample\b|dummy\b|test\b|password\b|null\b|undefined\b))[^\s"',;}]+/i,
  },
];

const textArtifactPattern = /\.(?:md|txt|json|jsonl|log|ya?ml|toml|env|sample|sh|mjs|js|ts|tsx|properties|conf|csv)$/i;

function scanTextForSecrets(filePath, label) {
  const content = readRequiredText(filePath, label);
  for (const { name, pattern } of forbiddenSecretRules) {
    if (pattern.test(content)) fail(`forbidden secret pattern found in ${label}: ${name}`);
  }
}

mkdirSync(evidenceDir, { recursive: true });

for (const [filePath, label] of [
  [statusJsonPath, 'status JSON'],
  [packageZipPath, 'review package ZIP'],
  [packageSummaryPath, 'package summary'],
  [packageSecretScanLogPath, 'package source-scope secret scan log'],
  [metadataValidationLogPath, 'final ZIP metadata validation log'],
  [reviewLogManifestPath, 'review log inclusions manifest'],
]) {
  if (!existsSync(filePath)) fail(`${label} not found: ${filePath}`);
  if (statSync(filePath).size === 0) fail(`${label} is empty: ${filePath}`);
}

const status = loadJson(statusJsonPath, 'status JSON');
const packageSummary = parseKeyValue(readRequiredText(packageSummaryPath, 'package summary'));
const packageSecretScanLogText = readRequiredText(packageSecretScanLogPath, 'package source-scope secret scan log');
const metadataValidationLogText = readRequiredText(metadataValidationLogPath, 'final ZIP metadata validation log');
const packageSecretScanLog = validateCommandLog(packageSecretScanLogText, 'package source-scope secret scan log');
validateCommandLog(metadataValidationLogText, 'final ZIP metadata validation log');

const zipSha256 = sha256File(packageZipPath);
const zipSizeBytes = String(statSync(packageZipPath).size);
const packageZipRelative = relativeToEvidence(packageZipPath);

for (const [key, expected] of [
  ['run_id', runId],
  ['packageMode', 'extracted_review_subset'],
  ['zip_sha256', zipSha256],
  ['zip_size_bytes', zipSizeBytes],
  ['package_source_secret_scan_claim', 'passed'],
  ['package_source_secret_scan_scope', 'final_review_zip_post_creation'],
  ['full_source_secret_scan_claim', 'not_claimed'],
]) {
  const actual = kvRequired(packageSummary, key, 'package summary');
  if (actual !== expected) fail(`package summary ${key} mismatch: expected=${expected} actual=${actual}`);
}

for (const key of [
  'source_branch',
  'source_commit',
  'source_git_metadata_available',
  'worktree_clean',
  'zip_file_count',
  'dynamic_review_evidence_secret_scan_claim',
]) {
  kvRequired(packageSummary, key, 'package summary');
}

if (kvRequired(packageSecretScanLog, 'target_sha256', 'package source-scope secret scan log') !== zipSha256) {
  fail('package source-scope secret scan log target_sha256 does not match final ZIP');
}
if (!/^exit(_code)?=0$/m.test(packageSecretScanLogText) || !/^result=PASS$/m.test(packageSecretScanLogText)) {
  fail('package source-scope secret scan log is not a PASS command log');
}
if (!packageSecretScanLogText.includes('review bundle included source scope secret scan passed:')) {
  fail('package source-scope secret scan log missing pass marker');
}

const statusKeys = [
  'acceptedCandidateCount',
  'exactSelectedCandidatePreflightStatus',
  'phase3Status',
  'phase4Status',
  'fullflowStatus',
  'mutationStatus',
  'c7Status',
  'targetMutationRequestCount',
  'checkedRequests',
  'blockerDimensions',
  'officialPatientget500SourceClassified',
  'insurance403SourceClassified',
  'appointment403SourceClassified',
];

for (const key of statusKeys) statusRequired(status, key);

const summaryUpdates = new Map([
  ['acceptedCandidateCount', normalizeStatusValue(status.acceptedCandidateCount)],
  ['exact_selected_candidate_preflight_status', normalizeStatusValue(status.exactSelectedCandidatePreflightStatus)],
  ['phase3_status', normalizeStatusValue(status.phase3Status)],
  ['phase4_status', normalizeStatusValue(status.phase4Status)],
  ['fullflow_status', normalizeStatusValue(status.fullflowStatus)],
  ['mutation_status', normalizeStatusValue(status.mutationStatus)],
  ['c7_status', normalizeStatusValue(status.c7Status)],
  ['targetMutationRequestCount', normalizeStatusValue(status.targetMutationRequestCount)],
  ['checkedRequests', normalizeStatusValue(status.checkedRequests)],
  ['blocker_dimensions', normalizeStatusValue(status.blockerDimensions)],
  ['official_patientget_500_source_classified', normalizeStatusValue(status.officialPatientget500SourceClassified)],
  ['insurance_403_source_classified', normalizeStatusValue(status.insurance403SourceClassified)],
  ['appointment_403_source_classified', normalizeStatusValue(status.appointment403SourceClassified)],
  [
    'insurance_appointment_403_source_classified',
    `${normalizeStatusValue(status.insurance403SourceClassified)}/${normalizeStatusValue(status.appointment403SourceClassified)}`,
  ],
  ['final_summary_sanitized_json', 'final-summary.sanitized.json'],
  ['final_summary_sanitized_md', 'final-summary.sanitized.md'],
  ['artifact_sha256', 'artifact-sha256.txt'],
  ['secret_scan_sanitized', 'secret-scan.sanitized.txt'],
  ['final_zip_metadata_validation_log', relativeToEvidence(metadataValidationLogPath)],
  ['final_zip_source_scope_secret_scan_log', relativeToEvidence(packageSecretScanLogPath)],
]);

upsertKeyValues(packageSummaryPath, summaryUpdates);
const updatedPackageSummary = parseKeyValue(readRequiredText(packageSummaryPath, 'package summary'));

const finalSummary = {
  runId,
  generatedAtUtc: new Date().toISOString(),
  source_branch: kvRequired(updatedPackageSummary, 'source_branch', 'package summary'),
  source_commit: kvRequired(updatedPackageSummary, 'source_commit', 'package summary'),
  source_git_metadata_available: kvRequired(updatedPackageSummary, 'source_git_metadata_available', 'package summary'),
  worktree_clean: kvRequired(updatedPackageSummary, 'worktree_clean', 'package summary'),
  packageMode: kvRequired(updatedPackageSummary, 'packageMode', 'package summary'),
  zip: {
    path: packageZipRelative,
    fileCount: Number(kvRequired(updatedPackageSummary, 'zip_file_count', 'package summary')),
    sizeBytes: Number(kvRequired(updatedPackageSummary, 'zip_size_bytes', 'package summary')),
    sha256: kvRequired(updatedPackageSummary, 'zip_sha256', 'package summary'),
  },
  claims: {
    package_source_secret_scan_claim: kvRequired(
      updatedPackageSummary,
      'package_source_secret_scan_claim',
      'package summary',
    ),
    package_source_secret_scan_scope: kvRequired(
      updatedPackageSummary,
      'package_source_secret_scan_scope',
      'package summary',
    ),
    full_source_secret_scan_claim: kvRequired(updatedPackageSummary, 'full_source_secret_scan_claim', 'package summary'),
    dynamic_review_evidence_secret_scan_claim: kvRequired(
      updatedPackageSummary,
      'dynamic_review_evidence_secret_scan_claim',
      'package summary',
    ),
  },
  phase2_5: {
    acceptedCandidateCount: status.acceptedCandidateCount,
    exactSelectedCandidatePreflightStatus: status.exactSelectedCandidatePreflightStatus,
    phase3Status: status.phase3Status,
    phase4Status: status.phase4Status,
    fullflowStatus: status.fullflowStatus,
    mutationStatus: status.mutationStatus,
    c7Status: status.c7Status,
    targetMutationRequestCount: status.targetMutationRequestCount,
    checkedRequests: status.checkedRequests,
    blockerDimensions: status.blockerDimensions,
    officialPatientget500SourceClassified: status.officialPatientget500SourceClassified,
    insurance403SourceClassified: status.insurance403SourceClassified,
    appointment403SourceClassified: status.appointment403SourceClassified,
  },
  artifacts: {
    packageSummary: relativeToEvidence(packageSummaryPath),
    packageSecretScanLog: relativeToEvidence(packageSecretScanLogPath),
    metadataValidationLog: relativeToEvidence(metadataValidationLogPath),
    reviewLogInclusionsManifest: relativeToEvidence(reviewLogManifestPath),
    finalSummaryJson: 'final-summary.sanitized.json',
    finalSummaryMarkdown: 'final-summary.sanitized.md',
    secretScan: 'secret-scan.sanitized.txt',
    artifactSha256: 'artifact-sha256.txt',
  },
  rawSensitiveFieldsExcluded: true,
};

writeFileSync(finalSummaryJsonPath, `${JSON.stringify(finalSummary, null, 2)}\n`, 'utf8');
writeFileSync(
  finalSummaryMdPath,
  [
    '# ORCA Trial Phase 2.5 Final Sanitized Summary',
    '',
    `RUN_ID: \`${runId}\``,
    '',
    `- source_branch: \`${finalSummary.source_branch}\``,
    `- source_commit: \`${finalSummary.source_commit}\``,
    `- source_git_metadata_available: \`${finalSummary.source_git_metadata_available}\``,
    `- worktree_clean: \`${finalSummary.worktree_clean}\``,
    `- packageMode: \`${finalSummary.packageMode}\``,
    `- zip_file_count: \`${finalSummary.zip.fileCount}\``,
    `- zip_size_bytes: \`${finalSummary.zip.sizeBytes}\``,
    `- zip_sha256: \`${finalSummary.zip.sha256}\``,
    `- package_source_secret_scan_claim: \`${finalSummary.claims.package_source_secret_scan_claim}\``,
    `- package_source_secret_scan_scope: \`${finalSummary.claims.package_source_secret_scan_scope}\``,
    `- full_source_secret_scan_claim: \`${finalSummary.claims.full_source_secret_scan_claim}\``,
    `- dynamic_review_evidence_secret_scan_claim: \`${finalSummary.claims.dynamic_review_evidence_secret_scan_claim}\``,
    `- acceptedCandidateCount: \`${normalizeStatusValue(status.acceptedCandidateCount)}\``,
    `- exact selected-candidate preflight: \`${status.exactSelectedCandidatePreflightStatus}\``,
    `- Phase 3: \`${status.phase3Status}\``,
    `- Phase 4: \`${status.phase4Status}\``,
    `- fullflow: \`${status.fullflowStatus}\``,
    `- mutation: \`${status.mutationStatus}\``,
    `- C7: \`${status.c7Status}\``,
    `- targetMutationRequestCount: \`${status.targetMutationRequestCount}\``,
    `- checkedRequests: \`${status.checkedRequests}\``,
    `- blocker dimensions: \`${normalizeStatusValue(status.blockerDimensions)}\``,
    `- official patientget 500 source classified: \`${status.officialPatientget500SourceClassified}\``,
    `- insurance 403 source classified: \`${status.insurance403SourceClassified}\``,
    `- appointment 403 source classified: \`${status.appointment403SourceClassified}\``,
    '',
    'No raw ORCA body, raw patient detail, raw insurance detail, HAR, trace, video, raw screenshot, raw network dump, credential, cookie, Authorization header, JSESSIONID, CSRF token, raw session, password, or credential-bearing URL is included.',
    '',
  ].join('\n'),
  'utf8',
);

const filesForScan = walkFiles(evidenceDir)
  .filter((filePath) => filePath !== artifactShaPath)
  .sort((left, right) => relativeToEvidence(left).localeCompare(relativeToEvidence(right)));

let scannedTextCount = 0;
for (const filePath of filesForScan) {
  const relativePath = relativeToEvidence(filePath);
  if (forbiddenRawPathPattern.test(relativePath)) fail(`forbidden raw artifact path in evidence dir: ${relativePath}`);
  if (filePath.endsWith('.zip')) continue;
  if (!textArtifactPattern.test(filePath)) continue;
  scanTextForSecrets(filePath, relativePath);
  scannedTextCount += 1;
}

writeFileSync(
  secretScanPath,
  [
    'secret_scan_sanitized_version=1',
    `run_id=${runId}`,
    `created_at_utc=${new Date().toISOString()}`,
    'claim=passed',
    'scope=sanitized_text_artifacts_and_final_review_zip_source_scope_sidecar',
    `scanned_text_file_count=${scannedTextCount}`,
    `final_review_zip=${packageZipRelative}`,
    `final_review_zip_sha256=${zipSha256}`,
    `final_zip_source_scope_secret_scan_log=${relativeToEvidence(packageSecretScanLogPath)}`,
    'forbidden_patterns=credential_cookie_authorization_jsessionid_csrf_raw_session_raw_password_credential_url_raw_artifact_paths',
    '',
  ].join('\n'),
  'utf8',
);

const hashFiles = walkFiles(evidenceDir)
  .filter((filePath) => filePath !== artifactShaPath)
  .sort((left, right) => relativeToEvidence(left).localeCompare(relativeToEvidence(right)));

writeFileSync(
  artifactShaPath,
  [
    `# artifact-sha256 for ${runId}`,
    '# Format: sha256  relative-path',
    ...hashFiles.map((filePath) => `${sha256File(filePath)}  ${relativeToEvidence(filePath)}`),
    '',
  ].join('\n'),
  'utf8',
);

console.log(`final sanitized summary written: ${relativeToEvidence(finalSummaryJsonPath)}`);
console.log(`secret scan written: ${relativeToEvidence(secretScanPath)}`);
console.log(`artifact hashes written: ${relativeToEvidence(artifactShaPath)}`);

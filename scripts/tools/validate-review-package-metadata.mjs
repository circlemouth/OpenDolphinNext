#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';
import { listEntries, readAll, readEntry } from './zip-compat.mjs';

const [zipPath, summaryPathArg, packageScanLogPathArg, artifactLedgerPathArg] = process.argv.slice(2);

if (!zipPath) {
  console.error('usage: validate-review-package-metadata.mjs <review-package.zip> [summary.txt] [package-secret-scan.log] [artifact-sha256.txt]');
  process.exit(2);
}

const summaryPath = summaryPathArg ?? `${zipPath}.summary.txt`;
const artifactLedgerPath = artifactLedgerPathArg ?? path.resolve(path.dirname(summaryPath), 'artifact-sha256.txt');

function fail(message) {
  console.error(message);
  process.exit(1);
}

function parseKeyValue(text) {
  const values = new Map();
  for (const line of text.split(/\r?\n/)) {
    const index = line.indexOf('=');
    if (index > 0) values.set(line.slice(0, index), line.slice(index + 1));
  }
  return values;
}

function assertActualUtcTimestamp(value, label) {
  const text = String(value ?? '');
  if (
    text === '' ||
    text === 'recorded_in_session_transcript' ||
    /placeholder|not[_-]?recorded|unknown|not_verified|todo|tbd/i.test(text)
  ) {
    fail(`${label} has placeholder-only timestamp`);
  }
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/.test(text)) {
    fail(`${label} must be an actual UTC timestamp`);
  }
}

function sha256File(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

function normalizeHostPath(value) {
  if (process.platform === 'win32') {
    return value.replace(/^\/mnt\/([A-Za-z])\//, (_, drive) => `${drive.toUpperCase()}:/`).replaceAll('/', path.sep);
  }
  return value;
}

function canonicalExistingPath(value) {
  const resolved = path.resolve(value);
  try {
    return realpathSync(resolved);
  } catch {
    return resolved;
  }
}

function readZipEntry(entry) {
  return readEntry(zipPath, entry).toString('utf8');
}

function required(values, key, label) {
  const value = values.get(key);
  assert.notEqual(value, undefined, `${label} missing ${key}`);
  return value;
}

function assertEqual(values, key, expected, label) {
  assert.equal(required(values, key, label), expected, `${label} ${key}`);
}

if (!existsSync(zipPath)) fail(`review package not found: ${zipPath}`);
if (!existsSync(summaryPath)) fail(`review package summary not found: ${summaryPath}`);
if (!existsSync(artifactLedgerPath)) fail(`artifact hash ledger not found: ${artifactLedgerPath}`);
if (statSync(artifactLedgerPath).size === 0) fail(`artifact hash ledger is empty: ${artifactLedgerPath}`);

let entries;
try {
  entries = listEntries(zipPath).map((entry) => entry.name).filter(Boolean);
} catch (error) {
  fail(`failed to read zip entries: ${error.message}`);
}

const forbiddenPathPattern =
  /^(?:\.git\/|client\/|server\/|artifacts\/|web-client\/artifacts\/|node_modules\/|dist\/|target\/|build\/|out\/|tmp\/|output\/|coverage\/|test-results\/)|\/(?:\.git|node_modules|dist|target|build|out|tmp|output|coverage|test-results|har|traces?|videos?|raw-screenshots?|screenshots?|raw-network-dumps?|network|requests|request-xml|response-xml)\/|(?:^|\/).*\.(?:zip|har)$/i;
const forbiddenPath = entries.find((entry) => forbiddenPathPattern.test(entry));
if (forbiddenPath) fail(`forbidden raw/generated path found in package: ${forbiddenPath}`);

const secretLiteralRules = [
  {
    name: 'authorization-value',
    pattern:
      /\bauthorization\b\s*[:=]\s*['"]?(?:Basic|Bearer)\s+(?!(?:should-not-ship|REPLACE_WITH|[{<]))[A-Za-z0-9._~+/=-]{8,}/i,
  },
  {
    name: 'cookie-value',
    pattern: /(^|\s)(?:set-)?cookie\s*:\s*[^;\s=]+=(?!(?:should-not-ship|REPLACE_WITH|[$\{<]|secret\b))[^;\s]{8,}/i,
  },
  {
    name: 'jsessionid-value',
    pattern:
      /\bjsessionid\b\s*[=:]\s*(?!(?:should-not-ship|REPLACE_WITH|jsessionid\[|[$\{<]|secret\b))[A-Za-z0-9._-]{8,}/i,
  },
  {
    name: 'csrf-token-value',
    pattern:
      /\b(?:x-csrf-token|csrf[-_]?token)\b[\s"_-]*[:=]\s*['"]?(?!(?:should-not-ship|REPLACE_WITH|[$\{<]|null\b|csrfToken\b|extract|refreshed|scenario|Boolean))[A-Za-z0-9._-]{24,}/i,
  },
  {
    name: 'raw-session-value',
    pattern:
      /\b(?:raw[-_]?session|session[-_]?id|session_id)\b[\s"_-]*[:=]\s*['"]?(?!(?:should-not-ship|REPLACE_WITH|[$\{<]|null\b|response|session|scenario|Boolean))[A-Za-z0-9._-]{24,}/i,
  },
  {
    name: 'credential-bearing-url',
    pattern: /[A-Za-z][A-Za-z0-9+.-]*:\/\/(?![$\{<])[^/?#\s@]+:(?![$\{<])[^/?#\s@]+@/i,
  },
];

let combinedContent = '';
try {
  combinedContent = readAll(zipPath).toString('utf8');
} catch {
  combinedContent = '';
}

for (const { name, pattern } of secretLiteralRules) {
  if (pattern.test(combinedContent)) {
    fail(`forbidden secret literal in package rule=${name}`);
  }
}

const passwordAssignmentPattern = /\b(?:raw[-_]?password|password|passwd)\b[\s"_-]*[:=]/i;
const passwordScannedEntryPattern = /\.(?:md|txt|json|xml|ya?ml|toml|env|sample|sh|ps1|csv|log|properties|conf|http|sql)$/i;

function passwordValueIsPlaceholder(value) {
  if (!value) return true;
  if (value === '=') return true;
  if (/[^\x00-\x7F]/.test(value)) return true;
  if (/^[$<{]/.test(value)) return true;
  if (/^\(raw/i.test(value)) return true;
  if (/^[A-Za-z0-9_]+[(]/i.test(value)) return true;
  if (/^[A-Z0-9_]+[})]?$/i.test(value)) return true;
  if (/^[A-Za-z0-9_]+(?:[.]?[?]?[.][A-Za-z0-9_]+)+[(]?$/i.test(value)) return true;
  if (/^[A-Za-z0-9_]+ is required/i.test(value)) return true;
  return /^(?:required|string|boolean|null|undefined|password|rawPassword|passwordPlain|example(?:[-_][A-Za-z0-9_-]+)?|placeholder|redacted|masked|not_verified|not_claimed|not|claimed|should-not-ship|your_|your-|changeme|change_me|sample|dummy|test)$/i.test(
    value,
  );
}

function extractPasswordValue(line) {
  const prefixPattern = /^.*\b(?:raw[-_]?password|password|passwd)\b[\s"_-]*[:=][\s"']*/i;
  const value = line.replace(prefixPattern, '').trim();
  return value.split(/[,\s;}'")\]]/, 1)[0] ?? '';
}

for (const entry of entries) {
  if (!passwordScannedEntryPattern.test(entry)) continue;
  let content;
  try {
    content = readZipEntry(entry);
  } catch {
    continue;
  }
  for (const line of content.split(/\r?\n/)) {
    if (!passwordAssignmentPattern.test(line)) continue;
    const value = extractPasswordValue(line);
    if (!passwordValueIsPlaceholder(value)) {
      fail(`forbidden password literal in package entry=${entry}`);
    }
  }
}

if (!entries.includes('REVIEW_PACKAGE_MANIFEST.txt')) {
  fail('REVIEW_PACKAGE_MANIFEST.txt missing from package');
}
if (!entries.includes('REVIEW_LOG_INCLUSIONS_MANIFEST.txt')) {
  fail('REVIEW_LOG_INCLUSIONS_MANIFEST.txt missing from package');
}

const manifest = parseKeyValue(readZipEntry('REVIEW_PACKAGE_MANIFEST.txt'));
const summary = parseKeyValue(readFileSync(summaryPath, 'utf8'));
const actualCount = String(entries.length);
const actualSize = String(statSync(zipPath).size);
const actualSha = sha256File(zipPath);

function parseArtifactLedger(text) {
  const hashes = new Map();
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^([0-9a-f]{64})\s{2,}(.+)$/i);
    if (!match) fail(`artifact hash ledger has malformed line: ${line}`);
    hashes.set(match[2], match[1].toLowerCase());
  }
  return hashes;
}

function assertLedgerHash(ledger, filePath, label) {
  const basename = path.basename(filePath);
  const expected = sha256File(filePath);
  const actual = ledger.get(basename) ?? ledger.get(path.relative(path.dirname(artifactLedgerPath), filePath).replaceAll(path.sep, '/'));
  if (!actual) fail(`artifact hash ledger missing ${label}: ${basename}`);
  assert.equal(actual, expected, `artifact hash ledger ${label}`);
}

const artifactLedger = parseArtifactLedger(readFileSync(artifactLedgerPath, 'utf8'));
assertLedgerHash(artifactLedger, zipPath, 'review package ZIP');

try {
  assertEqual(manifest, 'packageMode', 'extracted_review_subset', 'manifest');
  assertEqual(summary, 'packageMode', 'extracted_review_subset', 'summary');
  assert.equal(required(manifest, 'run_id', 'manifest'), required(summary, 'run_id', 'summary'), 'run_id');
  assert.equal(required(summary, 'zip_file_count', 'summary'), actualCount, 'summary zip_file_count');
  assert.equal(required(summary, 'zip_size_bytes', 'summary'), actualSize, 'summary zip_size_bytes');
  assert.equal(required(summary, 'zip_sha256', 'summary'), actualSha, 'summary zip_sha256');
  assertEqual(manifest, 'zip_file_count', 'recorded_in_external_sidecar', 'manifest');
  assertEqual(manifest, 'zip_size_bytes', 'recorded_in_external_sidecar', 'manifest');
  assertEqual(manifest, 'zip_sha256', 'recorded_in_external_sidecar', 'manifest');

  for (const values of [manifest, summary]) {
    const label = values === manifest ? 'manifest' : 'summary';
    required(values, 'secret_scan_scope', label);
    required(values, 'dynamic_review_evidence_secret_scan_claim', label);
    required(values, 'dynamic_secret_scan_claim', label);
    assertEqual(values, 'full_source_secret_scan_claim', 'not_claimed', label);
    assertEqual(values, 'worktree_clean', 'not_verified', label);
    required(values, 'source_commit', label);
    required(values, 'source_branch', label);
    required(values, 'git_claim_evidence_policy', label);
  }

  assertEqual(manifest, 'review_log_inclusions_manifest_entry', 'REVIEW_LOG_INCLUSIONS_MANIFEST.txt', 'manifest');
  assertEqual(summary, 'review_log_inclusions_manifest_entry', 'REVIEW_LOG_INCLUSIONS_MANIFEST.txt', 'summary');
  assertEqual(manifest, 'package_source_secret_scan_claim', 'recorded_in_external_sidecar', 'manifest');
  assertEqual(manifest, 'package_source_secret_scan_scope', 'final_review_zip_post_creation', 'manifest');
  assertEqual(summary, 'package_source_secret_scan_claim', 'passed', 'summary');
  assertEqual(summary, 'package_source_secret_scan_scope', 'final_review_zip_post_creation', 'summary');
  assert.equal(required(summary, 'package_source_secret_scan_target_sha256', 'summary'), actualSha, 'summary package_source_secret_scan_target_sha256');

  const summaryScope = required(summary, 'secret_scan_scope', 'summary');
  if (summaryScope === 'dynamic_review_evidence_only') {
    assertEqual(summary, 'dynamic_secret_scan_claim', 'passed', 'summary');
    assertEqual(manifest, 'dynamic_secret_scan_claim', 'passed', 'manifest');
  }
  if (summaryScope === 'no_dynamic_review_evidence') {
    assertEqual(summary, 'dynamic_secret_scan_claim', 'not_applicable', 'summary');
    assertEqual(manifest, 'dynamic_secret_scan_claim', 'not_applicable', 'manifest');
  }
} catch (error) {
  fail(error.message);
}

const sourceScanLogs = entries.filter((entry) => /(^|\/)secret-scan-review-bundle\.log$/.test(entry));
let passingSourceScanLogCount = 0;
function parseCommandLog(text) {
  return parseKeyValue(text);
}

function validateCommandLogContent(content, label) {
  if (content.trim() === '') fail(`${label} is empty and cannot be pass evidence`);
  const values = parseCommandLog(content);
  for (const key of ['command', 'cwd', 'runId']) {
    required(values, key, label);
  }
  const start = values.get('start') ?? values.get('start_utc');
  const end = values.get('end') ?? values.get('end_utc');
  if (!start) fail(`${label} missing start metadata`);
  if (!end) fail(`${label} missing end metadata`);
  assertActualUtcTimestamp(start, `${label} start`);
  assertActualUtcTimestamp(end, `${label} end`);
  if (!values.has('exit') && !values.has('exit_code')) fail(`${label} missing exit code metadata`);
  const outputSection = content.match(/^--- command output ---\r?\n([\s\S]*?)\r?\n--- command summary ---/m)?.[1] ?? '';
  if (outputSection.trim() === '') fail(`${label} has empty command output evidence`);
  return values;
}

function requireAnyCommandLogField(entry, keys, label) {
  for (const key of keys) {
    if (entry?.[key] !== undefined && entry?.[key] !== null && entry?.[key] !== '') return entry[key];
  }
  fail(`${label} missing ${keys[0]}`);
}

function validateStructuredCommandLogEntry(entry, label) {
  for (const key of ['command', 'cwd', 'runId']) {
    requireAnyCommandLogField(entry, [key], label);
  }
  const start = requireAnyCommandLogField(entry, ['start', 'start_utc'], label);
  const end = requireAnyCommandLogField(entry, ['end', 'end_utc'], label);
  requireAnyCommandLogField(entry, ['exit_code', 'exit'], label);
  assertActualUtcTimestamp(start, `${label} start`);
  assertActualUtcTimestamp(end, `${label} end`);
  const outputValues = [entry.output, entry.stdout, entry.stderr, entry.safe_result, entry.result, entry.summary].filter(
    (value) => value !== undefined && value !== null && String(value).trim() !== '',
  );
  if (outputValues.length === 0) fail(`${label} missing non-empty output evidence`);
}

function validateStructuredCommandLogContent(content, entryName) {
  let parsed;
  try {
    if (entryName.endsWith('.jsonl')) {
      parsed = content
        .split(/\r?\n/)
        .filter((line) => line.trim() !== '')
        .map((line) => JSON.parse(line));
    } else {
      parsed = JSON.parse(content);
    }
  } catch (error) {
    fail(`${entryName} is not valid JSON command log: ${error.message}`);
  }
  const commands = Array.isArray(parsed) ? parsed : parsed?.commands;
  if (!Array.isArray(commands) || commands.length === 0) fail(`${entryName} must contain command log entries`);
  for (const [index, entry] of commands.entries()) {
    validateStructuredCommandLogEntry(entry, `${entryName} entry ${index}`);
  }
}

for (const entry of sourceScanLogs) {
  const content = readZipEntry(entry);
  const logValues = validateCommandLogContent(content, entry);
  required(logValues, 'target_path', entry);
  required(logValues, 'target_sha256', entry);
  const passed =
    /^exit(_code)?=0$/m.test(content) &&
    /^result=PASS$/m.test(content) &&
    content.includes('review bundle included source scope secret scan passed:');
  if (!passed) {
    fail(`secret-scan-review-bundle.log result mismatch: ${entry}`);
  }
  passingSourceScanLogCount += 1;
}

const reviewLogInclusions = parseKeyValue(readZipEntry('REVIEW_LOG_INCLUSIONS_MANIFEST.txt'));
const currentReviewLogIncludes = (reviewLogInclusions.get('review_log_includes') ?? 'none')
  .split(',')
  .map((entry) => entry.trim())
  .filter((entry) => entry !== '' && entry !== 'none');
for (const entry of currentReviewLogIncludes) {
  if (!entries.includes(entry)) fail(`review log inclusion listed but missing from package: ${entry}`);
  if (/\.log$/i.test(entry)) {
    validateCommandLogContent(readZipEntry(entry), entry);
  }
  if (/(^|\/)(?:command-log(?:\.sanitized)?\.json|command-log\.jsonl|[^/]*command-log\.json)$/i.test(entry)) {
    validateStructuredCommandLogContent(readZipEntry(entry), entry);
  }
}

const expectedBundleIncludedSourceScopeClaim = passingSourceScanLogCount > 0 ? 'passed' : 'not_claimed';
for (const [label, values] of [
  ['manifest', manifest],
  ['summary', summary],
]) {
  try {
    assert.equal(
      required(values, 'bundle_included_source_scope_secret_scan_claim', label),
      expectedBundleIncludedSourceScopeClaim,
      `${label} bundle_included_source_scope_secret_scan_claim`,
    );
  } catch (error) {
    fail(error.message);
  }
}

const packageScanLogPath = packageScanLogPathArg
  ? path.resolve(packageScanLogPathArg)
  : path.resolve(path.dirname(summaryPath), required(summary, 'package_source_secret_scan_evidence', 'summary'));
if (!existsSync(packageScanLogPath)) fail(`package source-scope secret scan log not found: ${packageScanLogPath}`);
if (statSync(packageScanLogPath).size === 0) fail(`package source-scope secret scan log is empty: ${packageScanLogPath}`);

const packageScanLogContent = readFileSync(packageScanLogPath, 'utf8');
const packageScanLog = validateCommandLogContent(packageScanLogContent, 'package source-scope secret scan log');
const scanCwd = canonicalExistingPath(normalizeHostPath(required(packageScanLog, 'cwd', 'package source-scope secret scan log')));
const scanTargetPathValue = required(packageScanLog, 'target_path', 'package source-scope secret scan log');
const normalizedScanTargetPathValue = normalizeHostPath(scanTargetPathValue);
const scanTargetPath = canonicalExistingPath(path.resolve(scanCwd, normalizedScanTargetPathValue));
const zipAbsolutePath = canonicalExistingPath(zipPath);
try {
  assert.equal(scanTargetPath, zipAbsolutePath, 'package source-scope scan target_path must be the final review ZIP');
  assert.equal(required(packageScanLog, 'target_sha256', 'package source-scope secret scan log'), actualSha, 'package source-scope scan target_sha256');
  assert.match(packageScanLogContent, /^exit(_code)?=0$/m, 'package source-scope scan exit_code');
  assert.match(packageScanLogContent, /^result=PASS$/m, 'package source-scope scan result');
  assert.match(
    packageScanLogContent,
    /review bundle included source scope secret scan passed:/,
    'package source-scope scan pass marker',
  );
  assert.equal(
    required(summary, 'package_source_secret_scan_target_path', 'summary'),
    scanTargetPathValue,
    'summary package_source_secret_scan_target_path',
  );
} catch (error) {
  fail(error.message);
}

console.log(`review package metadata validation passed: ${zipPath}`);

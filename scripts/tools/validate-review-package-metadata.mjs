#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';

const [zipPath, summaryPathArg] = process.argv.slice(2);

if (!zipPath) {
  console.error('usage: validate-review-package-metadata.mjs <review-package.zip> [summary.txt]');
  process.exit(2);
}

const summaryPath = summaryPathArg ?? `${zipPath}.summary.txt`;

function fail(message) {
  console.error(message);
  process.exit(1);
}

function run(command, args) {
  return execFileSync(command, args, {
    encoding: 'utf8',
    maxBuffer: 512 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function parseKeyValue(text) {
  const values = new Map();
  for (const line of text.split(/\r?\n/)) {
    const index = line.indexOf('=');
    if (index > 0) values.set(line.slice(0, index), line.slice(index + 1));
  }
  return values;
}

function sha256File(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

function readZipEntry(entry) {
  return run('unzip', ['-p', zipPath, entry]);
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

let entries;
try {
  entries = run('zipinfo', ['-1', zipPath])
    .trim()
    .split(/\n/)
    .filter(Boolean);
} catch (error) {
  fail(`failed to read zip entries: ${error.message}`);
}

const forbiddenPathPattern =
  /^(?:\.git\/|client\/|server\/|artifacts\/|web-client\/artifacts\/|node_modules\/|dist\/|target\/|build\/|out\/|tmp\/|output\/|coverage\/|test-results\/)|\/(?:node_modules|dist|target|build|out|coverage|test-results)\/|\/(?:raw|har|screenshots?|trace|test-results)\/|\/(?:network|requests)\/|(?:^|\/)(?:request|response)-xml\/|(?:^|\/).*\.har$/i;
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
  combinedContent = run('unzip', ['-p', zipPath]);
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

const manifest = parseKeyValue(readZipEntry('REVIEW_PACKAGE_MANIFEST.txt'));
const summary = parseKeyValue(readFileSync(summaryPath, 'utf8'));
const actualCount = String(entries.length);
const actualSize = String(statSync(zipPath).size);
const actualSha = sha256File(zipPath);

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
    required(values, 'dynamic_secret_scan_claim', label);
    assertEqual(values, 'full_source_secret_scan_claim', 'not_claimed', label);
    assertEqual(values, 'worktree_clean', 'not_verified', label);
    required(values, 'source_commit', label);
    required(values, 'source_branch', label);
    required(values, 'git_claim_evidence_policy', label);
  }

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
for (const entry of sourceScanLogs) {
  const content = readZipEntry(entry);
  const passed =
    /^exit(_code)?=0$/m.test(content) &&
    /^result=PASS$/m.test(content) &&
    content.includes('review bundle included source scope secret scan passed:');
  if (!passed) {
    fail(`secret-scan-review-bundle.log result mismatch: ${entry}`);
  }
  passingSourceScanLogCount += 1;
}

const expectedPackageSourceClaim = passingSourceScanLogCount > 0 ? 'passed' : 'not_claimed';
for (const [label, values] of [
  ['manifest', manifest],
  ['summary', summary],
]) {
  try {
    assert.equal(
      required(values, 'package_source_secret_scan_claim', label),
      expectedPackageSourceClaim,
      `${label} package_source_secret_scan_claim`,
    );
    assert.equal(
      required(values, 'bundle_included_source_scope_secret_scan_claim', label),
      expectedPackageSourceClaim,
      `${label} bundle_included_source_scope_secret_scan_claim`,
    );
  } catch (error) {
    fail(error.message);
  }
}

console.log(`review package metadata validation passed: ${zipPath}`);

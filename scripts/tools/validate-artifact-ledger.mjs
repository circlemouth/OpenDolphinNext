#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const [evidenceDirArg, ledgerArg] = process.argv.slice(2);

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!evidenceDirArg) {
  console.error('usage: node scripts/tools/validate-artifact-ledger.mjs <evidence-dir> [artifact-sha256.txt]');
  process.exit(2);
}

const evidenceDir = path.resolve(evidenceDirArg);
const ledgerPath = path.resolve(ledgerArg ?? path.join(evidenceDir, 'artifact-sha256.txt'));
const invocationCwd = process.cwd();

if (!existsSync(evidenceDir) || !statSync(evidenceDir).isDirectory()) {
  fail(`evidence dir not found: ${evidenceDirArg}`);
}
if (!existsSync(ledgerPath) || !statSync(ledgerPath).isFile()) {
  fail(`artifact ledger not found: ${ledgerPath}`);
}

function relativeToEvidence(filePath) {
  return path.relative(evidenceDir, filePath).replaceAll(path.sep, '/');
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

function sha256File(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

function normalizeLedgerPath(relativePath, lineNumber) {
  const evidenceRelativeCandidate = path.resolve(evidenceDir, relativePath);
  if (existsSync(evidenceRelativeCandidate)) return relativeToEvidence(evidenceRelativeCandidate);

  const cwdRelativeCandidate = path.resolve(invocationCwd, relativePath);
  if (cwdRelativeCandidate.startsWith(`${evidenceDir}${path.sep}`) && existsSync(cwdRelativeCandidate)) {
    return relativeToEvidence(cwdRelativeCandidate);
  }

  if (relativePath === relativeToEvidence(ledgerPath)) return relativePath;
  fail(`artifact ledger line ${lineNumber} references missing file: ${relativePath}`);
}

const ledgerText = readFileSync(ledgerPath, 'utf8');
const ledgerEntries = new Map();

for (const [lineIndex, line] of ledgerText.split(/\r?\n/).entries()) {
  const trimmed = line.trim();
  if (trimmed === '' || trimmed.startsWith('#')) continue;
  const match = trimmed.match(/^([0-9a-f]{64})  ([^\0]+)$/);
  if (!match) fail(`artifact ledger line ${lineIndex + 1} is malformed`);
  const [, hash, relativePath] = match;
  if (path.isAbsolute(relativePath) || relativePath.split('/').includes('..')) {
    fail(`artifact ledger line ${lineIndex + 1} has unsafe path: ${relativePath}`);
  }
  const normalizedPath = normalizeLedgerPath(relativePath, lineIndex + 1);
  if (normalizedPath === relativeToEvidence(ledgerPath)) {
    fail('artifact ledger must not include itself');
  }
  if (ledgerEntries.has(normalizedPath)) fail(`artifact ledger duplicate path: ${normalizedPath}`);
  ledgerEntries.set(normalizedPath, hash);
}

if (ledgerEntries.size === 0) fail('artifact ledger has no artifact entries');

const expectedFiles = walkFiles(evidenceDir)
  .filter((filePath) => path.resolve(filePath) !== ledgerPath)
  .map(relativeToEvidence)
  .sort();

const missing = expectedFiles.filter((relativePath) => !ledgerEntries.has(relativePath));
if (missing.length > 0) fail(`artifact ledger missing entries: ${missing.join(',')}`);

const extra = [...ledgerEntries.keys()].filter((relativePath) => !expectedFiles.includes(relativePath));
if (extra.length > 0) fail(`artifact ledger references missing files: ${extra.join(',')}`);

for (const [relativePath, expectedHash] of ledgerEntries.entries()) {
  const actualHash = sha256File(path.join(evidenceDir, relativePath));
  if (actualHash !== expectedHash) {
    fail(`artifact ledger hash mismatch: ${relativePath}`);
  }
}

console.log(`artifact ledger validation passed: ${relativeToEvidence(ledgerPath)} entries=${ledgerEntries.size}`);

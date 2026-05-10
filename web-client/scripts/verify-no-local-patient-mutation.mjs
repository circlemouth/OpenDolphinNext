#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const repoRootDir = path.resolve(scriptDir, '..', '..');

const checkedRoots = [
  'server-modernized/src/main',
  'server-modernized/src/test',
  'api-contract/src/main',
  'web-client/src',
  'web-client/scripts',
  'docs/contracts',
  'docs/runbooks',
  'docs/architecture',
  'web-client/notes',
];

const textFileExtensions = new Set([
  '.cjs',
  '.css',
  '.html',
  '.java',
  '.js',
  '.json',
  '.jsx',
  '.md',
  '.mjs',
  '.properties',
  '.sh',
  '.ts',
  '.tsx',
  '.txt',
  '.xml',
  '.yaml',
  '.yml',
]);

const skippedDirectoryNames = new Set(['.git', 'coverage', 'dist', 'node_modules', 'target']);
const selfRelativePath = path.relative(repoRootDir, scriptPath).split(path.sep).join('/');

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const localPatientMutationRoutePattern = new RegExp(
  `${escapeRegExp(['', 'api', 'local', 'patients'].join('/'))}/mutations?\\b`,
);

const forbiddenPatterns = [
  {
    pattern: localPatientMutationRoutePattern,
    reason: 'legacy local patient mutation route must not return to active source or current docs',
  },
  {
    pattern: /\bLocalPatientMutation(?:Resource|Request|Response)\b/,
    reason: 'legacy local patient mutation resource/DTO must not return to active source',
  },
];

function normalizeRelativePath(filePath) {
  return path.relative(repoRootDir, filePath).split(path.sep).join('/');
}

function walkTextFiles(rootDir) {
  const results = [];
  if (!existsSync(rootDir)) return results;

  const entries = readdirSync(rootDir, { withFileTypes: true });
  for (const entry of entries) {
    const absolutePath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      if (skippedDirectoryNames.has(entry.name)) continue;
      results.push(...walkTextFiles(absolutePath));
      continue;
    }
    if (!entry.isFile()) continue;
    if (!textFileExtensions.has(path.extname(entry.name))) continue;
    results.push(absolutePath);
  }
  return results;
}

const findings = [];

for (const root of checkedRoots) {
  const rootPath = path.join(repoRootDir, root);
  for (const filePath of walkTextFiles(rootPath)) {
    const relativePath = normalizeRelativePath(filePath);
    if (relativePath === selfRelativePath) continue;
    if (statSync(filePath).size > 2_000_000) continue;

    const lines = readFileSync(filePath, 'utf8').split(/\r?\n/);
    lines.forEach((line, index) => {
      for (const rule of forbiddenPatterns) {
        if (rule.pattern.test(line)) {
          findings.push({
            file: relativePath,
            line: index + 1,
            reason: rule.reason,
            text: line.trim(),
          });
        }
      }
    });
  }
}

if (findings.length > 0) {
  console.error('[verify:no-local-patient-mutation] legacy local patient mutation surface が検出されました。');
  for (const finding of findings) {
    console.error(` - ${finding.file}:${finding.line} ${finding.reason}: ${finding.text}`);
  }
  process.exit(2);
}

console.log('[verify:no-local-patient-mutation] active source/current docs に legacy local patient mutation surface はありません。');

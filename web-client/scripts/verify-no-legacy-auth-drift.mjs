#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const projectRootDir = path.resolve(scriptDir, '..');
const repoRootDir = path.resolve(projectRootDir, '..');

const TARGETS = [
  projectRootDir,
  path.join(repoRootDir, 'docs', 'web-client'),
  path.join(repoRootDir, 'docs', 'weborca-reception-evaluation-checklist.md'),
  path.join(repoRootDir, 'docs', 'verification-plan-screen-review.md'),
  path.join(repoRootDir, 'setup-modernized-env.sh'),
];

const BLOCKED_TOKENS = [
  'VITE_ENABLE_LEGACY_HEADER_AUTH',
  'VITE_ALLOW_LEGACY_HEADER_AUTH_FALLBACK',
  'devPasswordMd5',
];

const TEXT_FILE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.css',
  '.md',
  '.html',
  '.sh',
  '.sample',
  '.example',
  '.env',
  '.txt',
]);

const EXCLUDED_DIR_NAMES = new Set([
  '.git',
  'node_modules',
  'dist',
  'coverage',
  'artifacts',
  'target',
]);

const findings = [];

const scanFile = (filePath) => {
  const content = readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);
  lines.forEach((line, index) => {
    BLOCKED_TOKENS.forEach((token) => {
      if (!line.includes(token)) return;
      findings.push({
        filePath,
        line: index + 1,
        token,
      });
    });
  });
};

const walk = (currentPath) => {
  if (path.resolve(currentPath) === scriptPath) return;
  const stats = statSync(currentPath);
  if (stats.isDirectory()) {
    const entries = readdirSync(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === '.' || entry.name === '..') continue;
      if (entry.isDirectory() && EXCLUDED_DIR_NAMES.has(entry.name)) continue;
      walk(path.join(currentPath, entry.name));
    }
    return;
  }

  if (!TEXT_FILE_EXTENSIONS.has(path.extname(currentPath))) return;
  scanFile(currentPath);
};

TARGETS.forEach((targetPath) => {
  if (!existsSync(targetPath)) return;
  walk(targetPath);
});

if (findings.length > 0) {
  console.error('[verify:no-legacy-auth-drift] legacy auth drift token の再混入を検出しました。');
  findings.forEach((finding) => {
    console.error(` - ${path.relative(repoRootDir, finding.filePath)}:${finding.line} ${finding.token}`);
  });
  process.exit(2);
}

console.log('[verify:no-legacy-auth-drift] legacy auth drift token の再混入は検出されませんでした。');

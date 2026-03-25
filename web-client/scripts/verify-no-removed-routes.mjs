#!/usr/bin/env node

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const projectRootDir = path.resolve(scriptDir, '..');
const srcDir = path.join(projectRootDir, 'src');

const BLOCKED_ROUTES = [
  '/api/orca/medical/outpatient',
  '/api/orca/deptinfo',
  '/api/orca/local-medical/outpatient',
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
]);

const findings = [];

const walk = (currentDir) => {
  const entries = readdirSync(currentDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === '.' || entry.name === '..') continue;
    const fullPath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }
    if (!TEXT_FILE_EXTENSIONS.has(path.extname(entry.name))) continue;
    const content = readFileSync(fullPath, 'utf8');
    const lines = content.split(/\r?\n/);
    lines.forEach((line, index) => {
      BLOCKED_ROUTES.forEach((route) => {
        if (!line.includes(route)) return;
        findings.push({
          filePath: fullPath,
          line: index + 1,
          route,
        });
      });
    });
  }
};

walk(srcDir);

if (findings.length > 0) {
  console.error('[verify:no-removed-routes] blocked route の再混入を検出しました。');
  findings.forEach((finding) => {
    console.error(` - ${path.relative(projectRootDir, finding.filePath)}:${finding.line} ${finding.route}`);
  });
  process.exit(2);
}

console.log('[verify:no-removed-routes] blocked route の再混入は検出されませんでした。');

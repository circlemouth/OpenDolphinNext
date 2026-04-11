#!/usr/bin/env node

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const projectRootDir = path.resolve(scriptDir, '..');
const srcDir = path.join(projectRootDir, 'src');

const BLOCKED_SURFACE_PATTERNS = [
  { kind: 'mock-surface', pattern: /\/api\/orca\/official\/.+\/mock/ },
  { kind: 'mock-surface', pattern: /\/api\/local\/.+\/mock/ },
  { kind: 'taxonomy-drift', pattern: /\/api\/orca\/(?!official(?:\/|\b)|master(?:\/|\b)|queue(?:\/|\b)|pusheventgetv2(?:\/|\b))/ },
  { kind: 'taxonomy-drift', pattern: /\/api\/local-summary\// },
  { kind: 'taxonomy-drift', pattern: /\/api\/orca-live\// },
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
      BLOCKED_SURFACE_PATTERNS.forEach((surface) => {
        if (!surface.pattern.test(line)) return;
        findings.push({
          filePath: fullPath,
          line: index + 1,
          kind: surface.kind,
          value: String(surface.pattern),
        });
      });
    });
  }
};

walk(srcDir);

if (findings.length > 0) {
  console.error('[verify:no-blocked-orca-route-strings] blocked ORCA route string / mock surface の再混入を検出しました。');
  findings.forEach((finding) => {
    console.error(` - ${path.relative(projectRootDir, finding.filePath)}:${finding.line} [${finding.kind}] ${finding.value}`);
  });
  process.exit(2);
}

console.log('[verify:no-blocked-orca-route-strings] blocked ORCA route string / mock surface の再混入は検出されませんでした。');

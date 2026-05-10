#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const repoRootDir = path.resolve(scriptDir, '..', '..');
const selfRelativePath = path.relative(repoRootDir, scriptPath).split(path.sep).join('/');

const checkedRoots = [
  'web-client/src',
  'web-client/notes',
  'docs/web-client/ux',
];

const textFileExtensions = new Set([
  '.css',
  '.html',
  '.js',
  '.jsx',
  '.json',
  '.md',
  '.mjs',
  '.ts',
  '.tsx',
  '.txt',
  '.yaml',
  '.yml',
]);

const skippedDirectoryNames = new Set(['.git', '__snapshots__', '__tests__', 'coverage', 'dist', 'node_modules']);
const skippedFilePatterns = [
  /\.test\.[jt]sx?$/,
  /\.spec\.[jt]sx?$/,
  /\.stories\.[jt]sx?$/,
];

const forbiddenRules = [
  {
    pattern: /ORCA送信\s*[:：]\s*成功/,
    reason: 'ORCA transmission must be labeled as delivery/verification, not generic success',
  },
  {
    pattern: /ORCA送信成功/,
    reason: 'ORCA transmission success must not imply chart finalization, accounting, or registration',
  },
  {
    pattern: /ORCAへ反映|会計へ反映/,
    reason: 'ORCA/accounting wording must not imply source-of-truth reflection from client UI',
  },
  {
    pattern: /ORCA送信(?:が|は)?(?:完了|成功).*(?:診療録確定|会計済み|登録済み|反映済み)/,
    reason: 'ORCA send completion must not be coupled to chart finalization/accounting/registration',
  },
  {
    pattern: /(?:診療録確定|会計済み|登録済み|反映済み).*(?:ORCA送信(?:が|は)?(?:完了|成功))/,
    reason: 'chart finalization/accounting/registration must not be inferred from ORCA send completion',
  },
  {
    pattern: /(?:setFeedback|setNotice|message|toast|title|aria-label).*(?:完了扱い|反映済み)/,
    reason: 'visible feedback must not show internal completion/reflection wording',
    allow: ({ line, relativePath }) =>
      relativePath === 'web-client/src/features/charts/PatientInfoEditDialog.tsx' &&
      line.includes('isInternalPatientSyncMessage'),
  },
  {
    pattern: /重要警告.*(?:詳細を表示|折りたた|disclosure|details)/i,
    reason: 'critical warnings must not be described as hidden behind disclosure/details by default',
    allow: ({ line }) => /折りたたまず|隠さない|初期表示/.test(line),
  },
];

function normalizeRelativePath(filePath) {
  return path.relative(repoRootDir, filePath).split(path.sep).join('/');
}

function shouldSkipFile(filePath) {
  const basename = path.basename(filePath);
  return skippedFilePatterns.some((pattern) => pattern.test(basename));
}

function walkTextFiles(rootDir) {
  const results = [];
  if (!existsSync(rootDir)) return results;

  for (const entry of readdirSync(rootDir, { withFileTypes: true })) {
    const absolutePath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      if (skippedDirectoryNames.has(entry.name)) continue;
      results.push(...walkTextFiles(absolutePath));
      continue;
    }
    if (!entry.isFile()) continue;
    if (shouldSkipFile(absolutePath)) continue;
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
      for (const rule of forbiddenRules) {
        if (rule.pattern.test(line)) {
          if (rule.allow?.({ line, relativePath })) continue;
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
  console.error('[verify:medical-safety-ui-copy] unsafe medical-safety UI wording was detected.');
  for (const finding of findings) {
    console.error(` - ${finding.file}:${finding.line} ${finding.reason}: ${finding.text}`);
  }
  process.exit(2);
}

console.log('[verify:medical-safety-ui-copy] medical-safety UI wording guard passed.');

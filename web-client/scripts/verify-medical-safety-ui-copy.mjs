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
    allow: ({ line }) => /進めていません|ではありません|扱いにはしません/.test(line),
  },
  {
    pattern: /(?:診療録確定|会計済み|登録済み|反映済み).*(?:ORCA送信(?:が|は)?(?:完了|成功))/,
    reason: 'chart finalization/accounting/registration must not be inferred from ORCA send completion',
    allow: ({ line }) => /進めていません|ではありません|扱いにはしません/.test(line),
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

const criticalDialogRequiredLabels = [
  '患者番号',
  '氏名',
  '生年月日',
  '性別',
  '年齢',
  '受付日',
  '診療科',
  '担当医',
  '保険組合せ',
];

const criticalDialogFiles = new Set([
  'web-client/src/features/charts/ChartsActionBar.tsx',
  'web-client/src/features/charts/DiagnosisEditPanel.tsx',
  'web-client/src/features/charts/PrescriptionOrderEditorPanel.tsx',
  'web-client/src/features/charts/revisions/RevisionHistoryDrawer.tsx',
]);

const dadsDebtCaps = new Map([
  ['web-client/src/features/charts/DiagnosisEditPanel.tsx', { placeholder: 1, nativeDisabled: 35 }],
  ['web-client/src/features/charts/PrescriptionOrderEditorPanel.tsx', { placeholder: 19, nativeDisabled: 10 }],
  ['web-client/src/features/charts/SoapNotePanel.tsx', { placeholder: 1, nativeDisabled: 11 }],
  ['web-client/src/features/charts/PatientSummaryPanel.tsx', { placeholder: 1, nativeDisabled: 2 }],
  ['web-client/src/features/reception/pages/ReceptionPage.tsx', { placeholder: 8, nativeDisabled: 24 }],
  ['web-client/src/features/patients/PatientsPage.tsx', { placeholder: 1, nativeDisabled: 25 }],
  ['web-client/src/features/images/pages/MobileImagesUploadPage.tsx', { placeholder: 0, nativeDisabled: 5 }],
  ['web-client/src/features/images/components/MobilePatientPicker.tsx', { placeholder: 1, nativeDisabled: 2 }],
]);

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

function findCriticalDialogBlocks(source) {
  const blocks = [];
  let searchFrom = 0;
  const startToken = '<CriticalOperationConfirmDialog';
  while (searchFrom < source.length) {
    const start = source.indexOf(startToken, searchFrom);
    if (start < 0) break;
    const end = source.indexOf('/>', start);
    if (end < 0) break;
    blocks.push(source.slice(start, end + 2));
    searchFrom = end + 2;
  }
  return blocks;
}

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

    if (criticalDialogFiles.has(relativePath)) {
      findCriticalDialogBlocks(lines.join('\n')).forEach((block, blockIndex) => {
        for (const label of criticalDialogRequiredLabels) {
          if (!block.includes(`label: '${label}'`) && !block.includes(`label: "${label}"`)) {
            findings.push({
              file: relativePath,
              line: 1,
              reason: `critical operation dialog #${blockIndex + 1} must re-list ${label}`,
              text: '<CriticalOperationConfirmDialog ... />',
            });
          }
        }
      });
    }

    const dadsDebtCap = dadsDebtCaps.get(relativePath);
    if (dadsDebtCap) {
      const source = lines.join('\n');
      const placeholderCount = source.match(/placeholder=/g)?.length ?? 0;
      const nativeDisabledCount = source.match(/disabled=\{/g)?.length ?? 0;
      if (placeholderCount > dadsDebtCap.placeholder) {
        findings.push({
          file: relativePath,
          line: 1,
          reason: `placeholder dependency cap exceeded (${placeholderCount} > ${dadsDebtCap.placeholder})`,
          text: 'Move explanatory placeholder text into labels/support text before adding new placeholders.',
        });
      }
      if (nativeDisabledCount > dadsDebtCap.nativeDisabled) {
        findings.push({
          file: relativePath,
          line: 1,
          reason: `native disabled usage cap exceeded (${nativeDisabledCount} > ${dadsDebtCap.nativeDisabled})`,
          text: 'Prefer aria-disabled plus visible reason, or add a nearby reason/enabling condition before increasing disabled usage.',
        });
      }
    }
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

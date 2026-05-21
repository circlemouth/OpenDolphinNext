#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const repoRootDir = path.resolve(scriptDir, '..', '..');

const textFileExtensions = new Set(['.css', '.html', '.ts', '.tsx']);
const skippedDirectoryNames = new Set(['.git', '__snapshots__', '__tests__', 'coverage', 'dist', 'node_modules']);
const skippedFilePatterns = [/\.test\.[jt]sx?$/, /\.spec\.[jt]sx?$/, /\.stories\.[jt]sx?$/];

const cssScanRoots = ['web-client/index.html', 'web-client/src'];
const uiLeakFiles = new Map([
  ['web-client/src/AppRouter.tsx', 8],
  ['web-client/src/features/reception/components/ReceptionAuditPanel.tsx', 1],
  ['web-client/src/features/reception/components/ToneBanner.tsx', 2],
  ['web-client/src/features/patients/PatientsPage.tsx', 4],
  ['web-client/src/features/charts/ChartsActionBar.tsx', 3],
  ['web-client/src/features/charts/OrcaSummary.tsx', 2],
  ['web-client/src/features/charts/PatientsTab.tsx', 1],
  ['web-client/src/features/administration/MasterVisibilityPanel.tsx', 1],
  ['web-client/src/features/administration/MasterUpdatesPanel.tsx', 1],
]);

const visibleSupportMetaPatterns = [
  /(?:>|['"`])\s*RUN_ID:/g,
  /(?:>|['"`])\s*traceId:/g,
  /(?:>|['"`])\s*requestId:/g,
  /label="traceId"/g,
  /label="requestId"/g,
  /label="runId"/g,
  /(?:>|['"`])\s*RUN_ID をコピー/g,
  /(?:>|['"`])\s*RUN_ID\/traceId/g,
];

const rawOrcaBodyPatterns = [
  /raw ORCA body/i,
  /ORCA raw body/i,
  /RAW_ORCA_BODY/,
];

const focusTrapRelativePath = 'web-client/src/components/modals/FocusTrapDialog.tsx';
const mobileImagesRelativePath = 'web-client/src/features/images/pages/MobileImagesUploadPage.tsx';

function normalizeRelativePath(filePath) {
  return path.relative(repoRootDir, filePath).split(path.sep).join('/');
}

function shouldSkipFile(filePath) {
  const basename = path.basename(filePath);
  return skippedFilePatterns.some((pattern) => pattern.test(basename));
}

function walkTextFiles(rootPath) {
  if (!existsSync(rootPath)) return [];
  const stats = statSync(rootPath);
  if (stats.isFile()) {
    if (shouldSkipFile(rootPath)) return [];
    if (!textFileExtensions.has(path.extname(rootPath))) return [];
    return [rootPath];
  }

  const results = [];
  for (const entry of readdirSync(rootPath, { withFileTypes: true })) {
    const absolutePath = path.join(rootPath, entry.name);
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

export function collectProjectFiles() {
  const seen = new Set();
  const files = [];
  for (const root of cssScanRoots) {
    const absoluteRoot = path.join(repoRootDir, root);
    for (const filePath of walkTextFiles(absoluteRoot)) {
      if (seen.has(filePath)) continue;
      seen.add(filePath);
      if (statSync(filePath).size > 2_000_000) continue;
      files.push({
        relativePath: normalizeRelativePath(filePath),
        content: readFileSync(filePath, 'utf8'),
      });
    }
  }
  return files.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

export function scanUndefinedCustomProperties(fileEntries) {
  const definitions = new Map();
  const usages = [];

  for (const entry of fileEntries) {
    const definitionRegex = /(^|[\s{;(,'"`])(['"`])?(--[A-Za-z0-9_-]+)\2?\s*:/gm;
    let match;
    while ((match = definitionRegex.exec(entry.content)) !== null) {
      const prop = match[3];
      if (!definitions.has(prop)) {
        definitions.set(prop, entry.relativePath);
      }
    }

    const usageRegex = /var\(\s*(--[A-Za-z0-9_-]+)\s*(?:,([^)]*))?\)/g;
    while ((match = usageRegex.exec(entry.content)) !== null) {
      usages.push({
        prop: match[1],
        hasFallback: typeof match[2] === 'string' && match[2].trim().length > 0,
        relativePath: entry.relativePath,
      });
    }
  }

  const findings = [];
  const seen = new Set();
  for (const usage of usages) {
    if (usage.hasFallback) continue;
    if (definitions.has(usage.prop)) continue;
    const key = `${usage.relativePath}:${usage.prop}`;
    if (seen.has(key)) continue;
    seen.add(key);
    findings.push({
      file: usage.relativePath,
      reason: `undefined CSS custom property ${usage.prop}`,
    });
  }
  return findings.sort((left, right) => {
    const fileCompare = left.file.localeCompare(right.file);
    if (fileCompare !== 0) return fileCompare;
    return left.reason.localeCompare(right.reason);
  });
}

export function scanFocusTrapDialogBackdropDefault(fileEntry) {
  if (!fileEntry) {
    return [
      {
        file: focusTrapRelativePath,
        reason: 'FocusTrapDialog source file is missing',
      },
    ];
  }
  if (/closeOnBackdrop\s*=\s*false/.test(fileEntry.content)) {
    return [];
  }
  return [
    {
      file: fileEntry.relativePath,
      reason: 'FocusTrapDialog must keep closeOnBackdrop defaulted to false',
    },
  ];
}

export function countVisibleSupportMetaExposures(content) {
  return visibleSupportMetaPatterns.reduce((count, pattern) => count + (content.match(pattern)?.length ?? 0), 0);
}

export function scanVisibleSupportMetaExposure(fileEntries) {
  const findings = [];
  for (const [relativePath, cap] of uiLeakFiles.entries()) {
    const fileEntry = fileEntries.find((entry) => entry.relativePath === relativePath);
    if (!fileEntry) {
      findings.push({ file: relativePath, reason: 'MVP UI leak baseline file is missing' });
      continue;
    }
    const count = countVisibleSupportMetaExposures(fileEntry.content);
    if (count > cap) {
      findings.push({
        file: relativePath,
        reason: `visible RUN_ID/traceId/requestId exposure cap exceeded (${count} > ${cap})`,
      });
    }
  }
  return findings;
}

export function scanRawOrcaBodyExposure(fileEntries) {
  const findings = [];
  for (const entry of fileEntries) {
    for (const pattern of rawOrcaBodyPatterns) {
      if (!pattern.test(entry.content)) continue;
      findings.push({
        file: entry.relativePath,
        reason: `raw ORCA body wording detected by ${pattern}`,
      });
      break;
    }
  }
  return findings;
}

export function scanMobileImagesHeaderLeaks(fileEntry) {
  if (!fileEntry) {
    return [
      {
        file: mobileImagesRelativePath,
        reason: 'MobileImagesUploadPage source file is missing',
      },
    ];
  }

  const findings = [];
  if (/internalPatientId\s*=/.test(fileEntry.content)) {
    findings.push({
      file: fileEntry.relativePath,
      reason: 'Mobile Images patient header must not pass internalPatientId into PatientIdentityBar',
    });
  }
  if (/encounterKey\s*=/.test(fileEntry.content)) {
    findings.push({
      file: fileEntry.relativePath,
      reason: 'Mobile Images patient header must not pass encounterKey into PatientIdentityBar',
    });
  }
  if (countVisibleSupportMetaExposures(fileEntry.content) > 0) {
    findings.push({
      file: fileEntry.relativePath,
      reason: 'Mobile Images normal header must not expose RUN_ID/traceId/requestId copy',
    });
  }
  return findings;
}

export function runGuard(fileEntries = collectProjectFiles()) {
  const focusTrapEntry = fileEntries.find((entry) => entry.relativePath === focusTrapRelativePath);
  const mobileImagesEntry = fileEntries.find((entry) => entry.relativePath === mobileImagesRelativePath);
  const findings = [
    ...scanUndefinedCustomProperties(fileEntries),
    ...scanFocusTrapDialogBackdropDefault(focusTrapEntry),
    ...scanVisibleSupportMetaExposure(fileEntries),
    ...scanRawOrcaBodyExposure(fileEntries),
    ...scanMobileImagesHeaderLeaks(mobileImagesEntry),
  ];
  return findings.sort((left, right) => {
    const fileCompare = left.file.localeCompare(right.file);
    if (fileCompare !== 0) return fileCompare;
    return left.reason.localeCompare(right.reason);
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  const findings = runGuard();
  if (findings.length > 0) {
    console.error('[verify:ui-mvp-contract] MVP UI contract violations were detected.');
    for (const finding of findings) {
      console.error(` - ${finding.file}: ${finding.reason}`);
    }
    process.exit(2);
  }
  console.log('[verify:ui-mvp-contract] MVP UI contract guard passed.');
}

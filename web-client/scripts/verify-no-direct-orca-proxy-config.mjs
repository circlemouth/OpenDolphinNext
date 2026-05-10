#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const webClientRootDir = path.resolve(scriptDir, '..');

const checkedFiles = [
  'vite.config.ts',
  '.env',
  '.env.local',
  '.env.sample',
  '.env.prod.example',
  '.env.stage.example',
];

const forbiddenPatterns = [
  {
    pattern: /['"`]\/(?:api21|api01rv2|orca(?:06|12|21|22|25|51|101|102)|blobapi)(?:['"`/]|$)/,
    reason: 'raw ORCA/WebORCA path must not be exposed through the web-client dev proxy',
  },
  {
    pattern: /\bORCA_(?:API_PASSWORD|BASIC_(?:USER|PASSWORD|KEY)|PROD_BASIC_(?:USER|KEY)|CERT_(?:PATH|PASS)|PROD_CERT(?:_PASS|_PATH)?|PROD_CERT)\b/,
    reason: 'ORCA credentials and certificate material are server-side only',
  },
  {
    pattern: /\bVITE_ORCA_(?:MODE|API_PATH_PREFIX)\b/,
    reason: 'web-client dev proxy must not own ORCA transport mode or raw path prefixing',
  },
  {
    pattern: /\bVITE_(?:DEV_)?PROXY_DROP_ORCA_(?:HEADERS|RESULT_MESSAGE)\b/,
    reason: 'ORCA response header filtering belongs to the server-side adapter, not the browser dev proxy',
  },
  {
    pattern: /\bVITE_DEV_PROXY_INSECURE_TLS\b/,
    reason: 'web-client dev proxy must not provide an ORCA TLS verification bypass',
  },
];

const findings = [];

for (const relativePath of checkedFiles) {
  const absolutePath = path.join(webClientRootDir, relativePath);
  if (!existsSync(absolutePath)) continue;
  const lines = readFileSync(absolutePath, 'utf8').split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const rule of forbiddenPatterns) {
      if (rule.pattern.test(line)) {
        findings.push({
          file: `web-client/${relativePath}`,
          line: index + 1,
          reason: rule.reason,
          text: line.trim(),
        });
      }
    }
  });
}

if (findings.length > 0) {
  console.error('[verify:no-direct-orca-proxy-config] web-client に生 ORCA proxy / credential config が残っています。');
  for (const finding of findings) {
    console.error(` - ${finding.file}:${finding.line} ${finding.reason}: ${finding.text}`);
  }
  process.exit(2);
}

console.log('[verify:no-direct-orca-proxy-config] web-client dev proxy に生 ORCA proxy / credential config はありません。');

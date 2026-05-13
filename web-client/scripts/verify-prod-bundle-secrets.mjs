#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

export const DEFAULT_DIST_DIR = path.resolve(process.cwd(), 'dist');

export const FORBIDDEN_BUNDLE_PATTERNS = [
  {
    id: 'orca-url',
    re: /(?:https?|wss?):\/\/[^"'`\s<>)\\]*orca[^"'`\s<>)\\]*/gi,
    reason: 'ORCA/WebORCA connection URLs must remain server-side',
  },
  {
    id: 'basic-auth-header',
    re: /\b(?:authorization\s*[:=]\s*)?basic\s+[A-Za-z0-9+/]{12,}={0,2}\b/gi,
    reason: 'Basic credentials must not be embedded in the browser bundle',
  },
  {
    id: 'orca-credential-env',
    re: /\bORCA_[A-Z0-9_]*(?:PASSWORD|PASS|SECRET|TOKEN|BASIC|USER|CERT|KEY|CREDENTIAL)[A-Z0-9_]*\b/g,
    reason: 'ORCA credential or certificate env names must not be browser-visible',
  },
  {
    id: 'vite-orca-credential-env',
    re: /\bVITE_ORCA_[A-Z0-9_]*(?:PASSWORD|PASS|SECRET|TOKEN|BASIC|USER|CERT|KEY|CREDENTIAL)[A-Z0-9_]*\b/g,
    reason: 'public VITE_ ORCA credential names indicate an unsafe browser contract',
  },
  {
    id: 'private-key-material',
    re: /-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/g,
    reason: 'private key material must never ship to the browser',
  },
  {
    id: 'certificate-material',
    re: /-----BEGIN CERTIFICATE-----/g,
    reason: 'client certificate material must never ship to the browser',
  },
  {
    id: 'certificate-password-key',
    re: /\b(?:CERT|CERTIFICATE|KEYSTORE|TRUSTSTORE)_[A-Z0-9_]*(?:PASSWORD|PASS|SECRET)\b/g,
    reason: 'certificate password keys must remain server-side',
  },
];

const TEXT_EXTENSIONS = new Set(['.css', '.html', '.js', '.json', '.map', '.mjs', '.svg', '.txt', '.wasm']);

const isTextLike = (filePath) => TEXT_EXTENSIONS.has(path.extname(filePath).toLowerCase());

const walk = (dir) => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
      continue;
    }
    if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
};

const lineAndColumnForIndex = (content, index) => {
  const prefix = content.slice(0, index);
  const lines = prefix.split(/\r?\n/);
  return { line: lines.length, column: lines.at(-1).length + 1 };
};

const redactMatch = (value) => {
  if (value.length <= 12) return '[redacted]';
  return `${value.slice(0, 6)}...[redacted]...${value.slice(-4)}`;
};

export const scanBundleContent = ({ content, file = '<memory>' }) => {
  const findings = [];
  for (const pattern of FORBIDDEN_BUNDLE_PATTERNS) {
    pattern.re.lastIndex = 0;
    for (const match of content.matchAll(pattern.re)) {
      const position = lineAndColumnForIndex(content, match.index ?? 0);
      findings.push({
        file,
        line: position.line,
        column: position.column,
        pattern: pattern.id,
        reason: pattern.reason,
        sample: redactMatch(match[0]),
      });
    }
  }
  return findings;
};

export const scanBundleDirectory = ({ distDir = DEFAULT_DIST_DIR } = {}) => {
  if (!fs.existsSync(distDir) || !fs.statSync(distDir).isDirectory()) {
    throw new Error(`dist dir missing: ${distDir}`);
  }

  const files = walk(distDir);
  const findings = [];
  let scannedFiles = 0;
  for (const filePath of files) {
    if (!isTextLike(filePath)) continue;
    scannedFiles += 1;
    let content;
    try {
      content = fs.readFileSync(filePath, 'utf8');
    } catch {
      continue;
    }
    findings.push(...scanBundleContent({ content, file: path.relative(distDir, filePath) }));
  }

  return {
    ok: findings.length === 0,
    distDir,
    totalFiles: files.length,
    scannedFiles,
    findings,
  };
};

const runCli = () => {
  const distDir = process.env.DIST_DIR ? path.resolve(process.env.DIST_DIR) : DEFAULT_DIST_DIR;
  let result;
  try {
    result = scanBundleDirectory({ distDir });
  } catch (error) {
    console.error(`[verify:prod-bundle-secrets] ${error instanceof Error ? error.message : String(error)}`);
    process.exit(2);
  }

  if (!result.ok) {
    console.error('[verify:prod-bundle-secrets] production bundle に ORCA URL / Basic / 証明書 / secret の混入を検出しました。');
    for (const finding of result.findings) {
      console.error(
        ` - ${finding.file}:${finding.line}:${finding.column} ${finding.pattern} ${finding.sample} (${finding.reason})`,
      );
    }
    process.exit(2);
  }

  console.log(
    `[verify:prod-bundle-secrets] production bundle secret scan passed. ` +
      `dist=${result.distDir} files=${result.totalFiles} scanned=${result.scannedFiles}`,
  );
};

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli();
}

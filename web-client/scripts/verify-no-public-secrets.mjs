#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const projectRootDir = path.resolve(scriptDir, '..');
const repoRootDir = path.resolve(projectRootDir, '..');

const PUBLIC_PREFIX = ['VITE', ''].join('_');
const KEYWORDS = ['PASSWORD', 'PASS', 'SECRET', 'TOKEN', 'APIKEY', 'API_KEY', 'PRIVATE', 'CREDENTIAL'];
const DENYLIST = new Set(['VITE_ORCA_MASTER_USER', 'VITE_ORCA_MASTER_PASSWORD']);
const ENV_KEY_PATTERN = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/;
const ENV_FILE_PATTERN = /^\.env(?:\..*)?$/;
const PUBLIC_SECRET_TOKEN_PATTERN =
  /\b(VITE_[A-Za-z0-9_]*(?:PASSWORD|PASS|SECRET|TOKEN|APIKEY|API_KEY|PRIVATE|CREDENTIAL)[A-Za-z0-9_]*)\b/g;
const DENYLIST_TOKEN_PATTERN = /\b(VITE_ORCA_MASTER_USER|VITE_ORCA_MASTER_PASSWORD)\b/g;

const ACTIVE_PATH_PREFIXES = [
  'web-client/',
  'server-modernized/',
  'api-contract/',
  'domain/',
  'persistence/',
  'reporting/',
  'ops/',
  'scripts/',
  'docs/architecture/',
  'docs/contracts/',
  'docs/managerdocs/',
  'docs/operations/',
  'docs/runbooks/',
  'docs/web-client/',
];
const ACTIVE_EXACT_PATHS = new Set([
  'setup-modernized-env.sh',
  'setup-modernized-env.ps1',
  'docs/README.md',
  'docs/runbooks/release-validation.md',
  'web-client/README.md',
]);
const SKIP_PATH_PREFIXES = [
  'artifacts/',
  'client/',
  'server/',
  'ext_lib/',
  'docs/archive/',
  'docs/implementation/',
  'docs/reference/',
  'web-client/dist/',
  'web-client/coverage/',
  'web-client/node_modules/',
  'web-client/test-results/',
  'server-modernized/target/',
];
const TEXT_FILE_EXTENSIONS = new Set([
  '',
  '.cjs',
  '.css',
  '.env',
  '.example',
  '.html',
  '.java',
  '.js',
  '.json',
  '.jsx',
  '.md',
  '.mjs',
  '.properties',
  '.sample',
  '.sh',
  '.sql',
  '.toml',
  '.ts',
  '.tsx',
  '.txt',
  '.xml',
  '.yaml',
  '.yml',
]);

const listTrackedFiles = () => {
  const result = spawnSync('git', ['ls-files', '-z'], {
    cwd: repoRootDir,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error('[verify:no-public-secrets] git ls-files に失敗しました。');
  }
  return result.stdout.split('\0').filter(Boolean);
};

const hasSecretLikeName = (key) => {
  const upper = key.toUpperCase();
  if (DENYLIST.has(upper)) {
    return true;
  }
  return upper.startsWith(PUBLIC_PREFIX) && KEYWORDS.some((keyword) => upper.includes(keyword));
};

const toRepoPath = (filePath) => path.relative(repoRootDir, filePath).replaceAll(path.sep, '/');

const isActivePath = (repoPath) => {
  if (SKIP_PATH_PREFIXES.some((prefix) => repoPath.startsWith(prefix))) return false;
  if (ACTIVE_EXACT_PATHS.has(repoPath)) return true;
  return ACTIVE_PATH_PREFIXES.some((prefix) => repoPath.startsWith(prefix));
};

const isTextCandidate = (repoPath) => {
  const basename = path.basename(repoPath);
  if (ENV_FILE_PATTERN.test(basename)) return true;
  return TEXT_FILE_EXTENSIONS.has(path.extname(repoPath));
};

const collectTokenMatches = (pattern, line) => {
  const matches = [];
  for (const match of line.matchAll(pattern)) {
    if (match[1]) matches.push(match[1]);
  }
  return matches;
};

const scanFile = (filePath) => {
  const repoPath = toRepoPath(filePath);
  const isMarkdown = path.extname(repoPath) === '.md';
  const content = readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);
  const findings = [];
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;

    const match = line.match(ENV_KEY_PATTERN);
    if (match) {
      const key = match[1];
      if (key && hasSecretLikeName(key)) {
        findings.push({ repoPath, line: index + 1, key });
      }
    }

    if (path.resolve(filePath) === path.resolve(scriptPath) || isMarkdown) return;
    const detectedKeys = new Set([
      ...collectTokenMatches(PUBLIC_SECRET_TOKEN_PATTERN, line),
      ...collectTokenMatches(DENYLIST_TOKEN_PATTERN, line),
    ]);
    for (const key of detectedKeys) {
      if (hasSecretLikeName(key)) {
        findings.push({ repoPath, line: index + 1, key });
      }
    }
  });
  return findings;
};

const scanCandidates = () => {
  return listTrackedFiles()
    .filter((repoPath) => isActivePath(repoPath))
    .filter((repoPath) => isTextCandidate(repoPath))
    .map((repoPath) => path.join(repoRootDir, repoPath));
};

const findings = [];
for (const filePath of scanCandidates()) {
  try {
    findings.push(...scanFile(filePath));
  } catch (error) {
    if (error instanceof Error) {
      console.error(`[verify:no-public-secrets] ${toRepoPath(filePath)} を UTF-8 テキストとして読めませんでした。`);
      process.exit(2);
    }
    throw error;
  }
}

const uniqueFindings = Array.from(
  new Map(findings.map((finding) => [`${finding.repoPath}:${finding.line}:${finding.key}`, finding])).values(),
);

if (uniqueFindings.length > 0) {
  console.error('[verify:no-public-secrets] active source/config/docs から公開 VITE_ 変数に秘密名キーワードを含むキーを検出しました。');
  for (const finding of uniqueFindings) {
    console.error(` - ${finding.repoPath}:${finding.line} ${finding.key}`);
  }
  process.exit(2);
}

console.log('[verify:no-public-secrets] active source/config/docs に公開 VITE_ secret key は検出されませんでした。');

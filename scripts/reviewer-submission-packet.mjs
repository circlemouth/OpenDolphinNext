#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const REQUIRED_CLOSEOUT_FILES = [
  'git/run-id.txt',
  'git/accepted-branch.txt',
  'git/git-head-current.txt',
  'git/git-branch-current.txt',
  'git/git-status-short.txt',
  'git/git-merge-base-origin-master.txt',
  'git/git-diff-stat.txt',
  'git/git-log-oneline.txt',
  'reports/final-report.md',
  'reports/command-log.md',
  'reports/blocker-classification.md',
  'qa/acceptmodv2/accept-summary.json',
  'qa/acceptmodv2/steps.log',
  'qa/acceptmodv2/console.json',
  'qa/acceptmodv2/page-errors.json',
  'qa/fullflow/summary.json',
  'qa/fullflow/steps.log',
  'qa/fullflow/console.json',
  'qa/fullflow/page-errors.json',
  'qa/fullflow/network/network.json',
  'qa/fullflow/network/requests.json',
  'evidence/patients-import/import-summary.json',
  'evidence/patients-import/raw-upstream-request.xml',
  'evidence/patients-import/raw-upstream-response.xml',
  'evidence/patients-import/server-stacktrace.log',
  'evidence/patients-import/audit.log',
  'evidence/medical-information-probe/probe-summary.json',
  'evidence/medical-information-probe/raw-request.xml',
  'evidence/medical-information-probe/raw-response.xml',
  'evidence/medical-information-probe/route-response.json',
  'evidence/medical-information-probe/server-stacktrace.log',
  'evidence/runtime-blockers/blocker-summary.json',
  'evidence/runtime-blockers/selected-visit-row.json',
  'evidence/runtime-blockers/handoff-state.json',
];

const DOC_MAPPINGS = [
  ['docs/runbooks/release-validation.md', 'docs/release-validation.md'],
  ['docs/releases/orca-remediation-cutover.md', 'docs/orca-remediation-cutover.md'],
  ['docs/runbooks/reviewer-submission-packet.md', 'docs/packet-skill.md'],
];

const REQUIRED_PACKET_FILES = [
  'README_REVIEW.md',
  'manifest.json',
  'manifest.sha256',
  'review-checkout/.git/HEAD',
  'closeout-packet/git/run-id.txt',
  'closeout-packet/git/accepted-branch.txt',
  'closeout-packet/git/git-head-current.txt',
  'closeout-packet/git/git-branch-current.txt',
  'closeout-packet/git/git-status-short.txt',
  'closeout-packet/git/git-merge-base-origin-master.txt',
  'closeout-packet/git/git-diff-stat.txt',
  'closeout-packet/git/git-log-oneline.txt',
  'closeout-packet/reports/final-report.md',
  'closeout-packet/reports/command-log.md',
  'closeout-packet/reports/blocker-classification.md',
  'closeout-packet/qa/acceptmodv2/accept-summary.json',
  'closeout-packet/qa/acceptmodv2/steps.log',
  'closeout-packet/qa/acceptmodv2/console.json',
  'closeout-packet/qa/acceptmodv2/page-errors.json',
  'closeout-packet/qa/fullflow/summary.json',
  'closeout-packet/qa/fullflow/steps.log',
  'closeout-packet/qa/fullflow/console.json',
  'closeout-packet/qa/fullflow/page-errors.json',
  'closeout-packet/qa/fullflow/network/network.json',
  'closeout-packet/qa/fullflow/network/requests.json',
  'closeout-packet/evidence/patients-import/import-summary.json',
  'closeout-packet/evidence/patients-import/raw-upstream-request.xml',
  'closeout-packet/evidence/patients-import/raw-upstream-response.xml',
  'closeout-packet/evidence/patients-import/server-stacktrace.log',
  'closeout-packet/evidence/patients-import/audit.log',
  'closeout-packet/evidence/medical-information-probe/probe-summary.json',
  'closeout-packet/evidence/medical-information-probe/raw-request.xml',
  'closeout-packet/evidence/medical-information-probe/raw-response.xml',
  'closeout-packet/evidence/medical-information-probe/route-response.json',
  'closeout-packet/evidence/medical-information-probe/server-stacktrace.log',
  'closeout-packet/evidence/runtime-blockers/blocker-summary.json',
  'closeout-packet/evidence/runtime-blockers/selected-visit-row.json',
  'closeout-packet/evidence/runtime-blockers/handoff-state.json',
  'closeout-packet/docs/release-validation.md',
  'closeout-packet/docs/orca-remediation-cutover.md',
  'closeout-packet/docs/packet-skill.md',
];

const TEXT_EXTENSIONS = new Set([
  '.json',
  '.log',
  '.md',
  '.txt',
  '.xml',
  '.yaml',
  '.yml',
  '.csv',
]);

const FORBIDDEN_REVIEW_CHECKOUT_SEGMENTS = [
  '/node_modules/',
  '/target/',
  '/dist/',
  '/coverage/',
  '/test-results/',
  '/artifacts/',
  '/tmp/',
  '/__MACOSX/',
];

const FORBIDDEN_TOP_LEVEL_DIR_NAMES = new Set([
  'artifacts',
  'coverage',
  'dist',
  'node_modules',
  'target',
  'test-results',
  'tmp',
  '__MACOSX',
]);

function usage() {
  console.log(`Usage:
  node scripts/reviewer-submission-packet.mjs --run-id RUN_ID --accepted-ref REF [--accepted-head COMMIT] [--output DIR] [--dry-run]
  node scripts/reviewer-submission-packet.mjs --validate-only --run-id RUN_ID --accepted-ref REF [--accepted-head COMMIT] [--output DIR]

Options:
  --run-id         Required. Closeout RUN_ID (YYYYMMDDTHHMMSSZ)
  --accepted-ref   Required. Accepted branch/ref to lock as source of truth
  --accepted-head  Optional. Freeze the accepted commit when the branch/ref has advanced
  --output         Output directory (default: artifacts/reviewer-submission-packets)
  --dry-run        Validate inputs and print the intended packet paths without writing
  --validate-only  Validate an already-generated packet in --output
  -h, --help       Show this message`);
}

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  const options = {
    output: 'artifacts/reviewer-submission-packets',
    dryRun: false,
    validateOnly: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case '--run-id':
        options.runId = argv[++index];
        break;
      case '--accepted-ref':
        options.acceptedRef = argv[++index];
        break;
      case '--accepted-head':
        options.acceptedHead = argv[++index];
        break;
      case '--output':
        options.output = argv[++index];
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--validate-only':
        options.validateOnly = true;
        break;
      case '-h':
      case '--help':
        options.help = true;
        break;
      default:
        fail(`Unknown option: ${arg}`);
    }
  }

  return options;
}

function resolveRepoRoot() {
  if (process.env.REVIEWER_PACKET_REPO_ROOT) {
    return path.resolve(process.env.REVIEWER_PACKET_REPO_ROOT);
  }
  return execCommand('git', ['rev-parse', '--show-toplevel'], process.cwd()).trim();
}

function execCommand(command, args, cwd, extraEnv = {}) {
  return execFileSync(command, args, {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, ...extraEnv },
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 64 * 1024 * 1024,
  });
}

function runCommand(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0) {
    const stderr = result.stderr?.trim() || `${command} failed`;
    fail(stderr);
  }
  return result.stdout.trim();
}

function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function isRunId(value) {
  return /^[0-9]{8}T[0-9]{6}Z$/.test(value ?? '');
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
}

function writeText(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, value, 'utf8');
}

function readJson(filePath) {
  return JSON.parse(readText(filePath));
}

function walkFiles(rootDir, options = {}) {
  const includeDotDirs = options.includeDotDirs ?? false;
  const entries = [];
  const stack = [rootDir];
  while (stack.length > 0) {
    const current = stack.pop();
    const items = fs.readdirSync(current, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name));
    for (const item of items) {
      const fullPath = path.join(current, item.name);
      if (item.isDirectory()) {
        if (!includeDotDirs && item.name.startsWith('.')) {
          continue;
        }
        stack.push(fullPath);
      } else if (item.isFile()) {
        entries.push(fullPath);
      }
    }
  }
  return entries.sort();
}

function toPosix(value) {
  return value.split(path.sep).join('/');
}

function relativePosix(baseDir, targetPath) {
  return toPosix(path.relative(baseDir, targetPath));
}

function looksLikeSuccessfulSend(summary) {
  const statusText = String(summary?.sendResult?.status ?? '');
  const statusCode = Number.parseInt(statusText, 10);
  return Number.isInteger(statusCode) && statusCode >= 200 && statusCode < 300;
}

function requiresMedicalmodXml(summary) {
  if (summary?.sendResult?.requestXmlPath || summary?.evidencePaths?.requestXml) {
    return true;
  }
  if (looksLikeSuccessfulSend(summary)) {
    return true;
  }
  return String(summary?.blockerClassification ?? '') === 'none';
}

function validateRequiredFiles(rootDir, relativePaths) {
  const missing = relativePaths.filter((relativePath) => !fs.existsSync(path.join(rootDir, relativePath)));
  if (missing.length > 0) {
    fail(`Missing required files:\n${missing.join('\n')}`);
  }
}

function isLikelyLocalAbsolutePath(content) {
  const patterns = [
    /(^|[\s"'=(])\/Users\/[^/\s][^\s"'<>)]*/m,
    /(^|[\s"'=(])\/home\/[^/\s][^\s"'<>)]*/m,
    /(^|[\s"'=(])\/private\/tmp\/[^\s"'<>)]*/m,
    /(^|[\s"'=(])\/tmp\/[^\s"'<>)]*/m,
    /(^|[\s"'=(])\/var\/folders\/[^\s"'<>)]*/m,
    /(^|[\s"'=(])\/Volumes\/[^\s"'<>)]*/m,
    /(^|[\s"'=(])[A-Za-z]:\\\\[^\s"'<>)]*/m,
  ];
  return patterns.some((pattern) => pattern.test(content));
}

function normalizePacketText(content, repoRoot, runId) {
  let normalized = content;
  const repoRootPosix = toPosix(repoRoot);
  if (repoRootPosix) {
    normalized = normalized.split(`${repoRootPosix}/`).join('');
  }
  normalized = normalized
    .split(`artifacts/orca-remediation/closeout/${runId}/`)
    .join('closeout-packet/')
    .split(`artifacts/orca-remediation/${runId}/`)
    .join('closeout-packet/')
    .split(`submission-packet-${runId}/`)
    .join('');
  return normalized;
}

function copyAndNormalizeCloseout(closeoutRoot, targetRoot, repoRoot, runId) {
  fs.cpSync(closeoutRoot, targetRoot, { recursive: true });
  for (const filePath of walkFiles(targetRoot, { includeDotDirs: true })) {
    if (!TEXT_EXTENSIONS.has(path.extname(filePath))) {
      continue;
    }
    const normalized = normalizePacketText(readText(filePath), repoRoot, runId);
    writeText(filePath, normalized);
  }
}

function sanitizeOriginUrl(originUrl) {
  if (!originUrl) {
    return '';
  }
  if (/^(https?|ssh|git):/i.test(originUrl) || originUrl.startsWith('git@')) {
    return originUrl;
  }
  return 'redacted-local-origin';
}

function listSparseCheckoutDirs(repoRoot) {
  return fs.readdirSync(repoRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => name !== '.git')
    .filter((name) => !FORBIDDEN_TOP_LEVEL_DIR_NAMES.has(name))
    .sort();
}

function listTrackedForbiddenDirs(repoRoot, acceptedHead) {
  const trackedFiles = execCommand('git', ['ls-tree', '-r', '--name-only', acceptedHead], repoRoot)
    .split('\n')
    .filter(Boolean);
  const forbiddenDirs = new Set();
  for (const trackedFile of trackedFiles) {
    const segments = trackedFile.split('/');
    let currentPath = '';
    for (let index = 0; index < segments.length - 1; index += 1) {
      currentPath = currentPath ? `${currentPath}/${segments[index]}` : segments[index];
      if (FORBIDDEN_TOP_LEVEL_DIR_NAMES.has(segments[index])) {
        forbiddenDirs.add(currentPath);
      }
    }
  }
  return [...forbiddenDirs].sort();
}

function buildSparseCheckoutPatterns(repoRoot, acceptedHead) {
  const patterns = ['/*', '!/*/'];
  for (const dirName of listSparseCheckoutDirs(repoRoot)) {
    patterns.push(`/${dirName}/`);
    patterns.push(`/${dirName}/**`);
  }
  for (const forbiddenDir of listTrackedForbiddenDirs(repoRoot, acceptedHead)) {
    patterns.push(`!/${forbiddenDir}/`);
    patterns.push(`!/${forbiddenDir}/**`);
  }
  return `${patterns.join('\n')}\n`;
}

function createReviewCheckout(repoRoot, acceptedRef, acceptedHead, sourceOriginMasterHead, targetDir) {
  runCommand('git', ['clone', '--quiet', '--no-hardlinks', repoRoot, targetDir], repoRoot);
  runCommand('git', ['sparse-checkout', 'init', '--no-cone'], targetDir);
  writeText(path.join(targetDir, '.git/info/sparse-checkout'), buildSparseCheckoutPatterns(repoRoot, acceptedHead));
  runCommand('git', ['read-tree', '-mu', 'HEAD'], targetDir);
  const sourceOriginUrl = execCommand('git', ['remote', 'get-url', 'origin'], repoRoot).trim();
  const sanitizedOriginUrl = sanitizeOriginUrl(sourceOriginUrl);
  if (sourceOriginUrl) {
    runCommand('git', ['remote', 'set-url', 'origin', sourceOriginUrl], targetDir);
  }
  runCommand('git', ['update-ref', 'refs/remotes/origin/master', sourceOriginMasterHead], targetDir);
  if (sanitizedOriginUrl && sanitizedOriginUrl !== sourceOriginUrl) {
    runCommand('git', ['remote', 'set-url', 'origin', sanitizedOriginUrl], targetDir);
  }
  const branchName = acceptedRef.includes('/') || acceptedRef === 'master' || acceptedRef === 'main'
    ? acceptedRef
    : 'accepted-review-head';
  runCommand('git', ['checkout', '--quiet', '-B', branchName, acceptedHead], targetDir);
  // Keep the checkout self-contained, but split large packfiles so the packet zip stays writable.
  runCommand('git', ['repack', '-ad', '--max-pack-size=1g'], targetDir);
}

function verifyReviewCheckout(reviewCheckoutDir, acceptedHead) {
  const head = execCommand('git', ['rev-parse', 'HEAD'], reviewCheckoutDir).trim();
  if (head !== acceptedHead) {
    fail(`review-checkout HEAD mismatch: expected ${acceptedHead}, got ${head}`);
  }

  const status = execCommand('git', ['status', '--short'], reviewCheckoutDir).trim();
  if (status !== '') {
    fail(`review-checkout is not clean:\n${status}`);
  }

  execCommand('git', ['rev-parse', '--verify', 'origin/master^{commit}'], reviewCheckoutDir);

  const files = walkFiles(reviewCheckoutDir, { includeDotDirs: true });
  const forbidden = files
    .map((filePath) => `/${relativePosix(reviewCheckoutDir, filePath)}`)
    .filter((relativePath) => FORBIDDEN_REVIEW_CHECKOUT_SEGMENTS.some((segment) => relativePath.includes(segment)));
  if (forbidden.length > 0) {
    fail(`Forbidden generated artifacts were copied into review-checkout:\n${forbidden.join('\n')}`);
  }
}

function buildManifest(packetDir, runId, acceptedRef, acceptedHead, mergeBaseOriginMaster) {
  const files = walkFiles(packetDir, { includeDotDirs: true })
    .filter((filePath) => !['manifest.json', 'manifest.sha256'].includes(path.basename(filePath)))
    .map((filePath) => ({
      path: relativePosix(packetDir, filePath),
      sha256: sha256File(filePath),
      bytes: fs.statSync(filePath).size,
    }));

  return {
    packetType: 'reviewer-submission-packet',
    runId,
    acceptedRef,
    acceptedHead,
    mergeBaseOriginMaster,
    generatedAt: new Date().toISOString(),
    files,
  };
}

function writeManifest(packetDir, manifest) {
  const manifestPath = path.join(packetDir, 'manifest.json');
  writeText(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  const manifestSha = sha256File(manifestPath);
  writeText(path.join(packetDir, 'manifest.sha256'), `${manifestSha}  manifest.json\n`);
}

function writeReadme(packetDir, runId, acceptedRef, acceptedHead) {
  const readme = `# Reviewer Submission Packet

- RUN_ID: ${runId}
- Accepted ref: ${acceptedRef}
- Accepted HEAD: ${acceptedHead}

## Layout

- \`review-checkout/\`: clean git checkout with \`.git/\` and \`origin/master\`
- \`closeout-packet/\`: closeout evidence for the same RUN_ID and HEAD
- \`manifest.json\`: packet-relative file inventory with sha256 digests
- \`manifest.sha256\`: sha256 digest for \`manifest.json\`

## Validation

- Regenerate with \`./scripts/create-reviewer-submission-packet.sh --run-id ${runId} --accepted-ref ${acceptedRef}\`
- Re-validate with \`./scripts/validate-reviewer-submission-packet.sh --run-id ${runId} --accepted-ref ${acceptedRef}\`

## Review Notes

- All paths inside reports, manifests, and copied evidence are packet-relative.
- \`review-checkout/\` intentionally excludes closeout artifacts and generated build outputs.
`;
  writeText(path.join(packetDir, 'README_REVIEW.md'), readme);
}

function packetDirFor(outputDir, runId) {
  return path.join(outputDir, `submission-packet-${runId}`);
}

function zipPathFor(outputDir, runId) {
  return path.join(outputDir, `submission-packet-${runId}.zip`);
}

function validateSourceInputs(repoRoot, runId, acceptedRef, acceptedHeadOverride) {
  if (!isRunId(runId)) {
    fail(`Invalid RUN_ID: ${runId}`);
  }
  if (!acceptedRef) {
    fail('--accepted-ref is required');
  }

  const acceptedHead = acceptedHeadOverride
    ? execCommand('git', ['rev-parse', `${acceptedHeadOverride}^{commit}`], repoRoot).trim()
    : execCommand('git', ['rev-parse', `${acceptedRef}^{commit}`], repoRoot).trim();
  const sourceOriginMasterHead = execCommand('git', ['rev-parse', 'origin/master^{commit}'], repoRoot).trim();
  const mergeBaseOriginMaster = execCommand('git', ['merge-base', acceptedHead, 'origin/master'], repoRoot).trim();
  const closeoutRoot = path.join(repoRoot, 'artifacts', 'orca-remediation', 'closeout', runId);

  if (!fs.existsSync(closeoutRoot)) {
    fail(`Closeout root not found: artifacts/orca-remediation/closeout/${runId}`);
  }

  validateRequiredFiles(closeoutRoot, REQUIRED_CLOSEOUT_FILES);

  for (const [sourcePath] of DOC_MAPPINGS) {
    if (!fs.existsSync(path.join(repoRoot, sourcePath))) {
      fail(`Missing required documentation source: ${sourcePath}`);
    }
  }

  const runIdFile = readText(path.join(closeoutRoot, 'git/run-id.txt')).trim();
  if (runIdFile !== runId) {
    fail(`RUN_ID mismatch in closeout evidence: expected ${runId}, got ${runIdFile}`);
  }

  const acceptedBranchFile = readText(path.join(closeoutRoot, 'git/accepted-branch.txt')).trim();
  if (acceptedBranchFile !== acceptedRef) {
    fail(`accepted-branch mismatch: expected ${acceptedRef}, got ${acceptedBranchFile}`);
  }

  const closeoutHead = readText(path.join(closeoutRoot, 'git/git-head-current.txt')).trim();
  if (closeoutHead !== acceptedHead) {
    fail(`closeout git-head-current mismatch: expected ${acceptedHead}, got ${closeoutHead}`);
  }

  const fullflowSummary = readJson(path.join(closeoutRoot, 'qa/fullflow/summary.json'));
  const medicalmodXmlPath = path.join(closeoutRoot, 'qa/fullflow/request-xml/medicalmodv2.xml');
  if (requiresMedicalmodXml(fullflowSummary) && !fs.existsSync(medicalmodXmlPath)) {
    fail('medicalmodv2.xml is required for a send-reached fullflow run but is missing');
  }

  return {
    acceptedHead,
    closeoutRoot,
    mergeBaseOriginMaster,
    sourceOriginMasterHead,
  };
}

function createZip(outputDir, runId) {
  const packetName = `submission-packet-${runId}`;
  const zipPath = zipPathFor(outputDir, runId);
  if (fs.existsSync(zipPath)) {
    fs.rmSync(zipPath, { force: true });
  }
  const result = spawnSync('zip', ['-qry', zipPath, packetName], {
    cwd: outputDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0) {
    fail(result.stderr?.trim() || 'zip failed');
  }
}

function validateManifest(packetDir, manifest) {
  const actualFiles = walkFiles(packetDir, { includeDotDirs: true })
    .filter((filePath) => !['manifest.json', 'manifest.sha256'].includes(path.basename(filePath)))
    .map((filePath) => relativePosix(packetDir, filePath));
  const manifestFiles = manifest.files.map((entry) => entry.path).sort();
  if (JSON.stringify(actualFiles) !== JSON.stringify(manifestFiles)) {
    fail('manifest.json file list does not match packet contents');
  }
}

function validateNoAbsolutePaths(packetDir) {
  const scanRoots = [
    path.join(packetDir, 'README_REVIEW.md'),
    path.join(packetDir, 'manifest.json'),
    path.join(packetDir, 'manifest.sha256'),
    path.join(packetDir, 'closeout-packet'),
  ];

  const filesToScan = [];
  for (const scanRoot of scanRoots) {
    if (!fs.existsSync(scanRoot)) {
      continue;
    }
    const stats = fs.statSync(scanRoot);
    if (stats.isDirectory()) {
      filesToScan.push(...walkFiles(scanRoot, { includeDotDirs: true }));
    } else {
      filesToScan.push(scanRoot);
    }
  }

  const offenders = [];
  for (const filePath of filesToScan) {
    if (!TEXT_EXTENSIONS.has(path.extname(filePath))) {
      continue;
    }
    const content = readText(filePath);
    if (isLikelyLocalAbsolutePath(content)) {
      offenders.push(relativePosix(packetDir, filePath));
    }
  }
  if (offenders.length > 0) {
    fail(`Absolute local paths remain in packet text files:\n${offenders.join('\n')}`);
  }
}

function validatePacket(outputDir, runId, acceptedRef, acceptedHead) {
  const packetDir = packetDirFor(outputDir, runId);
  if (!fs.existsSync(packetDir)) {
    fail(`Packet directory not found: ${packetDir}`);
  }

  validateRequiredFiles(packetDir, REQUIRED_PACKET_FILES);

  const manifestPath = path.join(packetDir, 'manifest.json');
  const manifest = readJson(manifestPath);
  if (manifest.runId !== runId) {
    fail(`manifest RUN_ID mismatch: expected ${runId}, got ${manifest.runId}`);
  }
  if (manifest.acceptedRef !== acceptedRef) {
    fail(`manifest acceptedRef mismatch: expected ${acceptedRef}, got ${manifest.acceptedRef}`);
  }
  if (manifest.acceptedHead !== acceptedHead) {
    fail(`manifest acceptedHead mismatch: expected ${acceptedHead}, got ${manifest.acceptedHead}`);
  }
  validateManifest(packetDir, manifest);

  const manifestShaPath = path.join(packetDir, 'manifest.sha256');
  const manifestShaContent = readText(manifestShaPath).trim();
  const [actualSha] = manifestShaContent.split(/\s+/);
  if (actualSha !== sha256File(manifestPath)) {
    fail('manifest.sha256 does not match manifest.json');
  }

  const reviewCheckoutDir = path.join(packetDir, 'review-checkout');
  verifyReviewCheckout(reviewCheckoutDir, acceptedHead);

  const closeoutHead = readText(path.join(packetDir, 'closeout-packet/git/git-head-current.txt')).trim();
  if (closeoutHead !== acceptedHead) {
    fail(`closeout packet HEAD mismatch: expected ${acceptedHead}, got ${closeoutHead}`);
  }

  const closeoutAcceptedBranch = readText(path.join(packetDir, 'closeout-packet/git/accepted-branch.txt')).trim();
  if (closeoutAcceptedBranch !== acceptedRef) {
    fail(`closeout packet accepted branch mismatch: expected ${acceptedRef}, got ${closeoutAcceptedBranch}`);
  }

  const summary = readJson(path.join(packetDir, 'closeout-packet/qa/fullflow/summary.json'));
  const medicalmodXmlPath = path.join(packetDir, 'closeout-packet/qa/fullflow/request-xml/medicalmodv2.xml');
  if (requiresMedicalmodXml(summary) && !fs.existsSync(medicalmodXmlPath)) {
    fail('Packet is missing qa/fullflow/request-xml/medicalmodv2.xml for a send-reached run');
  }

  validateNoAbsolutePaths(packetDir);

  const zipPath = zipPathFor(outputDir, runId);
  if (fs.existsSync(zipPath)) {
    const zipEntries = runCommand('zipinfo', ['-1', zipPath], outputDir)
      .split('\n')
      .filter(Boolean);
    const requiredZipEntries = [
      `submission-packet-${runId}/README_REVIEW.md`,
      `submission-packet-${runId}/manifest.json`,
      `submission-packet-${runId}/review-checkout/.git/HEAD`,
      `submission-packet-${runId}/closeout-packet/reports/final-report.md`,
    ];
    for (const entry of requiredZipEntries) {
      if (!zipEntries.includes(entry)) {
        fail(`zip is missing required entry: ${entry}`);
      }
    }
  }
}

function createPacket(repoRoot, runId, acceptedRef, acceptedHeadOverride, outputDir) {
  const {
    acceptedHead,
    closeoutRoot,
    mergeBaseOriginMaster,
    sourceOriginMasterHead,
  } = validateSourceInputs(repoRoot, runId, acceptedRef, acceptedHeadOverride);
  const packetDir = packetDirFor(outputDir, runId);
  const zipPath = zipPathFor(outputDir, runId);

  if (fs.existsSync(packetDir)) {
    fs.rmSync(packetDir, { recursive: true, force: true });
  }
  if (fs.existsSync(zipPath)) {
    fs.rmSync(zipPath, { force: true });
  }

  ensureDir(outputDir);

  const stagingRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'reviewer-packet-'));
  const stagingPacketDir = path.join(stagingRoot, path.basename(packetDir));
  ensureDir(stagingPacketDir);

  try {
    createReviewCheckout(
      repoRoot,
      acceptedRef,
      acceptedHead,
      sourceOriginMasterHead,
      path.join(stagingPacketDir, 'review-checkout'),
    );
    copyAndNormalizeCloseout(closeoutRoot, path.join(stagingPacketDir, 'closeout-packet'), repoRoot, runId);

    for (const [sourcePath, destinationPath] of DOC_MAPPINGS) {
      const sourceAbsolutePath = path.join(repoRoot, sourcePath);
      const destinationAbsolutePath = path.join(stagingPacketDir, 'closeout-packet', destinationPath);
      ensureDir(path.dirname(destinationAbsolutePath));
      fs.copyFileSync(sourceAbsolutePath, destinationAbsolutePath);
    }

    for (const filePath of walkFiles(path.join(stagingPacketDir, 'closeout-packet'), { includeDotDirs: true })) {
      if (!TEXT_EXTENSIONS.has(path.extname(filePath))) {
        continue;
      }
      writeText(filePath, normalizePacketText(readText(filePath), repoRoot, runId));
    }

    writeReadme(stagingPacketDir, runId, acceptedRef, acceptedHead);
    const manifest = buildManifest(stagingPacketDir, runId, acceptedRef, acceptedHead, mergeBaseOriginMaster);
    writeManifest(stagingPacketDir, manifest);
    validatePacket(stagingRoot, runId, acceptedRef, acceptedHead);

    fs.renameSync(stagingPacketDir, packetDir);
    createZip(outputDir, runId);
    validatePacket(outputDir, runId, acceptedRef, acceptedHead);
  } finally {
    fs.rmSync(stagingRoot, { recursive: true, force: true });
  }

  return {
    acceptedHead,
    outputDir,
    packetDir,
    zipPath,
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    usage();
    return;
  }

  if (!options.runId) {
    fail('--run-id is required');
  }
  if (!options.acceptedRef) {
    fail('--accepted-ref is required');
  }

  const repoRoot = resolveRepoRoot();
  const outputDir = path.resolve(repoRoot, options.output);

  if (options.validateOnly) {
    const acceptedHead = options.acceptedHead
      ? execCommand('git', ['rev-parse', `${options.acceptedHead}^{commit}`], repoRoot).trim()
      : execCommand('git', ['rev-parse', `${options.acceptedRef}^{commit}`], repoRoot).trim();
    validatePacket(outputDir, options.runId, options.acceptedRef, acceptedHead);
    console.log(`VALID packet=${packetDirFor(outputDir, options.runId)}`);
    return;
  }

  const { acceptedHead } = validateSourceInputs(repoRoot, options.runId, options.acceptedRef, options.acceptedHead);

  if (options.dryRun) {
    console.log(
      JSON.stringify(
        {
          runId: options.runId,
          acceptedRef: options.acceptedRef,
          acceptedHead,
          packetDir: packetDirFor(outputDir, options.runId),
          zipPath: zipPathFor(outputDir, options.runId),
        },
        null,
        2,
      ),
    );
    return;
  }

  const result = createPacket(repoRoot, options.runId, options.acceptedRef, options.acceptedHead, outputDir);
  console.log(`CREATED packet=${result.packetDir}`);
  console.log(`CREATED zip=${result.zipPath}`);
  console.log(`ACCEPTED_HEAD ${result.acceptedHead}`);
}

try {
  main();
} catch (error) {
  console.error(`ERROR ${error.message}`);
  process.exit(1);
}

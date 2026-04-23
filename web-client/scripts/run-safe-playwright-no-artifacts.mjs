#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..', '..');
const configPath = path.join(repoRoot, 'playwright.no-artifacts.config.ts');
const outputDir = path.join(repoRoot, 'test-results', 'no-artifacts');

const forbiddenPatterns = [
  { label: 'artifact-capturing fixture import', pattern: /from\s+['"][^'"]*playwright\/fixtures['"]/ },
  { label: 'page.screenshot', pattern: /\bpage\s*\.\s*screenshot\s*\(/ },
  { label: 'locator.screenshot', pattern: /\blocator\s*\([^)]*\)\s*\.\s*screenshot\s*\(/ },
  { label: 'context.tracing', pattern: /\b(?:context|browserContext)\s*\.\s*tracing\b|\btracing\s*\./ },
  { label: 'recordHar', pattern: /\brecordHar\b|\bhar\s*:/i },
  { label: 'recordVideo', pattern: /\brecordVideo\b|\bvideo\s*:/i },
  { label: 'testInfo.attach', pattern: /\btestInfo\s*\.\s*attach\s*\(/ },
  { label: 'artifact directory write', pattern: /\bPLAYWRIGHT_ARTIFACT_DIR\b|\bartifactDir\b|artifacts\/|test-results\// },
  { label: 'raw network dump name', pattern: /\b(?:network|requests|responses)\.json\b|\.har\b/i },
];

const requiredConfigTerms = [
  "trace: 'off'",
  "screenshot: 'off'",
  "video: 'off'",
  "reporter: [['line']]",
];

const forbiddenOutputFilePatterns = [
  /\.har$/i,
  /(^|\/)trace[^/]*\.zip$/i,
  /\.webm$/i,
  /\.mp4$/i,
  /\.png$/i,
  /\.jpe?g$/i,
  /(^|\/)error-context\.md$/i,
  /(^|\/)(?:network|requests|responses)\.json$/i,
];

const usage = () => {
  console.error(
    [
      'Usage:',
      '  node web-client/scripts/run-safe-playwright-no-artifacts.mjs [--dry-run] [--run-id YYYYMMDDThhmmssZ] <spec...>',
      '',
      'Runs selected Playwright specs only after rejecting explicit screenshot/HAR/trace/video/raw-artifact code.',
    ].join('\n'),
  );
};

const parseArgs = (argv) => {
  const specs = [];
  let dryRun = false;
  let runId = process.env.RUN_ID || '';

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--dry-run') {
      dryRun = true;
      continue;
    }
    if (arg === '--run-id') {
      runId = argv[index + 1] || '';
      index += 1;
      continue;
    }
    if (arg.startsWith('--run-id=')) {
      runId = arg.slice('--run-id='.length);
      continue;
    }
    if (arg.startsWith('-')) {
      throw new Error(`Unsupported option: ${arg}`);
    }
    specs.push(arg);
  }

  return { dryRun, runId, specs };
};

const toRepoRelative = (absolutePath) => path.relative(repoRoot, absolutePath).split(path.sep).join('/');

const resolveSpecPath = (spec) => {
  const absolutePath = path.resolve(repoRoot, spec);
  const relativePath = toRepoRelative(absolutePath);

  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error(`Spec is outside repository: ${spec}`);
  }
  if (!existsSync(absolutePath)) {
    throw new Error(`Spec not found: ${relativePath}`);
  }
  if (!statSync(absolutePath).isFile()) {
    throw new Error(`Spec is not a file: ${relativePath}`);
  }
  if (!/\.(?:spec|test)\.[cm]?[jt]sx?$/.test(absolutePath)) {
    throw new Error(`Spec must be a Playwright spec/test file: ${relativePath}`);
  }
  if (relativePath.includes('/node_modules/') || relativePath.startsWith('node_modules/')) {
    throw new Error(`Spec may not come from node_modules: ${relativePath}`);
  }

  return { absolutePath, relativePath };
};

const validateRunId = (runId) => {
  if (!runId) {
    return undefined;
  }
  if (!/^\d{8}T\d{6}Z$/.test(runId)) {
    throw new Error('RUN_ID must match YYYYMMDDThhmmssZ');
  }
  return runId;
};

const validateConfig = () => {
  if (!existsSync(configPath)) {
    throw new Error(`Safe Playwright config missing: ${toRepoRelative(configPath)}`);
  }
  const source = readFileSync(configPath, 'utf8');
  const missing = requiredConfigTerms.filter((term) => !source.includes(term));
  if (missing.length > 0) {
    throw new Error(`Safe Playwright config is missing required no-artifact terms: ${missing.join(', ')}`);
  }
};

const scanSpec = ({ absolutePath, relativePath }) => {
  const source = readFileSync(absolutePath, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  const findings = forbiddenPatterns
    .filter(({ pattern }) => pattern.test(source))
    .map(({ label }) => label);
  return { relativePath, findings };
};

const listFiles = (dir) => {
  if (!existsSync(dir)) {
    return [];
  }

  const entries = readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return listFiles(entryPath);
    }
    if (entry.isFile()) {
      return [entryPath];
    }
    return [];
  });
};

const cleanupPlaywrightMetadata = () => {
  const lastRunPath = path.join(outputDir, '.last-run.json');
  if (existsSync(lastRunPath)) {
    rmSync(lastRunPath, { force: true });
  }
};

const assertNoForbiddenOutputArtifacts = () => {
  const forbiddenFiles = listFiles(outputDir)
    .map(toRepoRelative)
    .filter((relativePath) => forbiddenOutputFilePatterns.some((pattern) => pattern.test(relativePath)));

  if (forbiddenFiles.length > 0) {
    throw new Error(`Forbidden Playwright output artifact retained: ${forbiddenFiles.join(', ')}`);
  }
};

const main = async () => {
  const { dryRun, runId: rawRunId, specs: rawSpecs } = parseArgs(process.argv.slice(2));
  const runId = validateRunId(rawRunId);

  if (rawSpecs.length === 0) {
    usage();
    process.exitCode = 2;
    return;
  }

  validateConfig();

  const specs = rawSpecs.map(resolveSpecPath);
  const scanResults = specs.map(scanSpec);
  const blocked = scanResults.filter((result) => result.findings.length > 0);

  if (blocked.length > 0) {
    console.error('safe_playwright_no_artifacts=blocked');
    for (const result of blocked) {
      console.error(`${result.relativePath}: ${result.findings.join(', ')}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`safe_playwright_no_artifacts=ready specs=${specs.length} dryRun=${dryRun ? 'true' : 'false'}`);

  if (dryRun) {
    return;
  }

  const commandArgs = [
    'playwright',
    'test',
    '--config',
    toRepoRelative(configPath),
    ...specs.map((spec) => spec.relativePath),
  ];
  const child = spawn('npx', commandArgs, {
    cwd: repoRoot,
    env: {
      ...process.env,
      ...(runId ? { RUN_ID: runId } : {}),
      PLAYWRIGHT_NO_ARTIFACTS: '1',
      PLAYWRIGHT_NO_COPY_PROMPT: '1',
      PLAYWRIGHT_HTML_OPEN: 'never',
    },
    stdio: 'inherit',
  });

  child.on('exit', (code, signal) => {
    cleanupPlaywrightMetadata();
    try {
      assertNoForbiddenOutputArtifacts();
    } catch (error) {
      console.error(`safe_playwright_no_artifacts=artifact_violation reason=${error.message}`);
      process.exitCode = 1;
      return;
    }

    if (signal) {
      console.error(`safe_playwright_no_artifacts=interrupted signal=${signal}`);
      process.exitCode = 1;
      return;
    }
    process.exitCode = code ?? 1;
  });
};

main().catch((error) => {
  console.error(`safe_playwright_no_artifacts=error reason=${error.message}`);
  process.exitCode = 1;
});

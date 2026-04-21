import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const ZIP_COMPAT_PATH = path.resolve('scripts/tools/zip-compat.mjs');
const SCAN_REVIEW_BUNDLE_PATH = path.resolve('scripts/tools/scan-review-bundle.mjs');

function writeText(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value, 'utf8');
}

function removeTree(treePath) {
  fs.rmSync(treePath, { recursive: true, force: true });
}

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  });
}

function buildZipWithEntry(entryName, content) {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'dynamic-evidence-package-test-'));
  const zipPath = path.join(sandbox, 'bundle.zip');
  writeText(path.join(sandbox, entryName), content);
  run('node', [ZIP_COMPAT_PATH, 'create', zipPath, entryName], { cwd: sandbox });
  return { sandbox, zipPath };
}

test('review bundle scan accepts sanitized dynamic command summaries without raw artifact evidence', () => {
  const summary = {
    command: 'npm run test -- --run tests/e2e/dads-clinical-input-contract.spec.ts',
    cwd: 'web-client',
    runId: '20260421T044925Z',
    timestamp: '2026-04-21T04:49:25Z',
    exit_code: 0,
    result: 'PASS',
    test_count: 3,
    redacted_environment_summary: {
      orca_credentials: 'unset',
      cookies: 'not_collected',
      tokens: 'not_collected',
    },
    boundary: 'MSW/static UI evidence only; not live ORCA evidence.',
  };
  const { sandbox, zipPath } = buildZipWithEntry(
    'docs/evidence/command-summary.sanitized.json',
    `${JSON.stringify(summary, null, 2)}\n`,
  );

  try {
    const output = run('node', [SCAN_REVIEW_BUNDLE_PATH, zipPath]);
    assert.match(output, /review bundle included source scope secret scan passed/);
  } finally {
    removeTree(sandbox);
  }
});

test('review bundle scan rejects raw dynamic evidence paths and env files', () => {
  const forbiddenEntries = [
    'docs/evidence/trace.zip',
    'docs/evidence/session.har',
    'docs/evidence/screenshots/browser.txt',
    'docs/evidence/raw-network/request.json',
    'docs/evidence/raw-xml/response.xml',
    'docs/evidence/session.env',
    'docs/evidence/.env.local',
  ];

  for (const entryName of forbiddenEntries) {
    const { sandbox, zipPath } = buildZipWithEntry(entryName, 'raw fixture must not ship\n');
    try {
      assert.throws(
        () => run('node', [SCAN_REVIEW_BUNDLE_PATH, zipPath]),
        /forbidden raw\/generated path/,
        `entry should be rejected: ${entryName}`,
      );
    } finally {
      removeTree(sandbox);
    }
  }
});

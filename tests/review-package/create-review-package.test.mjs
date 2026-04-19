import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import test from 'node:test';

const SCRIPT_PATH = path.resolve('scripts/create-review-package.sh');
const COMMAND_LOG_WRAPPER_PATH = path.resolve('scripts/tools/command-log-wrapper.sh');
const RUN_ID = '20260414T080812Z';

function run(command, args, cwd) {
  return execFileSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function writeText(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value, 'utf8');
}

function setupRepo(files) {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'review-package-test-'));
  const repoDir = path.join(sandbox, 'repo');
  fs.mkdirSync(repoDir, { recursive: true });

  run('git', ['init', '-b', 'master'], repoDir);
  run('git', ['config', 'user.name', 'Codex Test'], repoDir);
  run('git', ['config', 'user.email', 'codex@example.invalid'], repoDir);

  for (const [relativePath, content] of Object.entries(files)) {
    writeText(path.join(repoDir, relativePath), content);
  }

  run('git', ['add', '.'], repoDir);
  run('git', ['commit', '-m', 'initial'], repoDir);

  return { sandbox, repoDir };
}

function listZip(zipPath, cwd) {
  return run('zipinfo', ['-1', zipPath], cwd)
    .trim()
    .split('\n')
    .filter(Boolean);
}

function commandLogContent(command = 'npm test') {
  return [
    'command_log_version=1',
    `command=${command}`,
    'cwd=/repo',
    `runId=${RUN_ID}`,
    'start_utc=2026-04-14T08:08:12Z',
    '--- command output ---',
    'test output',
    '--- command summary ---',
    'end_utc=2026-04-14T08:08:13Z',
    'exit_code=0',
    'result=PASS',
    '',
  ].join('\n');
}

function parseKeyValue(text) {
  const values = new Map();
  for (const line of text.split('\n')) {
    const index = line.indexOf('=');
    if (index > 0) {
      values.set(line.slice(0, index), line.slice(index + 1));
    }
  }
  return values;
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

test('creates a reviewer package without artifacts or legacy client content', () => {
  const { sandbox, repoDir } = setupRepo({
    'README.md': '# repo\n',
    'docs/guide.md': '# guide\n',
    'server-modernized/src/main/java/App.java': 'class App {}\n',
    'client/src/main/java/Legacy.java': 'class Legacy {}\n',
    'server/src/main/java/LegacyServer.java': 'class LegacyServer {}\n',
    'artifacts/evidence/run.txt': 'do not package\n',
    'web-client/dist/assets/app.js': 'compiled\n',
    'tmp/debug.txt': 'temporary\n',
  });

  try {
    const output = run('bash', [SCRIPT_PATH, '--run-id', RUN_ID, '--out-dir', 'out'], repoDir);
    const zipPath = path.join(repoDir, 'out', `OpenDolphin_WebClient-review-package-${RUN_ID}.zip`);
    const entries = listZip(zipPath, repoDir);

    assert.match(output, /\[DONE\] RUN_ID=20260414T080812Z/);
    assert(entries.includes('README.md'));
    assert(entries.includes('docs/guide.md'));
    assert(entries.includes('server-modernized/src/main/java/App.java'));
    assert(entries.includes('REVIEW_PACKAGE_MANIFEST.txt'));
    const manifest = run('unzip', ['-p', zipPath, 'REVIEW_PACKAGE_MANIFEST.txt'], repoDir);
    assert.match(manifest, /root_dir=\./);
    assert.match(manifest, /git_metadata_included=no/);
    assert.match(manifest, /clean_checkout_claim=not_applicable/);
    assert.match(manifest, /git_claim_evidence_policy=git claims require package-included local git command logs/);
    assert.match(manifest, /tracked_missing_file_count=0/);
    assert.match(manifest, /tracked_missing_files=none/);
    assert.match(manifest, /package_integrity_summary_file=OpenDolphin_WebClient-review-package-20260414T080812Z\.zip\.summary\.txt/);
    assert(!entries.some((entry) => entry.startsWith('client/')));
    assert(!entries.some((entry) => entry.startsWith('server/')));
    assert(!entries.some((entry) => entry.startsWith('artifacts/')));
    assert(!entries.some((entry) => entry.startsWith('.git/')));
    assert(!entries.some((entry) => entry.includes('/dist/')));
    assert(!entries.some((entry) => entry.includes('/node_modules/')));
    assert(!entries.some((entry) => entry.includes('/target/')));
    assert(!entries.some((entry) => entry.includes('/coverage/')));
    assert(!entries.some((entry) => entry.includes('/test-results/')));
    assert(!entries.some((entry) => entry.startsWith('tmp/')));

    const summaryPath = `${zipPath}.summary.txt`;
    const summary = parseKeyValue(fs.readFileSync(summaryPath, 'utf8'));
    assert.equal(summary.get('review_package_name'), `OpenDolphin_WebClient-review-package-${RUN_ID}.zip`);
    assert.equal(summary.get('zip_size_bytes'), String(fs.statSync(zipPath).size));
    assert.equal(summary.get('zip_sha256'), sha256File(zipPath));
  } finally {
    fs.rmSync(sandbox, { recursive: true, force: true });
  }
});

test('adds manifest-listed review logs when requested', () => {
  const manifestPath = 'docs/implementation/postfix/REVIEW_LOG_INCLUSIONS_MANIFEST.txt';
  const { sandbox, repoDir } = setupRepo({
    'README.md': '# repo\n',
    [manifestPath]: [
      'RUN_ID=20260418T224551Z',
      'Review logs:',
      '- test-logs/static.log',
      '- dynamic-logs/dynamic.log',
      '- dynamic-evidence/accept-summary.sanitized.json',
      '',
    ].join('\n'),
    'docs/implementation/postfix/test-logs/static.log': commandLogContent('npm run verify:web-guard'),
    'docs/implementation/postfix/dynamic-logs/dynamic.log': commandLogContent('node scripts/runtime-ready-smoke.mjs'),
  });

  try {
    writeText(
      path.join(repoDir, 'docs/implementation/postfix/dynamic-evidence/accept-summary.sanitized.json'),
      '{"rawSensitiveFieldsExcluded":true}\n',
    );
    const output = run(
      'bash',
      [
        SCRIPT_PATH,
        '--run-id',
        RUN_ID,
        '--out-dir',
        'out',
        '--name-suffix',
        '-with-dynamic-evidence',
        '--include-review-log-manifest',
        manifestPath,
      ],
      repoDir,
    );
    const zipPath = path.join(
      repoDir,
      'out',
      `OpenDolphin_WebClient-review-package-${RUN_ID}-with-dynamic-evidence.zip`,
    );
    const entries = listZip(zipPath, repoDir);
    const manifest = run('unzip', ['-p', zipPath, 'REVIEW_PACKAGE_MANIFEST.txt'], repoDir);

    assert.match(output, /with-dynamic-evidence\.zip/);
    assert(entries.includes(manifestPath));
    assert(entries.includes('docs/implementation/postfix/test-logs/static.log'));
    assert(entries.includes('docs/implementation/postfix/dynamic-logs/dynamic.log'));
    assert(entries.includes('docs/implementation/postfix/dynamic-evidence/accept-summary.sanitized.json'));
    assert.match(manifest, /review_package_name=OpenDolphin_WebClient-review-package-20260414T080812Z-with-dynamic-evidence\.zip/);
    assert.match(manifest, /review_log_include_count=3/);
    assert.match(manifest, /review_log_schema=command_logs_require_command_cwd_runId_start_end_exit_code_and_non_empty_content/);
    assert.match(manifest, /docs\/implementation\/postfix\/test-logs\/static\.log/);
  } finally {
    fs.rmSync(sandbox, { recursive: true, force: true });
  }
});

test('rejects empty manifest-listed command logs', () => {
  const manifestPath = 'docs/implementation/postfix/REVIEW_LOG_INCLUSIONS_MANIFEST.txt';
  const { sandbox, repoDir } = setupRepo({
    'README.md': '# repo\n',
    [manifestPath]: ['RUN_ID=20260418T224551Z', '- dynamic-logs/empty.log', ''].join('\n'),
    'docs/implementation/postfix/dynamic-logs/empty.log': '',
  });

  try {
    assert.throws(
      () => run('bash', [SCRIPT_PATH, '--run-id', RUN_ID, '--out-dir', 'out', '--include-review-log-manifest', manifestPath], repoDir),
      /empty and cannot be pass evidence/,
    );
  } finally {
    fs.rmSync(sandbox, { recursive: true, force: true });
  }
});

test('records tracked missing file details in the package manifest', () => {
  const { sandbox, repoDir } = setupRepo({
    'README.md': '# repo\n',
    'docs/present.md': '# present\n',
    'docs/missing.md': '# missing\n',
  });

  try {
    fs.rmSync(path.join(repoDir, 'docs/missing.md'));
    run('bash', [SCRIPT_PATH, '--run-id', RUN_ID, '--out-dir', 'out'], repoDir);
    const zipPath = path.join(repoDir, 'out', `OpenDolphin_WebClient-review-package-${RUN_ID}.zip`);
    const entries = listZip(zipPath, repoDir);
    const manifest = run('unzip', ['-p', zipPath, 'REVIEW_PACKAGE_MANIFEST.txt'], repoDir);

    assert(entries.includes('docs/present.md'));
    assert(!entries.includes('docs/missing.md'));
    assert.match(manifest, /tracked_missing_file_count=1/);
    assert.match(manifest, /tracked_missing_files_begin/);
    assert.match(manifest, /path=docs\/missing\.md reason=tracked_by_git_but_absent_in_worktree source=git_ls_files category=source-test-docs criticality=critical/);
    assert.match(manifest, /tracked_missing_files_end/);
  } finally {
    fs.rmSync(sandbox, { recursive: true, force: true });
  }
});

test('command log wrapper writes exit code metadata for silent success', () => {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'command-log-wrapper-test-'));
  const logPath = path.join(sandbox, 'silent-success.log');

  try {
    run('bash', [COMMAND_LOG_WRAPPER_PATH, '--run-id', RUN_ID, '--log', logPath, '--cwd', sandbox, '--', 'bash', '-c', ':'], sandbox);
    const log = fs.readFileSync(logPath, 'utf8');

    assert.notEqual(log.trim(), '');
    assert.match(log, /^command=bash -c :$/m);
    assert.match(log, new RegExp(`^runId=${RUN_ID}$`, 'm'));
    assert.match(log, /^start_utc=/m);
    assert.match(log, /^end_utc=/m);
    assert.match(log, /^exit_code=0$/m);
    assert.match(log, /^result=PASS$/m);
  } finally {
    fs.rmSync(sandbox, { recursive: true, force: true });
  }
});

test('fails when every tracked file is excluded', () => {
  const { sandbox, repoDir } = setupRepo({
    'client/src/main/java/Legacy.java': 'class Legacy {}\n',
    'server/src/main/java/LegacyServer.java': 'class LegacyServer {}\n',
    'artifacts/evidence/run.txt': 'do not package\n',
    'tmp/debug.txt': 'temporary\n',
  });

  try {
    assert.throws(
      () => run('bash', [SCRIPT_PATH, '--run-id', RUN_ID, '--out-dir', 'out'], repoDir),
      /No tracked files remained after exclusions/,
    );
  } finally {
    fs.rmSync(sandbox, { recursive: true, force: true });
  }
});

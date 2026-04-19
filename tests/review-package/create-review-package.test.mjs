import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import test from 'node:test';

const SCRIPT_PATH = path.resolve('scripts/create-review-package.sh');
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

test('creates a reviewer package without artifacts or legacy client content', () => {
  const { sandbox, repoDir } = setupRepo({
    'README.md': '# repo\n',
    'docs/guide.md': '# guide\n',
    'server-modernized/src/main/java/App.java': 'class App {}\n',
    'client/src/main/java/Legacy.java': 'class Legacy {}\n',
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
    assert(!entries.some((entry) => entry.startsWith('client/')));
    assert(!entries.some((entry) => entry.startsWith('artifacts/')));
    assert(!entries.some((entry) => entry.startsWith('.git/')));
    assert(!entries.some((entry) => entry.includes('/dist/')));
    assert(!entries.some((entry) => entry.startsWith('tmp/')));
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
    'docs/implementation/postfix/test-logs/static.log': 'static evidence\n',
    'docs/implementation/postfix/dynamic-logs/dynamic.log': 'dynamic evidence\n',
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
    assert.match(manifest, /docs\/implementation\/postfix\/test-logs\/static\.log/);
  } finally {
    fs.rmSync(sandbox, { recursive: true, force: true });
  }
});

test('fails when every tracked file is excluded', () => {
  const { sandbox, repoDir } = setupRepo({
    'client/src/main/java/Legacy.java': 'class Legacy {}\n',
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

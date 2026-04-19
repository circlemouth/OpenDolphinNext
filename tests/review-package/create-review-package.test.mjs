import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import test from 'node:test';

const SCRIPT_PATH = path.resolve('scripts/create-review-package.sh');
const COMMAND_LOG_WRAPPER_PATH = path.resolve('scripts/tools/command-log-wrapper.sh');
const METADATA_VALIDATOR_PATH = path.resolve('scripts/tools/validate-review-package-metadata.mjs');
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

function commandLogContent(command = 'npm test', commandOutput = 'test output') {
  return [
    'command_log_version=1',
    `command=${command}`,
    'cwd=/repo',
    `runId=${RUN_ID}`,
    'start_utc=2026-04-14T08:08:12Z',
    '--- command output ---',
    commandOutput,
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

function replaceSummaryValue(summaryPath, key, value) {
  const lines = fs.readFileSync(summaryPath, 'utf8').split('\n');
  const index = lines.findIndex((line) => line.startsWith(`${key}=`));
  assert.notEqual(index, -1, `summary key ${key} must exist`);
  lines[index] = `${key}=${value}`;
  fs.writeFileSync(summaryPath, lines.join('\n'), 'utf8');
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
    assert.match(manifest, /packageMode=extracted_review_subset/);
    assert.match(manifest, /root_dir=\./);
    assert.match(manifest, /git_metadata_included=no/);
    assert.match(manifest, /clean_checkout_claim=not_verified/);
    assert.match(manifest, /source_git_metadata_available=yes/);
    assert.match(manifest, /source_commit=[0-9a-f]{40}/);
    assert.match(manifest, /source_branch=master/);
    assert.match(manifest, /worktree_clean=not_verified/);
    assert.match(manifest, /git_claim_evidence_policy=git claims require package-included local git command logs/);
    assert.match(manifest, /guarantee_scope=extracted_review_subset_excludes_legacy_client_server_artifacts_generated_dirs_and_rejects_forbidden_dynamic_evidence_secrets/);
    assert.match(manifest, /non_guarantee_scope=not_clean_checkout_evidence_not_full_source_secret_scan_not_live_orca_evidence_not_git_truth/);
    assert.match(manifest, /secret_scan_scope=no_dynamic_review_evidence/);
    assert.match(manifest, /dynamic_secret_scan_claim=not_applicable/);
    assert.match(manifest, /bundle_included_source_scope_secret_scan_claim=not_claimed/);
    assert.match(manifest, /full_source_secret_scan_claim=not_claimed/);
    assert.match(manifest, /package_source_secret_scan_claim=not_claimed/);
    assert.match(manifest, /zip_file_count=recorded_in_external_sidecar/);
    assert.match(manifest, /zip_size_bytes=recorded_in_external_sidecar/);
    assert.match(manifest, /zip_sha256=recorded_in_external_sidecar/);
    assert.match(manifest, /orca_phase2_5_zero_candidate_verdict=PARTIAL_TEST_DATA_OR_HARNESS_READINESS_BLOCKER/);
    assert.match(manifest, /orca_phase2_5_zero_candidate_semantics=acceptedCandidateCount_0_means_00001_to_00011_lack_current_read_only_mutation_ready_evidence_across_harness_api_auth_parser_readiness_exact_preflight_criteria_not_official_initial_patient_absence/);
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
    assert.equal(summary.get('packageMode'), 'extracted_review_subset');
    assert.equal(summary.get('zip_size_bytes'), String(fs.statSync(zipPath).size));
    assert.equal(summary.get('zip_sha256'), sha256File(zipPath));
    assert.equal(summary.get('secret_scan_scope'), 'no_dynamic_review_evidence');
    assert.equal(summary.get('dynamic_secret_scan_claim'), 'not_applicable');
    assert.equal(summary.get('bundle_included_source_scope_secret_scan_claim'), 'not_claimed');
    assert.equal(summary.get('full_source_secret_scan_claim'), 'not_claimed');
    assert.equal(summary.get('package_source_secret_scan_claim'), 'not_claimed');
    assert.equal(summary.get('worktree_clean'), 'not_verified');
    assert.equal(summary.get('source_branch'), 'master');
    assert.match(summary.get('source_commit'), /^[0-9a-f]{40}$/);
    assert.match(summary.get('git_claim_evidence_policy'), /git claims require package-included local git command logs/);
    assert.match(run('node', [METADATA_VALIDATOR_PATH, zipPath], repoDir), /metadata validation passed/);
  } finally {
    fs.rmSync(sandbox, { recursive: true, force: true });
  }
});

test('adds manifest-listed review logs when requested', () => {
  const manifestPath = 'docs/implementation/orca-trial-phase2_5-gate-hardening-20260419T131740Z/REVIEW_LOG_INCLUSIONS_MANIFEST.txt';
  const { sandbox, repoDir } = setupRepo({
    'README.md': '# repo\n',
    [manifestPath]: [
      'RUN_ID=20260418T224551Z',
      'Review logs:',
      '- FINAL_REPORT.md',
      '- test-logs/static.log',
      '- dynamic-logs/dynamic.log',
      '- dynamic-evidence/accept-summary.sanitized.json',
      '',
    ].join('\n'),
    'docs/implementation/orca-trial-phase2_5-gate-hardening-20260419T131740Z/FINAL_REPORT.md': '# final report\n',
    'docs/implementation/orca-trial-phase2_5-gate-hardening-20260419T131740Z/test-logs/static.log': commandLogContent('npm run verify:web-guard'),
    'docs/implementation/orca-trial-phase2_5-gate-hardening-20260419T131740Z/dynamic-logs/dynamic.log': commandLogContent('node scripts/runtime-ready-smoke.mjs'),
  });

  try {
    writeText(
      path.join(repoDir, 'docs/implementation/orca-trial-phase2_5-gate-hardening-20260419T131740Z/dynamic-evidence/accept-summary.sanitized.json'),
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
    assert(entries.includes('docs/implementation/orca-trial-phase2_5-gate-hardening-20260419T131740Z/FINAL_REPORT.md'));
    assert(entries.includes('docs/implementation/orca-trial-phase2_5-gate-hardening-20260419T131740Z/test-logs/static.log'));
    assert(entries.includes('docs/implementation/orca-trial-phase2_5-gate-hardening-20260419T131740Z/dynamic-logs/dynamic.log'));
    assert(entries.includes('docs/implementation/orca-trial-phase2_5-gate-hardening-20260419T131740Z/dynamic-evidence/accept-summary.sanitized.json'));
    assert.match(manifest, /review_package_name=OpenDolphin_WebClient-review-package-20260414T080812Z-with-dynamic-evidence\.zip/);
    assert.match(manifest, /review_log_include_count=3/);
    assert.match(manifest, /review_log_schema=command_logs_require_command_cwd_runId_start_end_exit_code_and_non_empty_content/);
    assert.match(manifest, /secret_scan_scope=dynamic_review_evidence_only/);
    assert.match(manifest, /secret_scan_file_count=5/);
    assert.match(manifest, /secret_scan_claim=dynamic_review_evidence_passed/);
    assert.match(manifest, /dynamic_secret_scan_claim=passed/);
    assert.match(manifest, /package_source_secret_scan_claim=not_claimed/);
    assert.match(manifest, /docs\/implementation\/orca-trial-phase2_5-gate-hardening-20260419T131740Z\/test-logs\/static\.log/);
    assert.match(run('node', [METADATA_VALIDATOR_PATH, zipPath], repoDir), /metadata validation passed/);
  } finally {
    fs.rmSync(sandbox, { recursive: true, force: true });
  }
});

test('claims package source-scope scan only when the package scan log proves pass', () => {
  const manifestPath = 'docs/implementation/postfix/REVIEW_LOG_INCLUSIONS_MANIFEST.txt';
  const scanLogPath = 'docs/implementation/postfix/command-logs/secret-scan-review-bundle.log';
  const { sandbox, repoDir } = setupRepo({
    'README.md': '# repo\n',
    [manifestPath]: ['RUN_ID=20260418T224551Z', '- command-logs/secret-scan-review-bundle.log', ''].join('\n'),
    [scanLogPath]: commandLogContent(
      'node scripts/tools/scan-review-bundle.mjs artifacts/review-bundles/package.zip',
      'review bundle included source scope secret scan passed: artifacts/review-bundles/package.zip',
    ),
  });

  try {
    run('bash', [SCRIPT_PATH, '--run-id', RUN_ID, '--out-dir', 'out', '--include-review-log-manifest', manifestPath], repoDir);
    const zipPath = path.join(repoDir, 'out', `OpenDolphin_WebClient-review-package-${RUN_ID}.zip`);
    const manifest = parseKeyValue(run('unzip', ['-p', zipPath, 'REVIEW_PACKAGE_MANIFEST.txt'], repoDir));
    const summaryPath = `${zipPath}.summary.txt`;
    const summary = parseKeyValue(fs.readFileSync(summaryPath, 'utf8'));

    assert.equal(manifest.get('package_source_secret_scan_claim'), 'passed');
    assert.equal(manifest.get('bundle_included_source_scope_secret_scan_claim'), 'passed');
    assert.equal(summary.get('package_source_secret_scan_claim'), 'passed');
    assert.equal(summary.get('bundle_included_source_scope_secret_scan_claim'), 'passed');
    assert.match(run('node', [METADATA_VALIDATOR_PATH, zipPath], repoDir), /metadata validation passed/);

    replaceSummaryValue(summaryPath, 'package_source_secret_scan_claim', 'not_claimed');
    assert.throws(
      () => run('node', [METADATA_VALIDATOR_PATH, zipPath], repoDir),
      /package_source_secret_scan_claim/,
    );
  } finally {
    fs.rmSync(sandbox, { recursive: true, force: true });
  }
});

test('rejects dynamic-only evidence when the sidecar claims full source clean', () => {
  const manifestPath = 'docs/implementation/postfix/REVIEW_LOG_INCLUSIONS_MANIFEST.txt';
  const { sandbox, repoDir } = setupRepo({
    'README.md': '# repo\n',
    [manifestPath]: ['RUN_ID=20260418T224551Z', '- dynamic-logs/dynamic.log', ''].join('\n'),
    'docs/implementation/postfix/dynamic-logs/dynamic.log': commandLogContent('node scripts/runtime-ready-smoke.mjs'),
  });

  try {
    run('bash', [SCRIPT_PATH, '--run-id', RUN_ID, '--out-dir', 'out', '--include-review-log-manifest', manifestPath], repoDir);
    const zipPath = path.join(repoDir, 'out', `OpenDolphin_WebClient-review-package-${RUN_ID}.zip`);
    const summaryPath = `${zipPath}.summary.txt`;
    replaceSummaryValue(summaryPath, 'full_source_secret_scan_claim', 'passed');
    assert.throws(
      () => run('node', [METADATA_VALIDATOR_PATH, zipPath], repoDir),
      /full_source_secret_scan_claim/,
    );
  } finally {
    fs.rmSync(sandbox, { recursive: true, force: true });
  }
});

test('rejects package source-scope claim when secret-scan-review-bundle log is not a pass result', () => {
  const manifestPath = 'docs/implementation/postfix/REVIEW_LOG_INCLUSIONS_MANIFEST.txt';
  const { sandbox, repoDir } = setupRepo({
    'README.md': '# repo\n',
    [manifestPath]: ['RUN_ID=20260418T224551Z', '- command-logs/secret-scan-review-bundle.log', ''].join('\n'),
    'docs/implementation/postfix/command-logs/secret-scan-review-bundle.log': commandLogContent(
      'node scripts/tools/scan-review-bundle.mjs artifacts/review-bundles/package.zip',
      'scan command ran but did not emit the source-scope pass marker',
    ),
  });

  try {
    assert.throws(
      () => run('bash', [SCRIPT_PATH, '--run-id', RUN_ID, '--out-dir', 'out', '--include-review-log-manifest', manifestPath], repoDir),
      /does not prove package source-scope secret scan passed/,
    );
  } finally {
    fs.rmSync(sandbox, { recursive: true, force: true });
  }
});

test('rejects sidecar zip integrity drift', () => {
  const { sandbox, repoDir } = setupRepo({
    'README.md': '# repo\n',
    'docs/guide.md': '# guide\n',
  });

  try {
    run('bash', [SCRIPT_PATH, '--run-id', RUN_ID, '--out-dir', 'out'], repoDir);
    const zipPath = path.join(repoDir, 'out', `OpenDolphin_WebClient-review-package-${RUN_ID}.zip`);
    const summaryPath = `${zipPath}.summary.txt`;
    replaceSummaryValue(summaryPath, 'zip_file_count', '1');
    assert.throws(
      () => run('node', [METADATA_VALIDATOR_PATH, zipPath], repoDir),
      /zip_file_count/,
    );

    run('bash', [SCRIPT_PATH, '--run-id', RUN_ID, '--out-dir', 'out'], repoDir);
    replaceSummaryValue(summaryPath, 'zip_size_bytes', '1');
    assert.throws(
      () => run('node', [METADATA_VALIDATOR_PATH, zipPath], repoDir),
      /zip_size_bytes/,
    );

    run('bash', [SCRIPT_PATH, '--run-id', RUN_ID, '--out-dir', 'out'], repoDir);
    replaceSummaryValue(summaryPath, 'zip_sha256', '0'.repeat(64));
    assert.throws(
      () => run('node', [METADATA_VALIDATOR_PATH, zipPath], repoDir),
      /zip_sha256/,
    );
  } finally {
    fs.rmSync(sandbox, { recursive: true, force: true });
  }
});

test('packages extracted source subsets without git metadata as not verified git truth', () => {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'review-package-extracted-subset-test-'));

  try {
    writeText(path.join(sandbox, 'README.md'), '# extracted subset\n');
    writeText(path.join(sandbox, 'docs/guide.md'), '# guide\n');
    writeText(path.join(sandbox, 'server-modernized/src/main/java/App.java'), 'class App {}\n');
    writeText(path.join(sandbox, 'client/legacy.txt'), 'legacy\n');
    writeText(path.join(sandbox, 'dist/app.js'), 'compiled\n');

    run('bash', [SCRIPT_PATH, '--run-id', RUN_ID, '--out-dir', 'out'], sandbox);
    const zipPath = path.join(sandbox, 'out', `OpenDolphin_WebClient-review-package-${RUN_ID}.zip`);
    const entries = listZip(zipPath, sandbox);
    const manifest = run('unzip', ['-p', zipPath, 'REVIEW_PACKAGE_MANIFEST.txt'], sandbox);

    assert(entries.includes('README.md'));
    assert(entries.includes('docs/guide.md'));
    assert(entries.includes('server-modernized/src/main/java/App.java'));
    assert(!entries.includes('client/legacy.txt'));
    assert(!entries.includes('dist/app.js'));
    assert.match(manifest, /packageMode=extracted_review_subset/);
    assert.match(manifest, /source_git_metadata_available=no/);
    assert.match(manifest, /source_commit=not_verified/);
    assert.match(manifest, /source_branch=not_verified/);
    assert.match(manifest, /worktree_clean=not_verified/);
    assert.match(manifest, /clean_checkout_claim=not_verified/);
  } finally {
    fs.rmSync(sandbox, { recursive: true, force: true });
  }
});

test('rejects raw artifact paths from review log manifests', () => {
  const manifestPath = 'docs/implementation/postfix/REVIEW_LOG_INCLUSIONS_MANIFEST.txt';
  const rawCases = [
    ['dynamic-evidence/raw-upstream-response.xml', '<response />\n'],
    ['dynamic-evidence/screenshots/browser.png', 'not really a png\n'],
    ['dynamic-evidence/network/raw-dump.json', '{"still":"raw path"}\n'],
  ];

  for (const [rawPath, content] of rawCases) {
    const { sandbox, repoDir } = setupRepo({
      'README.md': '# repo\n',
      [manifestPath]: ['RUN_ID=20260418T224551Z', `- ${rawPath}`, ''].join('\n'),
    });

    try {
      writeText(path.join(repoDir, 'docs/implementation/postfix', rawPath), content);
      assert.throws(
        () => run('bash', [SCRIPT_PATH, '--run-id', RUN_ID, '--out-dir', 'out', '--include-review-log-manifest', manifestPath], repoDir),
        /raw artifact and is not allowed/,
      );
    } finally {
      fs.rmSync(sandbox, { recursive: true, force: true });
    }
  }
});

test('rejects credential-bearing review evidence before packaging', () => {
  const manifestPath = 'docs/implementation/postfix/REVIEW_LOG_INCLUSIONS_MANIFEST.txt';
  const secretCases = [
    ['authorization', 'Authorization: Bearer should-not-ship'],
    ['cookie', 'Cookie: JSESSIONID=should-not-ship'],
    ['jsessionid', 'JSESSIONID=should-not-ship'],
    ['csrf', 'X-CSRF-Token: should-not-ship'],
    ['raw-session', 'sessionId=should-not-ship'],
    ['raw-password', 'password=should-not-ship'],
    ['credential-url', `https://${'user' + ':pass@'}example.invalid/api`],
  ];

  for (const [caseName, secretLine] of secretCases) {
    const { sandbox, repoDir } = setupRepo({
      'README.md': '# repo\n',
      [manifestPath]: ['RUN_ID=20260418T224551Z', '- dynamic-logs/leaky.log', ''].join('\n'),
      'docs/implementation/postfix/dynamic-logs/leaky.log': [
        'command_log_version=1',
        'command=npm test',
        'cwd=/repo',
        `runId=${RUN_ID}`,
        'start_utc=2026-04-14T08:08:12Z',
        secretLine,
        'end_utc=2026-04-14T08:08:13Z',
        'exit_code=0',
        '',
      ].join('\n'),
    });

    try {
      assert.throws(
        () => run('bash', [SCRIPT_PATH, '--run-id', RUN_ID, '--out-dir', `out-${caseName}`, '--include-review-log-manifest', manifestPath], repoDir),
        /forbidden credential pattern/,
      );
    } finally {
      fs.rmSync(sandbox, { recursive: true, force: true });
    }
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
